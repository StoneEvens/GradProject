# ChatKit Backend Integration Guide

## Overview
This guide explains how to implement the backend endpoint required for ChatKit session management. The frontend ChatKit component needs a `client_secret` from OpenAI to establish a session.

## Required Endpoint

### POST `/api/v1/ai/chatkit/session`

This endpoint should create a ChatKit session with OpenAI and return a `client_secret`.

## Implementation (Django)

### 1. Install OpenAI Python SDK

```bash
pip install openai
```

### 2. Create the View

Add this to `backend/aiAgent/views.py`:

```python
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.conf import settings
import openai

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def chatkit_session(request):
    """
    Create a ChatKit session and return client_secret
    
    This endpoint is called by the frontend ChatKit component to establish
    a session with OpenAI's servers.
    """
    try:
        # Initialize OpenAI client
        client = openai.OpenAI(api_key=settings.OPENAI_API_KEY)
        
        # Create a ChatKit session
        # Note: You need to have an assistant created in your OpenAI dashboard
        session = client.chat.sessions.create(
            assistant_id=settings.OPENAI_ASSISTANT_ID,  # Your assistant ID
            metadata={
                'user_id': str(request.user.id),
                'username': request.user.username,
            }
        )
        
        return Response({
            'client_secret': session.client_secret,
            'session_id': session.id,
        })
        
    except openai.OpenAIError as e:
        return Response(
            {'error': f'OpenAI API error: {str(e)}'},
            status=500
        )
    except Exception as e:
        return Response(
            {'error': f'Unexpected error: {str(e)}'},
            status=500
        )
```

### 3. Add URL Route

Add to `backend/aiAgent/urls.py`:

```python
from django.urls import path
from . import views

urlpatterns = [
    # ... existing routes ...
    
    # ChatKit session endpoint
    path('chatkit/session', views.chatkit_session, name='chatkit-session'),
]
```

### 4. Configure Settings

Add to `backend/gradProject/settings.py`:

```python
# OpenAI Configuration
OPENAI_API_KEY = os.environ.get('OPENAI_API_KEY', '')
OPENAI_ASSISTANT_ID = os.environ.get('OPENAI_ASSISTANT_ID', '')
```

### 5. Set Environment Variables

Add to your `.env` file:

```bash
OPENAI_API_KEY=sk-your-api-key-here
OPENAI_ASSISTANT_ID=asst_your-assistant-id-here
```

## Creating an Assistant with Actions

To make your ChatKit assistant generate operations, you need to define **Actions** in your OpenAI assistant configuration.

### 1. Create Assistant in OpenAI Dashboard

Go to https://platform.openai.com/assistants and create a new assistant.

### 2. Define Actions (Tools)

Add these actions to your assistant:

#### Action 1: Navigate to Page

```json
{
  "name": "navigate_to_page",
  "description": "Navigate to a different page in the application",
  "parameters": {
    "type": "object",
    "properties": {
      "path": {
        "type": "string",
        "description": "The route path (e.g., /social, /pets, /profile)",
        "enum": ["/social", "/pets", "/profile", "/auctions", "/calculator", "/"]
      },
      "requires_confirmation": {
        "type": "boolean",
        "description": "Whether to require user confirmation",
        "default": false
      }
    },
    "required": ["path"]
  }
}
```

#### Action 2: Fill Form

```json
{
  "name": "fill_form",
  "description": "Fill out form fields on the current page",
  "parameters": {
    "type": "object",
    "properties": {
      "fields": {
        "type": "object",
        "description": "Field name to value mapping",
        "additionalProperties": {"type": "string"}
      },
      "requires_confirmation": {
        "type": "boolean",
        "default": true
      }
    },
    "required": ["fields"]
  }
}
```

#### Action 3: Click Element

```json
{
  "name": "click_element",
  "description": "Click a button or element",
  "parameters": {
    "type": "object",
    "properties": {
      "selector": {
        "type": "string",
        "description": "CSS selector"
      },
      "text": {
        "type": "string",
        "description": "Button text"
      },
      "requires_confirmation": {
        "type": "boolean",
        "default": true
      }
    }
  }
}
```

#### Action 4: Display Data

