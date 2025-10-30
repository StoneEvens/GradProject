import os
import uuid
import requests
from django.shortcuts import render
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from django.conf import settings
import logging
from .models import AgentThread, AgentMessage

logger = logging.getLogger(__name__)

def run_mcp_agent(user_message, user_id, username, conversation_id=None, session_id=None, previous_history=None):
    """
    Core MCP agent execution logic with OpenAI's Session-based memory
    
    Args:
        user_message: The user's message
        user_id: User ID string
        username: Username for logging
        conversation_id: Our database conversation ID (not used by OpenAI directly)
        session_id: OpenAI Session ID for conversation persistence
        previous_history: Optional conversation history (NOT used - OpenAI manages via session)
        
    Returns:
        dict: {
            'response': str,
            'operations': list,
            'session_id': str,  # OpenAI session ID for continuation
            'conversation_id': str,  # Our database ID
            'conversation_history': list,  # Empty - OpenAI manages history
            'error': str (optional)
        }
    """
    try:
        from agents import HostedMCPTool, Agent, ModelSettings, TResponseInputItem, Runner, RunConfig, trace
        from agents.memory import OpenAIConversationsSession
        from pydantic import BaseModel
        from openai.types.shared.reasoning import Reasoning
        import asyncio
        
        if previous_history is None:
            previous_history = []
        
        # Log conversation status
        if session_id:
            logger.info(f"Continuing existing session: {session_id}")
        else:
            logger.info(f"Starting new session (OpenAI will create conversation_id)")
        
        if conversation_id:
            logger.info(f"Continuing existing conversation: {conversation_id} (OpenAI will load history)")
        else:
            logger.info(f"Starting new conversation (OpenAI will generate conversation_id)")
        
        logger.info(f"Agent chat request from user {username} (ID: {user_id}): {user_message}")
        
        # Get workflow ID
        workflow_id = os.environ.get('OPENAI_WORKFLOW_ID') or "wf_68fee4a8907881908aad9aaf9cf500b2000a3772ba65199b"
        
        # Define the MCP tool configuration
        mcp = HostedMCPTool(tool_config={
            "type": "mcp",
            "server_label": "MCP",
            "server_url": "https://peter.geniusbee.net/mcp/sse",
            "server_description": "MCP",
            "allowed_tools": [
                "get_user_pet_info_detailed",
                "get_post_recommendations",
                "get_user_information",
                "get_user_pet_types",
                "get_pet_foods_details"
            ],
            "require_approval": "never"
        })
        
        # Create the agent
        info_fetcher = Agent(
            name="Info Fetcher",
            instructions=f"""Understand the user's intention, then provide information using the mcp tools to the user. Do not make to many assumptions. Try to use the given information to answer the user first, then ask the user if they would like to provide more information to polish the response. Try to use the mcp tools first.

User ID: {user_id}

When users ask you to perform website actions (like navigating to pages), respond with operations in this format at the end of your message:

OPERATIONS:
[
  {{
    "operation_id": "unique-id",
    "type": "navigate|display_data|fill_form",
    "params": {{"param1": "value1"}},
    "requires_confirmation": false
  }}
]

Available operation types:
- navigate: Navigate to a page. Params: {{"path": "/page-path"}}
- display_data: Show data to user. Params: {{"message": "text", "data": {{...}}}}
- fill_form: Fill form fields. Params: {{"fieldName": "value"}}""",
            model="gpt-5",
            tools=[mcp],
            model_settings=ModelSettings(
                store=True,  # OpenAI stores conversation history via Session
                reasoning=Reasoning(
                    effort="low",
                    summary="auto"
                )
            )
        )
        
        # Create or reuse session for conversation persistence
        if session_id:
            logger.info(f"Reusing OpenAI session: {session_id}")
            session = OpenAIConversationsSession(conversation_id=session_id)
        else:
            logger.info("Creating new OpenAI session for conversation persistence")
            session = OpenAIConversationsSession()
        
        # With session memory, input must be a string (not a list)
        # OpenAI loads previous messages automatically via the session
        logger.info(f"Sending only new message as string (OpenAI manages history via session)")
        
        # Run the agent workflow
        async def run_agent():
            with trace("PETer Agent"):
                # Use Session parameter for conversation persistence with store=True
                # Input must be a string when using session memory
                run_kwargs = {
                    "input": user_message,  # String input when using session memory
                    "session": session,  # Session for conversation persistence!
                    "run_config": RunConfig(
                        trace_metadata={
                            "__trace_source__": "agent-builder",
                            "workflow_id": workflow_id,
                            "user_id": user_id,
                            "session_id": session._session_id or "new"
                        }
                    )
                }
                
                logger.info(f"Calling Runner.run with session (conversation_id: {session._session_id or 'will be created'})")
                
                info_fetcher_result_temp = await Runner.run(
                    info_fetcher,
                    **run_kwargs
                )
                
                return info_fetcher_result_temp
        
        # Execute the async function
        logger.info("Running OpenAI Agent with MCP tools...")
        
        # Run with a timeout to prevent indefinite hanging
        try:
            agent_result = asyncio.wait_for(
                run_agent(),
                timeout=90.0  # 90 second timeout for agent execution
            )
            agent_result = asyncio.run(agent_result)
            logger.info(f"Agent execution completed. Result type: {type(agent_result)}")
        except asyncio.TimeoutError:
            logger.error("Agent execution timed out after 90 seconds")
            return {
                'error': 'Agent processing took too long. Please try a simpler request.',
                'response': '',
                'operations': [],
                'session_id': session_id,
                'conversation_id': conversation_id,
                'conversation_history': previous_history  # Return what we had
            }
        
        # Extract conversation_id from OpenAI's response
        print("=" * 80)
        print("EXTRACTING CONVERSATION ID FROM OPENAI RESPONSE")
        print("=" * 80)
        
        returned_conversation_id = None
        
        # With Session-based persistence, the session._session_id is what we need to save
        # After Runner.run, OpenAI updates the session with the conversation_id
        # This is the key to conversation continuity!
        final_session_id = session._session_id
        logger.info(f"✓ Session conversation_id for persistence: {final_session_id}")
        
        # Generate our own conversation_id for database tracking
        if conversation_id:
            final_conversation_id = conversation_id
        else:
            final_conversation_id = f"conv_{uuid.uuid4().hex}"
        
        logger.info(f"✓ Database conversation_id: {final_conversation_id}")
        
        # Extract the response text from new items
        ai_response_text = ""
        
        for item in agent_result.new_items:
            if hasattr(item, 'content') and item.content:
                for content_item in item.content:
                    if hasattr(content_item, 'text'):
                        ai_response_text += content_item.text
        
        # Fallback to final_output if available
        if not ai_response_text and agent_result.final_output:
            try:
                ai_response_text = agent_result.final_output_as(str)
            except:
                ai_response_text = str(agent_result.final_output)
        
        logger.info(f"Agent response: {ai_response_text[:200]}...")
        
        # Extract operations from response text
        operations = []
        response_text = ai_response_text
        
        if 'OPERATIONS:' in ai_response_text:
            parts = ai_response_text.split('OPERATIONS:')
            response_text = parts[0].strip()
            
            try:
                import json
                import re
                
                operations_part = parts[1]
                # Match array of objects with nested braces - use greedy matching
                # This handles multiple operations: [{...}, {...}, ...]
                json_match = re.search(r'\[[\s\S]*\]', operations_part)
                
                if json_match:
                    operations_json = json_match.group(0)
                    operations = json.loads(operations_json)
                    logger.info(f"Extracted {len(operations)} operations from agent response")
                else:
                    logger.warning("OPERATIONS: marker found but no JSON array detected")
            except json.JSONDecodeError as parse_error:
                logger.error(f"Failed to parse operations JSON: {parse_error}")
                logger.debug(f"Operations text: {operations_part[:500]}")
            except Exception as parse_error:
                logger.error(f"Failed to parse operations: {parse_error}")
        
        # Build updated conversation history for frontend display
        # Append new exchange to previous history
        updated_history = list(previous_history) if previous_history else []
        updated_history.append({
            "role": "user",
            "content": [{"type": "input_text", "text": user_message}]
        })
        updated_history.append({
            "role": "assistant",
            "content": [{"type": "output_text", "text": response_text}]
        })
        
        return {
            'response': response_text,
            'operations': operations,
            'session_id': final_session_id,  # OpenAI session ID for conversation continuation
            'conversation_id': final_conversation_id,  # Our database ID
            'conversation_history': updated_history  # Return for frontend display only
        }
        
    except ImportError as e:
        logger.error(f"Missing required package: {str(e)}")
        return {
            'error': 'Missing required package. Install: pip uninstall agents && pip install git+https://github.com/openai/openai-agents-python.git',
            'response': '',
            'operations': [],
            'session_id': session_id,  # Return as-is, don't generate fallback
            'conversation_id': conversation_id,
            'conversation_history': []
        }
        
    except Exception as e:
        logger.error(f"Unexpected error in run_mcp_agent: {str(e)}", exc_info=True)
        return {
            'error': f'Unexpected error: {str(e)}',
            'response': '',
            'operations': [],
            'session_id': session_id,  # Return as-is, don't generate fallback
            'conversation_id': conversation_id,
            'conversation_history': []
        }

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def agent_chat(request):
    """
    Agent chat endpoint - intermediary between user and OpenAI Agent with MCP tools
    
    Data flow: User -> Webpage -> Backend -> OpenAI Agent (with MCP) -> Backend -> Webpage -> User
    
    This endpoint:
    1. Receives user message from frontend
    2. Runs the OpenAI Agent workflow with MCP tools (exactly as configured)
    3. Maintains conversation history per thread
    4. Extracts operations from agent response
    5. Returns message + operations to frontend
    
    Request body:
        {
            "message": "Show me my pets",
            "session_id": "optional-conversation-id",
            "conversation_id": "optional-conversation-id",
            "conversation_history": []
        }
    
    Response:
        {
            "response": "Here are your pets...",
            "operations": [...],
            "session_id": "conversation-id",
            "conversation_id": "conversation-id",
            "conversation_history": [...]
        }
    """
    # Parse request
    user_message = request.data.get('message')
    session_id = request.data.get('session_id')
    conversation_id = request.data.get('conversation_id')
    previous_history = request.data.get('conversation_history', [])
    
    if not user_message:
        return Response({
            'error': 'Message is required'
        }, status=status.HTTP_400_BAD_REQUEST)
    
    user = request.user
    user_id = str(user.id)
    
    # Call the core MCP agent logic
    result = run_mcp_agent(
        user_message=user_message,
        user_id=user_id,
        username=user.username,
        conversation_id=conversation_id,
        session_id=session_id,
        previous_history=previous_history
    )
    
    # Check for errors
    if 'error' in result:
        return Response({
            'error': result['error']
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    # Return successful response
    return Response({
        'response': result['response'],
        'operations': result['operations'],
        'session_id': result['session_id'],
        'conversation_id': result['conversation_id'],
        'conversation_history': result['conversation_history']
    }, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def main_chat(request):
    """
    Main chat endpoint - compatible with aiChatService frontend
    
    This endpoint wraps agent_chat and transforms the response to match
    the aiAgent app format, allowing the main page ChatWindow to use the
    new OpenAI Agents SDK with MCP tools seamlessly.
    
    Request body (from aiChatService):
        {
            "message": "Show me my pets",
            "conversationId": 123,  // optional
            "context": {
                "petId": 1,
                "lastIntent": "feeding",
                "conversationHistory": [...],
                ...
            }
        }
    
    Response (aiAgent-compatible format):
        {
            "response": "Here are your pets...",
            "source": "mcp_agent",
            "confidence": 1.0,
            "intent": "get_pet_info",
            "conversationId": 123,
            "operations": [...],  // Added for operation client
            "hasTutorial": false,
            "hasRecommendedUsers": false,
            "hasRecommendedArticles": false,
            "hasCalculator": false,
            "hasOperation": true
        }
    """
    try:
        # Extract data from request (aiChatService format)
        user_message = request.data.get('message')
        conversation_id = request.data.get('conversationId')
        context = request.data.get('context', {})
        
        if not user_message:
            return Response({
                'error': '訊息不能為空',
                'response': '請輸入訊息',
                'source': 'error',
                'confidence': 0.0
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Extract conversation history from context if available (for display/fallback only)
        conversation_history = context.get('conversationHistory', [])
        
        # Convert aiChatService history format to agent format (kept for frontend display)
        # Note: This history is NOT sent to the agent - OpenAI loads it from store
        agent_history = []
        for hist_item in conversation_history:
            if 'user' in hist_item:
                agent_history.append({
                    "role": "user",
                    "content": [{"type": "input_text", "text": hist_item['user']}]
                })
            if 'ai' in hist_item:
                agent_history.append({
                    "role": "assistant",
                    "content": [{"type": "output_text", "text": hist_item['ai']}]
                })
        
        # Get or create thread from database
        thread = None
        openai_session_id = None  # Changed from openai_conversation_id to openai_session_id
        is_new_conversation = False
        
        if conversation_id:
            # Try to find existing thread by conversation_id
            try:
                thread = AgentThread.objects.get(
                    id=conversation_id,
                    user=request.user,
                    is_active=True
                )
                openai_session_id = thread.thread_id  # This contains the OpenAI session.id
                logger.info(f"Found existing OpenAI session: {openai_session_id} for frontend conversation: {conversation_id}")
            except AgentThread.DoesNotExist:
                logger.info(f"No thread found for conversation_id: {conversation_id}, will create new session")
                is_new_conversation = True
        else:
            logger.info("No conversation_id provided, will create new OpenAI session")
            is_new_conversation = True
        
        logger.info(f"Main chat request from user {request.user.username}: {user_message}")
        logger.info(f"Frontend Conversation ID: {conversation_id}, OpenAI Session ID: {openai_session_id or 'will be created'}")
        logger.info(f"Using OpenAI's Session-based memory (store=True)")
        
        # Call the core MCP agent logic
        # Note: previous_history is passed but NOT sent to agent - only for frontend display
        result = run_mcp_agent(
            user_message=user_message,
            user_id=str(request.user.id),
            username=request.user.username,
            conversation_id=None,  # Not used anymore
            session_id=openai_session_id,  # Pass the OpenAI session.id for conversation continuation
            previous_history=agent_history  # Kept for frontend display only
        )
        
        # Check if there was an error
        if 'error' in result:
            return Response({
                'error': result['error'],
                'response': '抱歉，我暫時無法處理您的請求。請稍後再試。',
                'source': 'error',
                'confidence': 0.0,
                'hasTutorial': False,
                'hasRecommendedUsers': False,
                'hasRecommendedArticles': False,
                'hasCalculator': False,
                'hasOperation': False
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
        # Get the session_id from the result (OpenAI's session.id)
        returned_session_id = result.get('session_id')
        
        logger.info(f"Session ID from run_mcp_agent: {returned_session_id}")
        
        # Handle thread persistence in database
        if is_new_conversation and returned_session_id:
            # New conversation - create database record with the session_id from OpenAI
            # Generate a concise title from the user's first message
            title = user_message.strip()
            
            # Remove common prefixes to get to the core question
            prefixes_to_remove = ['請問', '想問', '我想知道', '可以告訴我', '幫我', '能不能', '可以幫我']
            for prefix in prefixes_to_remove:
                if title.startswith(prefix):
                    title = title[len(prefix):].strip()
            
            # Truncate if too long
            if len(title) > 50:
                # Try to find a natural break point (period, question mark, comma)
                for i, char in enumerate(title[40:50], 40):
                    if char in '。？！，':
                        title = title[:i+1]
                        break
                else:
                    title = title[:47] + "..."
            
            # Fallback to first 50 chars if empty
            if not title:
                title = user_message[:50] if len(user_message) <= 50 else user_message[:47] + "..."
            
            thread = AgentThread.objects.create(
                user=request.user,
                thread_id=returned_session_id,  # Store OpenAI's session.id (e.g., "sess_xxx...")
                title=title
            )
            logger.info(f"✓ Created thread record: session_id '{returned_session_id}' -> Django ID {thread.id}")
            
            # Update conversation_id to return the Django-generated ID to frontend
            conversation_id = thread.id
            
        elif is_new_conversation and not returned_session_id:
            # This shouldn't happen now, but handle gracefully
            logger.error("⚠ ERROR: New conversation but no session_id in result!")
            logger.error("⚠ This indicates a bug in run_mcp_agent()")
            logger.warning("⚠ User will need to start a new conversation for each message")
            # Don't create thread record without session_id
            thread = None
            
        elif thread:
            # Existing conversation - update timestamp
            thread.save(update_fields=['updated_at'])
            logger.info(f"✓ Updated thread timestamp for conversation {conversation_id}")
            
            # Verify session_id matches what we got back (should be the same)
            if returned_session_id and thread.thread_id != returned_session_id:
                logger.error(f"⚠ Session ID mismatch! DB: {thread.thread_id}, Response: {returned_session_id}")
        
        # Save messages to database for history display
        if thread:
            # Save user message
            AgentMessage.objects.create(
                conversation=thread,
                role='user',
                content=user_message
            )
            
            # Save assistant response
            AgentMessage.objects.create(
                conversation=thread,
                role='assistant',
                content=result.get('response', '')
            )
            logger.info(f"✓ Saved messages to database for conversation {thread.id}")
        else:
            logger.warning("⚠ No thread record - messages not saved to database")
        
        # Transform result to aiAgent format
        operations = result.get('operations', [])
        intent = 'general_query'
        has_operation = len(operations) > 0
        
        if operations:
            # Try to infer intent from operation types
            op_types = [op.get('type') for op in operations]
            if 'navigate' in op_types:
                intent = 'navigation'
            elif 'display_data' in op_types:
                intent = 'data_display'
            elif 'fill_form' in op_types:
                intent = 'form_filling'
        
        # Build aiAgent-compatible response
        response_data = {
            'response': result.get('response', ''),
            'source': 'mcp_agent',
            'confidence': 1.0,  # MCP agent is authoritative
            'intent': intent,
            'conversationId': conversation_id,  # Keep original conversation ID
            'operations': operations,  # Pass through operations for operation client
            'hasTutorial': False,  # MCP agent doesn't provide tutorials yet
            'hasRecommendedUsers': False,
            'hasRecommendedArticles': False,
            'hasCalculator': False,
            'hasOperation': has_operation,
            'operationType': operations[0].get('type') if operations else None
        }
        
        logger.info(f"Main chat response: {response_data['response'][:100]}... (Operations: {len(operations)})")
        
        return Response(response_data, status=status.HTTP_200_OK)
        
    except Exception as e:
        logger.error(f"Unexpected error in main_chat: {str(e)}", exc_info=True)
        import traceback
        traceback.print_exc()
        return Response({
            'error': f'處理請求時發生錯誤: {str(e)}',
            'response': '抱歉，我暫時無法處理您的請求。請稍後再試。',
            'source': 'error',
            'confidence': 0.0,
            'hasTutorial': False,
            'hasRecommendedUsers': False,
            'hasRecommendedArticles': False,
            'hasCalculator': False,
            'hasOperation': False
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_conversations(request):
    """
    Get list of user's conversations
    
    Query params:
        - archived: bool (default: False) - Include archived conversations
    
    Returns:
        [
            {
                "id": 1,
                "title": "How to feed my cat?",
                "created_at": "2025-10-31T10:00:00Z",
                "updated_at": "2025-10-31T12:00:00Z",
                "is_active": true
            },
            ...
        ]
    """
    try:
        # Get query parameters
        archived = request.query_params.get('archived', 'false').lower() == 'true'
        
        # Query conversations for the user
        conversations = AgentThread.objects.filter(user=request.user)
        
        if not archived:
            conversations = conversations.filter(is_active=True)
        
        # Serialize the data
        conversation_list = []
        for conv in conversations:
            conversation_list.append({
                'id': conv.id,
                'title': conv.title,
                'created_at': conv.created_at.isoformat(),
                'updated_at': conv.updated_at.isoformat(),
                'is_active': conv.is_active
            })
        
        return Response(conversation_list, status=status.HTTP_200_OK)
        
    except Exception as e:
        logger.error(f"Error getting conversations: {str(e)}", exc_info=True)
        return Response({
            'error': f'Failed to get conversations: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_conversation_detail(request, conversation_id):
    """
    Get conversation detail with message history from database
    
    Path params:
        - conversation_id: int - Conversation ID (Django model ID)
    
    Returns:
        {
            "id": 1,
            "title": "How to feed my cat?",
            "created_at": "2025-10-31T10:00:00Z",
            "updated_at": "2025-10-31T12:00:00Z",
            "is_active": true,
            "messages": [
                {
                    "role": "user",
                    "content": "How to feed my cat?",
                    "created_at": "2025-10-31T10:00:00Z"
                },
                {
                    "role": "assistant",
                    "content": "Here are some tips...",
                    "created_at": "2025-10-31T10:00:05Z"
                }
            ]
        }
    """
    try:
        # Get the conversation
        try:
            conversation = AgentThread.objects.get(
                id=conversation_id,
                user=request.user,
                is_active=True
            )
        except AgentThread.DoesNotExist:
            return Response({
                'error': 'Conversation not found'
            }, status=status.HTTP_404_NOT_FOUND)
        
        # Get messages from database
        messages = conversation.messages.all()
        
        messages_data = []
        for msg in messages:
            messages_data.append({
                'role': msg.role,
                'content': msg.content,
                'created_at': msg.created_at.isoformat()
            })
        
        conversation_data = {
            'id': conversation.id,
            'title': conversation.title,
            'created_at': conversation.created_at.isoformat(),
            'updated_at': conversation.updated_at.isoformat(),
            'is_active': conversation.is_active,
            'messages': messages_data
        }
        
        logger.info(f"Retrieved conversation {conversation_id} with {len(messages_data)} messages for user {request.user.username}")
        
        return Response(conversation_data, status=status.HTTP_200_OK)
        
    except Exception as e:
        logger.error(f"Error getting conversation detail: {str(e)}", exc_info=True)
        return Response({
            'error': f'Failed to get conversation: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def update_conversation(request, conversation_id):
    """
    Update conversation (e.g., change title)
    
    Request body:
        {
            "title": "New title"
        }
    """
    try:
        conversation = AgentThread.objects.get(
            id=conversation_id,
            user=request.user,
            is_active=True
        )
        
        # Update title if provided
        title = request.data.get('title')
        if title:
            conversation.title = title
            conversation.save()
        
        return Response({
            'id': conversation.id,
            'title': conversation.title,
            'updated_at': conversation.updated_at.isoformat()
        }, status=status.HTTP_200_OK)
        
    except AgentThread.DoesNotExist:
        return Response({
            'error': 'Conversation not found'
        }, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        logger.error(f"Error updating conversation: {str(e)}", exc_info=True)
        return Response({
            'error': f'Failed to update conversation: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def delete_conversation(request, conversation_id):
    """
    Delete (archive) a conversation
    """
    try:
        conversation = AgentThread.objects.get(
            id=conversation_id,
            user=request.user
        )
        
        # Soft delete by setting is_active=False
        conversation.is_active = False
        conversation.save()
        
        logger.info(f"Archived conversation {conversation_id} for user {request.user.username}")
        
        return Response({
            'message': 'Conversation deleted successfully'
        }, status=status.HTTP_200_OK)
        
    except AgentThread.DoesNotExist:
        return Response({
            'error': 'Conversation not found'
        }, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        logger.error(f"Error deleting conversation: {str(e)}", exc_info=True)
        return Response({
            'error': f'Failed to delete conversation: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def archive_conversation(request, conversation_id):
    """
    Archive/unarchive a conversation
    
    Request body:
        {
            "is_archived": true
        }
    """
    try:
        conversation = AgentThread.objects.get(
            id=conversation_id,
            user=request.user
        )
        
        is_archived = request.data.get('is_archived', True)
        conversation.is_active = not is_archived
        conversation.save()
        
        return Response({
            'id': conversation.id,
            'is_active': conversation.is_active,
            'updated_at': conversation.updated_at.isoformat()
        }, status=status.HTTP_200_OK)
        
    except AgentThread.DoesNotExist:
        return Response({
            'error': 'Conversation not found'
        }, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        logger.error(f"Error archiving conversation: {str(e)}", exc_info=True)
        return Response({
            'error': f'Failed to archive conversation: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
