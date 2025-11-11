import os
import uuid
import requests
import asyncio
from django.shortcuts import render
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from django.conf import settings
import logging
from .models import AgentThread, AgentMessage
from .PETer_Agent import WorkflowInput, run_workflow
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

# Default welcome message for new conversations (fallback if none provided)
DEFAULT_WELCOME_MESSAGE = "您好！我是 PETer 專員 Peter，很高興為您服務。今天想從哪個功能開始？"

# Human-friendly labels for known operation types (used to improve conversation titles)
OPERATION_TITLE_LABELS = {
    'navigate_health_records': '健康紀錄',
    'navigate_feeding_schedule': '餵食排程',
    'navigate_nearby_hospitals': '附近醫院',
    'navigate_pet_profile': '寵物檔案',
    'navigate_social': '社群'
}

def _generate_conversation_title(user_message: str, tutorial: str = None, operation_type: str = None) -> str:
    """Generate a concise conversation title reflecting user's intention.

    Priority:
    1) Tutorial id present -> "教學：{id}"
    2) Operation type present -> "操作：{label}"
    3) Cleaned user message (first sentence), up to ~50 chars
    """
    try:
        # 1) Tutorial-based
        if tutorial:
            return f"教學：{str(tutorial).strip()}"

        # 2) Operation-based
        if operation_type:
            label = OPERATION_TITLE_LABELS.get(operation_type, operation_type)
            return f"操作：{label}"

        # 3) Derive from user message
        title = (user_message or '').strip()
        # Remove common polite prefixes
        for prefix in ['請問', '想問', '我想知道', '可以告訴我', '幫我', '能不能', '可以幫我', '請幫我']:
            if title.startswith(prefix):
                title = title[len(prefix):].strip()

        # Cut at first sentence terminator if exists
        for ch in ['。', '？', '！', '.', '?', '!']:
            idx = title.find(ch)
            if idx != -1:
                title = title[:idx+1]
                break

        # Trim length to ~50 chars, trying to stop at punctuation
        max_len = 50
        if len(title) > max_len:
            slice_part = title[:max_len]
            for ch in ['，', '、', ',', '。', '；', ';']:
                idx = slice_part.rfind(ch)
                if idx != -1 and idx >= 30:  # keep reasonably informative
                    title = slice_part[:idx+1]
                    break
            else:
                title = title[:47] + '...'

        # Fallback
        return title or '新對話'
    except Exception:
        return '新對話'


