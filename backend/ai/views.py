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
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

# Default welcome message for new conversations (fallback if none provided)
DEFAULT_WELCOME_MESSAGE = "您好！我是 PETer 專員 Peter，很高興為您服務。今天想從哪個功能開始？"


def run_mcp_agent(user_message, user_id, username, conversation_id=None, session_id=None, previous_history=None):
    try:
        from agents import HostedMCPTool, Agent, ModelSettings, TResponseInputItem, Runner, RunConfig, trace, AgentOutputSchema
        from agents.memory import OpenAIConversationsSession
        from pydantic import BaseModel, Field
        from openai.types.shared.reasoning import Reasoning
        from typing import Optional, Dict, List, Any
        import asyncio
        
        if previous_history is None:
            previous_history = []
        
        # Define structured output schema
        class AgentResponse(BaseModel):
            """Structured response from the AI agent"""
            response: str = Field(description="The main text response to the user")
            tutorial: Optional[str] = Field(default=None, description="Tutorial identifier to start (e.g., 'createPost'). If set, frontend shows a tutorial button.")
            has_calculator: bool = Field(default=False, description="Whether calculator button should be shown")
            operation_type: Optional[str] = Field(default=None, description="Primary operation type: navigate, fill_form, click, display_data")
            operations: List[Dict[str, Any]] = Field(default_factory=list, description="List of operations to perform")
            recommended_users: Dict[str, Dict[str, Any]] = Field(default_factory=dict, description="Dictionary of recommended users {id: details}")
            recommended_social_posts: Dict[str, Dict[str, Any]] = Field(default_factory=dict, description="Dictionary of recommended social posts {id: details}")
            recommended_forum_posts: Dict[str, Dict[str, Any]] = Field(default_factory=dict, description="Dictionary of recommended forum posts {id: details}")
        
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
                "get_pet_foods_details",
                "list_tutorial_topics"
            ],
            "require_approval": "never"
        })
        
        # Create the agent with structured output
        info_fetcher = Agent(
            name="Info Fetcher",
            instructions=f"""Use Traditional Chinese or English to respond to the user's requests. Understand the user's intention, then provide information using the MCP tools to the user. Ask if the user needs more info when helpful. The user expects a result in 50 seconds, so please be concise and efficient. DO NOT summarize the data.
            When calling get_post_recommendations by default, fetch BOTH social and forum posts unless the user explicitly asks for one type (i.e., set isSocial=true and isForum=true). Then, separate the returned items into recommended_social_posts and recommended_forum_posts accordingly.
            Use the MCP tool list_tutorial_topics to validate the available tutorial IDs and their descriptions before setting the tutorial field. Do not use legacy fields like has_tutorial or tutorial_type.
            User ID: {user_id}""",
            model="gpt-5",
            tools=[mcp],
            output_type=AgentOutputSchema(AgentResponse, strict_json_schema=False),  # Enable structured output with relaxed schema!
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
            base_session = OpenAIConversationsSession(conversation_id=session_id)
        else:
            logger.info("Creating new OpenAI session for conversation persistence (will be created lazily by API)")
            base_session = OpenAIConversationsSession()
        
        # With session memory, input must be a string (not a list)
        # OpenAI loads previous messages automatically via the session
        logger.info(f"Sending only new message as string (OpenAI manages history via session)")
        
        # Run the agent workflow
        session_used = {"session": base_session}

        async def run_agent_with_retry(max_retries: int = 1):
            """Run the agent with minimal retry if session initialization hits a transient 500."""
            attempt = 0
            current_session = base_session
            last_err = None
            while attempt <= max_retries:
                try:
                    with trace("PETer Agent"):
                        run_kwargs = {
                            "input": user_message,
                            "session": current_session,
                            "run_config": RunConfig(
                                trace_metadata={
                                    "__trace_source__": "agent-builder",
                                    "workflow_id": workflow_id,
                                    "user_id": user_id,
                                    "session_id": getattr(current_session, "_session_id", None) or "new"
                                }
                            )
                        }

                        logger.info(
                            f"Attempt {attempt+1}: Runner.run with session (conversation_id: {getattr(current_session, '_session_id', None) or 'will be created'})"
                        )

                        # Record which session is being used for this successful attempt
                        session_used["session"] = current_session
                        return await Runner.run(info_fetcher, **run_kwargs)
                except Exception as e:
                    last_err = e
                    attempt += 1
                    # Only retry once on possible transient OpenAI 500 from conversations.create
                    if attempt <= max_retries:
                        logger.warning(f"Agent run failed on attempt {attempt} with error: {e}. Retrying with fresh session...")
                        try:
                            await asyncio.sleep(0.8)
                        except Exception:
                            pass
                        # Refresh session for retry
                        current_session = OpenAIConversationsSession()
                    else:
                        break
            # If we get here, all retries failed
            raise last_err if last_err else RuntimeError("Unknown agent run failure")
        
        # Execute the async function
        logger.info("Running OpenAI Agent with MCP tools...")
        
        # Run with a timeout to prevent indefinite hanging
        try:
            agent_result = asyncio.wait_for(
                run_agent_with_retry(max_retries=1),
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
                'tutorial': None,
                'has_calculator': False,
                'operation_type': None,
                'recommended_users': {},
                'recommended_social_posts': {},
                'recommended_forum_posts': {},
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
        final_session_id = getattr(session_used.get("session"), "_session_id", None) or session_id
        logger.info(f"✓ Session conversation_id for persistence: {final_session_id}")
        
        # Generate our own conversation_id for database tracking
        if conversation_id:
            final_conversation_id = conversation_id
        else:
            final_conversation_id = f"conv_{uuid.uuid4().hex}"
        
        logger.info(f"✓ Database conversation_id: {final_conversation_id}")
        
        # With structured output (output_type=AgentResponse), extract the Pydantic model
        structured_output = None
        ai_response_text = ""
        
        # Try to get structured output from final_output
        if agent_result.final_output:
            try:
                # The agent returns an AgentResponse Pydantic model
                structured_output = agent_result.final_output_as(AgentResponse)
                logger.info(f"✓ Successfully extracted structured output from agent")
                logger.info(f"  - response text length: {len(structured_output.response)}")
                logger.info(f"  - tutorial: {structured_output.tutorial}")
                logger.info(f"  - has_calculator: {structured_output.has_calculator}")
                logger.info(f"  - operations count: {len(structured_output.operations)}")
                logger.info(f"  - recommended_users count: {len(structured_output.recommended_users)}")
                logger.info(f"  - recommended_social_posts count: {len(structured_output.recommended_social_posts)}")
                logger.info(f"  - recommended_forum_posts count: {len(structured_output.recommended_forum_posts)}")
            except Exception as e:
                logger.warning(f"Could not extract structured output: {e}")
        
        # Fallback to text extraction if structured output fails
        if not structured_output:
            logger.warning("Falling back to text extraction (structured output not available)")
            for item in agent_result.new_items:
                if hasattr(item, 'content') and item.content:
                    for content_item in item.content:
                        if hasattr(content_item, 'text'):
                            ai_response_text += content_item.text
            
            if not ai_response_text and agent_result.final_output:
                try:
                    ai_response_text = agent_result.final_output_as(str)
                except:
                    ai_response_text = str(agent_result.final_output)
            
            # Create a basic structured output from text
            structured_output = AgentResponse(
                response=ai_response_text,
                tutorial=None,
                has_calculator=False,
                operations=[],
                recommended_users={},
                recommended_social_posts={},
                recommended_forum_posts={}
            )
        
        logger.info(f"Agent response: {structured_output.response[:200]}...")
        
        # Build updated conversation history for frontend display
        # Append new exchange to previous history
        updated_history = list(previous_history) if previous_history else []
        updated_history.append({
            "role": "user",
            "content": [{"type": "input_text", "text": user_message}]
        })
        updated_history.append({
            "role": "assistant",
            "content": [{"type": "output_text", "text": structured_output.response}]
        })
        
        return {
            'response': structured_output.response,
            'tutorial': structured_output.tutorial,
            'has_calculator': structured_output.has_calculator,
            'operation_type': structured_output.operation_type,
            'operations': structured_output.operations,
            'recommended_users': structured_output.recommended_users,
            'recommended_social_posts': structured_output.recommended_social_posts,
            'recommended_forum_posts': structured_output.recommended_forum_posts,
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
            'tutorial': None,
            'has_calculator': False,
            'operation_type': None,
            'recommended_users': {},
            'recommended_social_posts': {},
            'recommended_forum_posts': {},
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
            'tutorial': None,
            'has_calculator': False,
            'operation_type': None,
            'recommended_users': {},
            'recommended_social_posts': {},
            'recommended_forum_posts': {},
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


# NOTE: The agent already returns standardized dictionaries for recommendations.
# Legacy extraction from raw MCP tool outputs is no longer required and has been removed.


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
            "conversationId": 123,
            "operations": [...],
            "operationType": "navigate | fill_form | click | display_data",
            "hasTutorial": false,
            "tutorialType": null,
            "hasCalculator": false,
            "recommendedUsers": {},
            "recommendedSocialPosts": {},
            "recommendedForumPosts": {}
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
            error_response = dict(result) if isinstance(result, dict) else {}
            error_response.setdefault('response', '抱歉，我暫時無法處理您的請求。請稍後再試。')
            error_response.setdefault('tutorial', None)
            error_response.setdefault('hasCalculator', False)
            error_response.setdefault('operations', [])
            error_response.setdefault('recommendedUsers', {})
            error_response.setdefault('recommendedSocialPosts', {})
            error_response.setdefault('recommendedForumPosts', {})
            error_response['conversationId'] = conversation_id
            return Response(error_response, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
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
        
        # Extract structured data from agent result
        # With output_type=AgentResponse, all data is already structured!
        operations = result.get('operations', [])
        tutorial = result.get('tutorial')
        has_calculator = result.get('has_calculator', False)
        operation_type = result.get('operation_type')
        recommended_users = result.get('recommended_users', {})
        recommended_social_posts = result.get('recommended_social_posts', {})
        recommended_forum_posts = result.get('recommended_forum_posts', {})

        # Normalize post dates to ensure 'created_at' exists for all posts
        def _normalize_post_dates(posts_dict):
            if not isinstance(posts_dict, dict):
                return {}
            for _pid, _post in list(posts_dict.items()):
                if not isinstance(_post, dict):
                    # Skip non-dict entries
                    continue
                ts = (
                    _post.get('created_at')
                    or _post.get('post_date')
                    or _post.get('createdAt')
                    or _post.get('postDate')
                    or _post.get('timestamp')
                    or _post.get('posted_at')
                    or _post.get('published_at')
                )
                # Always set created_at so frontend can reliably consume it
                _post['created_at'] = ts or datetime.now(timezone.utc).isoformat()
            return posts_dict

        recommended_social_posts = _normalize_post_dates(recommended_social_posts)
        recommended_forum_posts = _normalize_post_dates(recommended_forum_posts)
        
        logger.info(f"Structured output received:")
        logger.info(f"  - Operations: {len(operations)}")
        logger.info(f"  - Recommended users: {len(recommended_users)}")
        logger.info(f"  - Recommended social posts: {len(recommended_social_posts)}")
        logger.info(f"  - Recommended forum posts: {len(recommended_forum_posts)}")
        logger.info(f"  - Tutorial: {tutorial}, Has calculator: {has_calculator}")
        
        # Save messages to database for history display
        if thread:
            # Save user message
            AgentMessage.objects.create(
                conversation=thread,
                role='user',
                content=user_message
            )
            
            # Determine operation type from operations array (for legacy compatibility)
            if not operation_type and operations:
                operation_type = operations[0].get('type')
            
            # Build the exact response payload to return (pass-through from agent, ensure conversationId)
            response_payload = dict(result) if isinstance(result, dict) else {}
            # Remove non-serializable/internal fields (e.g., agent_result)
            response_payload.pop('agent_result', None)
            response_payload['conversationId'] = conversation_id
            # Ensure required keys exist for consistency
            response_payload.setdefault('tutorial', tutorial)
            response_payload.setdefault('hasCalculator', has_calculator)
            response_payload.setdefault('operationType', operation_type)
            response_payload.setdefault('operations', operations)
            response_payload.setdefault('recommendedUsers', recommended_users)
            response_payload.setdefault('recommendedSocialPosts', recommended_social_posts)
            response_payload.setdefault('recommendedForumPosts', recommended_forum_posts)

            AgentMessage.objects.create(
                conversation=thread,
                role='assistant',
                content=result.get('response', ''),
                # Feature flags (buttons/UI) - now from structured output!
                has_tutorial=bool(tutorial) if tutorial is not None else False,
                tutorial_type=tutorial,
                has_calculator=has_calculator,
                operation_type=operation_type,
                # Store dictionaries in additional_data
                additional_data={
                    'recommendedUsers': recommended_users,
                    'recommendedSocialPosts': recommended_social_posts,
                    'recommendedForumPosts': recommended_forum_posts,
                    'operations': operations,
                    'operationParams': {},  # TODO: Extract from operations if needed
                    'message_data': response_payload  # Persist full standardized agent response for this message
                }
            )
            logger.info(f"✓ Saved messages to database for conversation {thread.id}")
        else:
            logger.warning("⚠ No thread record - messages not saved to database")
        
        # Build final response payload (pass-through)
        response_data = response_payload
        
        logger.info(f"Main chat response: {response_data['response'][:100]}... (Operations: {len(operations)}, Users: {len(recommended_users)}, Social: {len(recommended_social_posts)}, Forum: {len(recommended_forum_posts)})")
        
        return Response(response_data, status=status.HTTP_200_OK)
        
    except Exception as e:
        logger.error(f"Unexpected error in main_chat: {str(e)}", exc_info=True)
        import traceback
        traceback.print_exc()
        
        error_response = {
            'response': '抱歉，我暫時無法處理您的請求。請稍後再試。',
            'conversationId': request.data.get('conversationId'),
            'tutorial': None,
            'hasCalculator': False,
            'operations': [],
            'recommendedUsers': {},
            'recommendedSocialPosts': {},
            'recommendedForumPosts': {},
            'error': f'處理請求時發生錯誤: {str(e)}'
        }
        return Response(error_response, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_conversations(request):
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
            # Include metadata needed to reconstruct previews and controls (no intent/source/confidence)
            # Build standardized message data for assistant messages if available
            msg_additional = msg.additional_data or {}
            message_data_payload = None
            if msg.role == 'assistant':
                # Prefer saved standardized payload if present, else reconstruct
                saved_payload = msg_additional.get('message_data')
                if isinstance(saved_payload, dict):
                    message_data_payload = saved_payload
                else:
                    # Reconstruct a standardized payload matching live response format
                    message_data_payload = {
                        'response': msg.content,
                        'conversationId': conversation.id,
                        'tutorial': msg.tutorial_type,  # keep single field only
                        'hasCalculator': msg.has_calculator,
                        'operationType': msg.operation_type,
                        'operations': msg_additional.get('operations', []),
                        'recommendedUsers': msg_additional.get('recommendedUsers', {}),
                        'recommendedSocialPosts': msg_additional.get('recommendedSocialPosts', {}),
                        'recommendedForumPosts': msg_additional.get('recommendedForumPosts', {})
                    }

            messages_data.append({
                'id': msg.id,
                'role': msg.role,
                'content': msg.content,
                'created_at': msg.created_at.isoformat(),
                'has_tutorial': msg.has_tutorial,
                'tutorial_type': msg.tutorial_type,
                'has_calculator': msg.has_calculator,
                'operation_type': msg.operation_type,
                # Structured data (recommended posts/users, operations, etc.)
                'additional_data': msg_additional,
                'entities': msg.entities or {},
                # Exact standardized agent response for assistant messages
                'message_data': message_data_payload,
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
def create_conversation(request):
    """
    Create a new AI Agent conversation (AgentThread) with a fresh OpenAI Session.
    This lets the frontend initialize a conversation ID before sending the first message.

    Request body (optional):
        { "title": "新對話" }

    Response:
        { "id": <int>, "title": <str>, "created_at": <iso8601> }
    """
    try:
        try:
            from agents.memory import OpenAIConversationsSession
        except Exception as e:
            logger.error(f"Missing or failing agents package when creating conversation: {e}")
            return Response({
                'error': 'Server is missing required agent packages. Please contact support.'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        title = request.data.get('title') or '新對話'
        provided_welcome = request.data.get('welcome_message')

        # Initialize a new OpenAI session (session id created lazily by API on first use)
        session = OpenAIConversationsSession()
        session_id = getattr(session, '_session_id', None)

        # Create the DB thread now; if session_id is not yet assigned, it will be set on first run.
        # However, the OpenAI SDK usually assigns an id lazily; we still store whatever we have.
        if not session_id:
            # Mark a placeholder; it will be updated on first run mismatch check
            session_id = f"sess_pending_{uuid.uuid4().hex[:8]}"

        thread = AgentThread.objects.create(
            user=request.user,
            thread_id=session_id,
            title=title
        )

        logger.info(f"Created new AgentThread {thread.id} for user {request.user.username} with session '{session_id}'")

        # Persist an initial assistant welcome message so the conversation has history immediately
        try:
            welcome_text = provided_welcome if isinstance(provided_welcome, str) and provided_welcome.strip() else DEFAULT_WELCOME_MESSAGE
            AgentMessage.objects.create(
                conversation=thread,
                role='assistant',
                content=welcome_text,
                has_tutorial=False,
                tutorial_type=None,
                has_calculator=False,
                operation_type=None,
                additional_data={
                    'recommendedUsers': {},
                    'recommendedSocialPosts': {},
                    'recommendedForumPosts': {},
                    'operations': [],
                    'operationParams': {},
                    # Store a standardized payload to match live responses
                    'message_data': {
                        'response': welcome_text,
                        'conversationId': thread.id,
                        'tutorial': None,
                        'hasCalculator': False,
                        'operationType': None,
                        'operations': [],
                        'recommendedUsers': {},
                        'recommendedSocialPosts': {},
                        'recommendedForumPosts': {}
                    }
                }
            )
            logger.info(f"Seeded welcome message for conversation {thread.id}")
        except Exception as se:
            logger.warning(f"Failed to seed welcome message for conversation {thread.id}: {se}")

        return Response({
            'id': thread.id,
            'title': thread.title,
            'created_at': thread.created_at.isoformat()
        }, status=status.HTTP_200_OK)

    except Exception as e:
        logger.error(f"Error creating new conversation: {str(e)}", exc_info=True)
        return Response({
            'error': f'Failed to create conversation: {str(e)}'
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
    