```json
{
  "name": "display_data",
  "description": "Display information to the user",
  "parameters": {
    "type": "object",
    "properties": {
      "message": {
        "type": "string",
        "description": "Message to display"
      },
      "data": {
        "type": "object",
        "description": "Additional data"
      }
    },
    "required": ["message"]
  }
}
```

### 3. Implement Action Handlers

When ChatKit calls an action, your backend needs to handle it and return operations. Update your view:

```python
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def chatkit_action_handler(request):
    """
    Handle ChatKit action calls and convert to operations
    """
    action_name = request.data.get('action_name')
    action_params = request.data.get('parameters', {})
    
    # Convert action to operation format
    if action_name == 'navigate_to_page':
        operation = {
            'operation_id': f'nav-{uuid.uuid4()}',
            'type': 'navigate',
            'params': {
                'path': action_params.get('path'),
                'state': {'source': 'chatkit'}
            },
            'requires_confirmation': action_params.get('requires_confirmation', False)
        }
    elif action_name == 'fill_form':
        operation = {
            'operation_id': f'form-{uuid.uuid4()}',
            'type': 'fill_form',
            'params': action_params.get('fields', {}),
            'requires_confirmation': action_params.get('requires_confirmation', True)
        }
    elif action_name == 'click_element':
        operation = {
            'operation_id': f'click-{uuid.uuid4()}',
            'type': 'click',
            'params': {
                'selector': action_params.get('selector'),
                'text': action_params.get('text')
            },
            'requires_confirmation': action_params.get('requires_confirmation', True)
        }
    elif action_name == 'display_data':
        operation = {
            'operation_id': f'display-{uuid.uuid4()}',
            'type': 'display_data',
            'params': {
                'message': action_params.get('message'),
                **action_params.get('data', {})
            },
            'requires_confirmation': False
        }
    else:
        return Response({'error': 'Unknown action'}, status=400)
    
    return Response({
        'success': True,
        'operation': operation
    })
```

## Frontend Integration

The ChatKit component will automatically:
1. Call `/api/v1/ai/chatkit/session` to get `client_secret`
2. Establish connection with OpenAI
3. When AI calls actions, send them to your operation queue
4. Display the chat interface

## Testing Without Backend

If you want to test the frontend before implementing the backend:

1. Navigate to `http://localhost:5173/operation-test` instead
2. Use the manual test page to add operations
3. Implement backend when ready

## Alternative: Mock Endpoint for Testing

Create a temporary mock endpoint:

```python
@api_view(['POST'])
def chatkit_session_mock(request):
    """
    Mock endpoint for testing ChatKit UI
    Returns a fake client_secret
    """
    return Response({
        'client_secret': 'mock_secret_for_testing_only',
        'session_id': 'mock_session_id',
        'note': 'This is a mock endpoint. Implement real OpenAI integration.'
    })
```

**Note:** This will allow the UI to load, but ChatKit won't actually work until you implement real OpenAI integration.

## Cost Considerations

**ChatKit Sessions:**
- Each session has a cost based on messages sent/received
- Actions (function calls) count toward token usage
- Monitor usage in OpenAI dashboard

**Estimated Costs (GPT-4o):**
- ~500 tokens per conversation turn
- ~$0.01 per message
- Actions add ~100-200 tokens

## Security Best Practices

1. **Authentication Required**: Always use `@permission_classes([IsAuthenticated])`
2. **Rate Limiting**: Implement rate limits on session creation
3. **Session Validation**: Validate session belongs to requesting user
4. **API Key Security**: Never expose API key to frontend
5. **Action Validation**: Validate all action parameters before converting to operations

## Troubleshooting

### "Failed to get session: 401"
- Check OPENAI_API_KEY is set correctly
- Verify API key is valid

### "Failed to get session: 404"
- Check assistant_id exists
- Verify assistant is in your OpenAI account

### Actions Not Working
- Ensure actions are defined in assistant configuration
- Check action handler endpoint is implemented
- Verify operation format matches frontend expectations

## Resources

- [OpenAI Assistants API](https://platform.openai.com/docs/assistants)
- [ChatKit Documentation](https://platform.openai.com/docs/guides/chatkit)
- [OpenAI Python SDK](https://github.com/openai/openai-python)

---

**Next Steps:**
1. Create OpenAI assistant with actions
2. Implement session endpoint
3. Test with frontend at `/chatkit-test`
4. Monitor operation queue functionality