def _run_agent_plug_and_play(message: str, user_id: str, username: str, session_id: str | None):
    """Wrapper to invoke PETer_Agent.run_workflow and normalize response structure.
    Returns dict with keys similar to legacy format.
    """
    workflow_input = WorkflowInput(input_as_text=message)
    result = asyncio.run(
        run_workflow(
            workflow_input,
            user_id=int(user_id) if str(user_id).isdigit() else user_id,
            username=username,
            session_id=session_id,
        )
    )
    parsed = result.get('output_parsed', {})
    session_id_final = result.get('session_id') or session_id
    
    # Helper to remove blank/placeholder post recommendations. If nothing meaningful remains,
    # return an empty list (so the frontend doesn't render empty cards).
    def _sanitize_post_recs(recs):
        """Convert legacy dict format {id: {...}} or list into list[{'post_id': id, ...}] and drop blanks."""
        out = []
        try:
            if isinstance(recs, dict):
                for _pid, _post in recs.items():
                    if not isinstance(_post, dict):
                        continue
                    title = (_post.get('title') or '').strip()
                    details = (_post.get('post_details') or _post.get('details') or '').strip()
                    if not (title or details):
                        continue
                    item = dict(_post)
                    item.setdefault('post_id', _pid)
                    out.append(item)
            elif isinstance(recs, list):
                for _post in recs:
                    if not isinstance(_post, dict):
                        continue
                    title = (_post.get('title') or '').strip()
                    details = (_post.get('post_details') or _post.get('details') or '').strip()
                    if not (title or details):
                        continue
                    # Ensure post_id exists (fallback to provided id field variants if any)
                    pid = _post.get('post_id') or _post.get('id')
                    item = dict(_post)
                    if pid is not None:
                        item['post_id'] = pid
                    out.append(item)
        except Exception:
            return []
        return out

    # Helper to sanitize user recommendations. If all entries are blank placeholders,
    # return [] instead of a dict with empty fields.
    def _sanitize_user_recs(recs):
        """Normalize recommended users into list[{user_id, display_name, user_details}]."""
        out = []
        try:
            if isinstance(recs, dict):
                for _uid, _user in recs.items():
                    if not isinstance(_user, dict):
                        continue
                    display_name = (_user.get('display_name') or _user.get('name') or '').strip()
                    details = (_user.get('user_details') or _user.get('details') or '').strip()
                    if not (display_name or details):
                        continue
                    item = dict(_user)
                    item.setdefault('user_id', _uid)
                    out.append(item)
            elif isinstance(recs, list):
                for _user in recs:
                    if not isinstance(_user, dict):
                        continue
                    display_name = (_user.get('display_name') or _user.get('name') or '').strip()
                    details = (_user.get('user_details') or _user.get('details') or '').strip()
                    if not (display_name or details):
                        continue
                    # ensure user_id present
                    uid = _user.get('user_id') or _user.get('id')
                    item = dict(_user)
                    if uid is not None:
                        item['user_id'] = uid
                    out.append(item)
        except Exception:
            return []
        return out

    # Normalize operation list shape (each item has operation_name / operation_data)
    operations_raw = parsed.get('operations') or []
    operations = []
    for op in operations_raw:
        # Accept dict or Pydantic object
        if isinstance(op, dict):
            operations.append(op)
        else:
            try:
                operations.append(op.model_dump())
            except Exception:
                operations.append({
                    'operation_name': getattr(op, 'operation_name', ''),
                    'operation_data': getattr(op, 'operation_data', ''),
                })
    # Sanitize recommendations: drop blank placeholders; if empty -> []
    recommended_social_posts = _sanitize_post_recs(parsed.get('recommended_social_posts') or [])
    recommended_forum_posts = _sanitize_post_recs(parsed.get('recommended_forum_posts') or [])
    recommended_users = _sanitize_user_recs(parsed.get('recommended_users') or [])
    return {
        'response': parsed.get('reply', ''),
        'tutorial': parsed.get('tutorial'),
        'has_calculator': parsed.get('has_calculator', False),
        'operation_type': parsed.get('operation_type'),
        'operations': operations,
    'recommended_users': recommended_users,
        'recommended_social_posts': recommended_social_posts,
        'recommended_forum_posts': recommended_forum_posts,
        # Standardized: thread_id is the OpenAI id used to continue conversation
        'session_id': session_id_final,
        'conversation_history': []  # Built separately after DB persistence
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
    
    # Call the plug-and-play agent logic
    # Only send a valid OpenAI session id that starts with 'conv_' back to the SDK; otherwise start a fresh session
    session_id_for_agent = session_id if (isinstance(session_id, str) and session_id.startswith('conv_')) else None
    result = _run_agent_plug_and_play(user_message, user_id, user.username, session_id_for_agent)

    # Canonical OpenAI continuation id
    returned_session_id = result.get('session_id') or (session_id if isinstance(session_id, str) and session_id.startswith('conv_') else None)

    # Resolve or create conversation thread
    thread = None
    if conversation_id:
        try:
            thread = AgentThread.objects.get(id=conversation_id, user=user)
        except AgentThread.DoesNotExist:
            thread = None

    if not thread and returned_session_id:
        # Try to find by session id
        try:
            thread = AgentThread.objects.get(thread_id=returned_session_id, user=user)
        except AgentThread.DoesNotExist:
            thread = None

    if not thread and returned_session_id:
        # Create new thread with a sensible title based on intent
        title = _generate_conversation_title(
            user_message=user_message,
            tutorial=result.get('tutorial'),
            operation_type=result.get('operation_type')
        )
        thread = AgentThread.objects.create(
            user=user,
            thread_id=returned_session_id,
            title=title
        )
        conversation_id = thread.id
    elif thread and returned_session_id and returned_session_id.startswith('conv_') and thread.thread_id != returned_session_id:
        # Update stored session id if needed (e.g., pending placeholder -> real id)
        if str(thread.thread_id).startswith('sess_pending_') or not thread.thread_id.startswith('conv_'):
            thread.thread_id = returned_session_id
            thread.save(update_fields=['thread_id', 'updated_at'])

    # Save latest user/assistant messages
    if thread:
        AgentMessage.objects.create(
            conversation=thread,
            role='user',
            content=user_message
        )
        AgentMessage.objects.create(
            conversation=thread,
            role='assistant',
            content=result.get('response', ''),
            has_tutorial=bool(result.get('tutorial')),
            tutorial_type=result.get('tutorial'),
            has_calculator=result.get('has_calculator', False),
            operation_type=result.get('operation_type'),
            additional_data={
                'operations': result.get('operations', []),
                'recommendedUsers': result.get('recommended_users', []),
                'recommendedSocialPosts': result.get('recommended_social_posts', {}),
                'recommendedForumPosts': result.get('recommended_forum_posts', {}),
                'message_data': {
                    'response': result.get('response', ''),
                    'operations': result.get('operations', []),
                    'tutorial': result.get('tutorial'),
                    'hasCalculator': result.get('has_calculator', False),
                    'operationType': result.get('operation_type'),
                    'recommendedUsers': result.get('recommended_users', []),
                    'recommendedSocialPosts': result.get('recommended_social_posts', {}),
                    'recommendedForumPosts': result.get('recommended_forum_posts', {}),
                    'session_id': returned_session_id,
                    'conversationId': thread.id,
                }
            }
        )

    # Build conversation history from DB for the response
    conversation_history_built = []
    if thread:
        for msg in thread.messages.order_by('created_at').all():
            if msg.role == 'user':
                conversation_history_built.append({
                    'role': 'user',
                    'content': [{ 'type': 'input_text', 'text': msg.content }]
                })
            elif msg.role == 'assistant':
                conversation_history_built.append({
                    'role': 'assistant',
                    'content': [{ 'type': 'output_text', 'text': msg.content }]
                })
    
    # Check for errors
    if 'error' in result:
        return Response({
            'error': result['error']
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    # Return successful response
    # conversation_id handling moved out; use session_id only in this simplified endpoint
    return Response({
        'response': result['response'],
        'operations': result['operations'],
        'session_id': returned_session_id,
        'conversation_id': conversation_id,
        'conversation_history': conversation_history_built,
    }, status=status.HTTP_200_OK)


# NOTE: The agent already returns standardized dictionaries for recommendations.
# Legacy extraction from raw MCP tool outputs is no longer required and has been removed.


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def main_chat(request):
    """
    Main chat endpoint - compatible with aiChatService frontend.
    Uses PETer_Agent.run_workflow under the hood; persists OpenAI session_id and messages in DB.
    """
    try:
        # 1. Parse request
        user_message = request.data.get('message')
        conversation_id = request.data.get('conversationId')
        frontend_session_id = request.data.get('session_id')  # Accept session_id from frontend
        context = request.data.get('context', {})

        print(f"[main_chat] Received request - conversationId: {conversation_id}, frontend_session_id: {frontend_session_id}")
        logger.info(f"[main_chat] Received request - conversationId: {conversation_id}, frontend_session_id: {frontend_session_id}")

        if not user_message:
            return Response({
                'error': '訊息不能為空',
                'response': '請輸入訊息',
                'source': 'error',
                'confidence': 0.0
            }, status=status.HTTP_400_BAD_REQUEST)

        # 2. Resolve existing DB thread
        thread = None
        openai_session_id = None
        is_new = True
        if conversation_id:
            try:
                thread = AgentThread.objects.get(id=conversation_id, user=request.user, is_active=True)
                openai_session_id = thread.thread_id  # may be conv-* or placeholder
                is_new = False
                print(f"[main_chat] Found thread: {thread.id}, thread_id={openai_session_id}")
                logger.info(f"Existing conversation {conversation_id} maps to session {openai_session_id}")
            except AgentThread.DoesNotExist:
                print(f"[main_chat] Thread not found for conversation_id: {conversation_id}")
                logger.info(f"Conversation id {conversation_id} not found; will create new thread")
        
        # 3. Prioritize session_id from frontend if provided (to handle reloaded conversations)
        # Frontend extracts this from message history when loading a conversation
        print(f"[main_chat] Before check: frontend_session_id={frontend_session_id}, type={type(frontend_session_id)}")
        if frontend_session_id and isinstance(frontend_session_id, str) and frontend_session_id.startswith('conv_'):
            openai_session_id = frontend_session_id
            print(f"[main_chat] ✓ Using session_id from frontend: {openai_session_id}")
            logger.info(f"✓ Using session_id from frontend: {openai_session_id}")
        else:
            print(f"[main_chat] ✗ Not using frontend session_id")
            logger.info(f"✗ Not using frontend session_id (value: {frontend_session_id}, type: {type(frontend_session_id)})")

        # 4. Run agent (only pass valid conv_* session id)
        session_id_for_agent = openai_session_id if (isinstance(openai_session_id, str) and openai_session_id.startswith('conv_')) else None
        print(f"[main_chat] → Passing session_id_for_agent to PETer: {session_id_for_agent}")
        logger.info(f"→ Passing session_id_for_agent to PETer: {session_id_for_agent}")
        result = _run_agent_plug_and_play(user_message, str(request.user.id), request.user.username, session_id_for_agent)

        if 'error' in result:
            err_payload = dict(result)
            err_payload.setdefault('response', '抱歉，我暫時無法處理您的請求。請稍後再試。')
            err_payload.setdefault('conversationId', conversation_id)
            return Response(err_payload, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        # 5. Extract structured fields
        operations = result.get('operations', [])
        tutorial = result.get('tutorial')
        has_calculator = result.get('has_calculator', False)
        operation_type = result.get('operation_type')
        recommended_users = result.get('recommended_users', [])
        recommended_social_posts = result.get('recommended_social_posts', {})
        recommended_forum_posts = result.get('recommended_forum_posts', {})

        returned_session_id = result.get('session_id')
        logger.info(f"Agent returned session_id={returned_session_id}")

        # 6. Persist thread if new and valid session id
        if is_new and returned_session_id and returned_session_id.startswith('conv_'):
            title = _generate_conversation_title(user_message, tutorial, operation_type)
            thread = AgentThread.objects.create(user=request.user, thread_id=returned_session_id, title=title)
            conversation_id = thread.id
            logger.info(f"Created new thread {conversation_id} for session {returned_session_id}")
        elif is_new and not (returned_session_id and returned_session_id.startswith('conv_')):
            logger.warning("New conversation but no valid session_id yet; will defer creation until next valid response")
        elif thread and returned_session_id and returned_session_id.startswith('conv_') and thread.thread_id != returned_session_id:
            if str(thread.thread_id).startswith('sess_pending_') or not thread.thread_id.startswith('conv_'):
                thread.thread_id = returned_session_id
                thread.save(update_fields=['thread_id', 'updated_at'])
                logger.info("Upgraded placeholder session id -> real conv id")

        # 7. Improve generic title
        if thread:
            generic_titles = {'新對話', '對話', 'Conversation', 'New Chat'}
            if (thread.title in generic_titles) or (thread.title and len(thread.title) <= 3):
                new_title = _generate_conversation_title(user_message, tutorial, operation_type)
                if new_title and new_title != thread.title:
                    thread.title = new_title
                    thread.save(update_fields=['title', 'updated_at'])
                    logger.info(f"Updated conversation title to {new_title}")

        # 8. Normalize recommended post dates (supports dict or list, preserves shape)
        def _normalize_post_dates(posts):
            # Normalize a single post dict in place
            def _norm_one(p):
                if not isinstance(p, dict):
                    return p
                ts = (
                    p.get('created_at') or p.get('post_date') or p.get('createdAt') or p.get('postDate') or
                    p.get('timestamp') or p.get('posted_at') or p.get('published_at')
                )
                if ts:
                    p['created_at'] = ts
                return p

            if isinstance(posts, dict):
                for _pid, _post in posts.items():
                    if isinstance(_post, dict):
                        posts[_pid] = _norm_one(_post)
                return posts
            if isinstance(posts, list):
                return [_norm_one(p) for p in posts if isinstance(p, dict)]
            return posts

        recommended_social_posts = _normalize_post_dates(recommended_social_posts)
        recommended_forum_posts = _normalize_post_dates(recommended_forum_posts)

        # 9. Persist messages
        if thread:
            AgentMessage.objects.create(conversation=thread, role='user', content=user_message)
            if not operation_type and operations:
                operation_type = operations[0].get('type')
            response_payload = {
                'response': result.get('response', ''),
                'operations': operations,
                'tutorial': tutorial,
                'hasCalculator': has_calculator,
                'operationType': operation_type,
                'recommendedUsers': recommended_users,
                'recommendedSocialPosts': recommended_social_posts,
                'recommendedForumPosts': recommended_forum_posts,
                'session_id': returned_session_id,
                'conversationId': conversation_id,
            }
            response_payload.setdefault('pendingOperation', None)
            AgentMessage.objects.create(
                conversation=thread,
                role='assistant',
                content=result.get('response', ''),
                has_tutorial=bool(tutorial) if tutorial is not None else False,
                tutorial_type=tutorial,
                has_calculator=has_calculator,
                operation_type=operation_type,
                additional_data={
                    'recommendedUsers': recommended_users,
                    'recommendedSocialPosts': recommended_social_posts,
                    'recommendedForumPosts': recommended_forum_posts,
                    'operations': operations,
                    'operationParams': {},
                    'message_data': response_payload,
                }
            )
        else:
            response_payload = {
                'response': result.get('response', ''),
                'operations': operations,
                'tutorial': tutorial,
                'hasCalculator': has_calculator,
                'operationType': operation_type,
                'recommendedUsers': recommended_users,
                'recommendedSocialPosts': recommended_social_posts,
                'recommendedForumPosts': recommended_forum_posts,
                'session_id': returned_session_id,
                'conversationId': conversation_id,
                'pendingOperation': None,
                'warning': 'Session not yet established; conversation not persisted until valid session_id (conv_) is returned.'
            }

        logger.info(f"Main chat response ready (session={returned_session_id}, convId={conversation_id})")
        return Response(response_payload, status=status.HTTP_200_OK)
    except Exception as e:
        logger.error(f"Unexpected error in main_chat: {e}", exc_info=True)
        return Response({
            'response': '抱歉，我暫時無法處理您的請求。請稍後再試。',
            'conversationId': conversation_id,
            'error': f'處理請求時發生錯誤: {e}',
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


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
    