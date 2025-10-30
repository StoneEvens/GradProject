# ChatKit Django Implementation - Setup Guide

## ✅ Implementation Complete

The ChatKit session endpoint has been successfully implemented in Django using the `ai` app.

## Files Created/Modified

### 1. `backend/ai/views.py` ✨
- Implemented `create_chatkit_session` view
- Django REST Framework API view with authentication
- Creates OpenAI ChatKit sessions
- Returns `client_secret` for frontend

### 2. `backend/ai/urls.py` ✨
- Created URL routing for ai app
- Route: `chatkit/session` → `create_chatkit_session`

### 3. `backend/gradProject/urls.py` ✏️
- Added `ai` app to URL patterns
- Full path: `/api/v1/ai/chatkit/session`

### 4. `backend/gradProject/settings.py` ✏️
- Added `ai` to `INSTALLED_APPS`
- Added OpenAI configuration section:
  - `OPENAI_API_KEY`
  - `OPENAI_ASSISTANT_ID`
  - `OPENAI_DEFAULT_MODEL`
  - `OPENAI_MAX_TOKENS`

## API Endpoint

### POST `/api/v1/ai/chatkit/session`

**Authentication:** Required (JWT Token)

**Headers:**
```
Authorization: Bearer <your_jwt_token>
Content-Type: application/json
```

**Request:** Empty POST body

**Response:**
```json
{
  "client_secret": "chatkit_session_secret_here",
  "session_id": "session_uuid_here"
}
```

**Error Response:**
```json
{
  "error": "Error message description"
}
```

## Setup Steps

### 1. Environment Variables

Create or update your `.env` file in the backend directory:

```bash
# OpenAI Configuration
OPENAI_API_KEY=sk-your-openai-api-key-here
OPENAI_ASSISTANT_ID=asst_your-assistant-id-here
```

**Get your API key:**
- Go to https://platform.openai.com/api-keys
- Create new secret key
- Copy and paste into `.env`

**Get your Assistant ID:**
- Go to https://platform.openai.com/assistants
- Create new assistant (see below)
- Copy the assistant ID (starts with `asst_`)

### 2. Create OpenAI Assistant

#### Step 1: Go to OpenAI Platform
Visit: https://platform.openai.com/assistants

#### Step 2: Create New Assistant
Click "Create" and configure:

**Name:** Pet App Assistant (or your choice)

**Instructions:**
```
You are a helpful AI assistant for a pet management web application. You can help users navigate the app, fill out forms, and perform actions.

Available pages:
- /social: Social feed with posts and interactions
- /pets: Pet management (view, add, edit pets)
- /profile: User profile page
- /auctions: Pet auction listings
- /calculator: Health calculator tools
- /: Home page

You can help users by:
1. Navigating to different pages
2. Filling out forms
3. Clicking buttons
4. Displaying information

Always be helpful and explain what you're doing.
```

**Model:** gpt-4o (recommended)

#### Step 3: Add Actions (Functions)

Add these 4 actions to your assistant:

**Action 1: navigate_to_page**
```json
{
  "name": "navigate_to_page",
  "description": "Navigate to a different page in the application",
  "parameters": {
    "type": "object",
    "properties": {
      "path": {
        "type": "string",
        "description": "The route path",
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

**Action 2: fill_form**
```json
{
  "name": "fill_form",
  "description": "Fill out form fields",
  "parameters": {
    "type": "object",
    "properties": {
      "fields": {
        "type": "object",
        "description": "Field name to value mapping"
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

**Action 3: click_element**
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

**Action 4: display_data**
```json
{
  "name": "display_data",
  "description": "Display information",
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

#### Step 4: Save and Get ID
- Click "Create"
- Copy the Assistant ID (starts with `asst_`)
- Add to your `.env` file

### 3. Load Environment Variables

Django will automatically load these from environment or `.env` file.

**For development, you can use python-dotenv:**

Already installed in requirements.txt. Create `.env` in backend directory:

```bash
# backend/.env
OPENAI_API_KEY=sk-your-key-here
OPENAI_ASSISTANT_ID=asst_your-id-here
```

### 4. Run Django Server

```bash
cd backend
python manage.py runserver
```

The endpoint will be available at:
```
http://localhost:8000/api/v1/ai/chatkit/session
```

## Testing the Endpoint

### Using curl:

```bash
# First, get a JWT token by logging in
curl -X POST http://localhost:8000/api/v1/accounts/login/ \
  -H "Content-Type: application/json" \
  -d '{"username":"your_username","password":"your_password"}'

# Use the token to create ChatKit session
curl -X POST http://localhost:8000/api/v1/ai/chatkit/session \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE" \
  -H "Content-Type: application/json"
```

### Using the Frontend:

1. Navigate to: `http://localhost:5173/chatkit-test`
2. The frontend will automatically call this endpoint
3. ChatKit UI will load
4. Start chatting with the AI!

## Code Explanation

### FastAPI vs Django Comparison

**Your FastAPI Code:**
```python
from fastapi import FastAPI
from pydantic import BaseModel
from openai import OpenAI
import os

app = FastAPI()
openai = OpenAI(api_key=os.environ["OPENAI_API_KEY"])

@app.post("/api/chatkit/session")
def create_chatkit_session():
    session = openai.chatkit.sessions.create({
      # ...
    })
    return { "client_secret": session.client_secret }
```

**Django Implementation:**
```python
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from openai import OpenAI
from django.conf import settings

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_chatkit_session(request):
    client = OpenAI(api_key=settings.OPENAI_API_KEY)
    session = client.chatkit.sessions.create({
        "assistant_id": settings.OPENAI_ASSISTANT_ID,
        "metadata": {
            "user_id": str(request.user.id),
            "username": request.user.username,
        }
    })
    return Response({
        'client_secret': session.client_secret,
        'session_id': session.id,
    })
```

**Key Differences:**
1. **Authentication**: Django uses DRF's `@permission_classes([IsAuthenticated])`
2. **Response**: Django uses `Response()` from DRF instead of returning dict
3. **Settings**: Django uses `settings.OPENAI_API_KEY` instead of `os.environ`
4. **User Context**: Django has `request.user` available for metadata
5. **Decorators**: Uses `@api_view(['POST'])` instead of `@app.post()`

## Troubleshooting

### Error: "OpenAI configuration missing"
- Check that `OPENAI_API_KEY` and `OPENAI_ASSISTANT_ID` are set in settings
- Verify environment variables are loaded
- Check `.env` file exists in backend directory

### Error: "Authentication credentials were not provided"
- Frontend needs to send JWT token in Authorization header
- User must be logged in
- Check that token is valid and not expired

### Error: "OpenAI API error"
- Verify API key is valid
- Check you have credits in OpenAI account
- Ensure assistant ID is correct
- Check OpenAI API status

### ChatKit not loading in frontend
- Check browser console for errors
- Verify endpoint returns `client_secret`
- Ensure CORS is configured correctly
- Check that ChatKit script is loaded in index.html

## Security Notes

🔒 **Important:**
- Never commit `.env` file to git
- Add `.env` to `.gitignore`
- Use environment variables in production
- Keep API keys secret
- Validate user permissions before creating sessions
- Monitor OpenAI API usage and costs

## Cost Monitoring

**ChatKit Usage:**
- Each session creation: minimal cost
- Messages: ~$0.01 per message (GPT-4o)
- Actions: additional tokens based on parameters

**Monitor at:**
https://platform.openai.com/usage

## Next Steps

1. ✅ Set environment variables
2. ✅ Create OpenAI assistant with actions
3. ✅ Test endpoint with curl or Postman
4. ✅ Test with frontend at `/chatkit-test`
5. ✅ Monitor operation queue functionality
6. ✅ Configure action handlers if needed

## Resources

- [OpenAI Platform](https://platform.openai.com/)
- [OpenAI Assistants](https://platform.openai.com/assistants)
- [ChatKit Documentation](https://platform.openai.com/docs/guides/chatkit)
- [Django REST Framework](https://www.django-rest-framework.org/)

---

**The endpoint is ready!** Set your environment variables and test it out! 🚀
