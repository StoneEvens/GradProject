# AI Agent Setup Guide

## Architecture
The AI Agent system consists of three main components that must all be running:

1. **MCP Server** - Controls the browser via Playwright
2. **Django Backend** - Integrates AI Controller with your application
3. **Frontend** - User interface for AI interactions

## Setup Steps

### 1. Environment Configuration

Create a `.env` file in your project root:

```env
# OpenAI API
OPENAI_API_KEY=your_openai_api_key_here

# MCP Server Configuration
MCP_API_KEY=your_secure_mcp_key_here
MCP_SERVER_URL=http://localhost:5000

# Frontend Configuration
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173
```

### 2. Install Dependencies

```bash
# Install MCP server dependencies
pip install -r AgentTest/mcp_requirements.txt

# Install Playwright browsers
playwright install
```

### 3. Start the MCP Server

Open a terminal and run:

```bash
cd AgentTest
python mcp_server.py
```

This will start the MCP server on http://localhost:5000

### 4. Update Django Backend

#### A. Add AI Assistant URLs to your main urls.py:

```python
# In backend/config/urls.py or your main urls.py
from django.urls import path, include

urlpatterns = [
    # ... existing urls ...
    path('api/ai/', include('aiAgent.ai_assist_urls')),
]
```

#### B. Ensure CORS settings allow your frontend:

```python
# In backend/config/settings.py
CORS_ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:5173",
]
```

### 5. Start Django Backend

```bash
cd backend
python manage.py runserver
```

This will start Django on http://localhost:8000 (default)

### 6. Start Frontend

```bash
cd frontend
npm run dev
```

This will start your Vue frontend

## Usage

### From Frontend (Vue Component)

```javascript
import { useAIAssistant } from '@/services/aiAssistant';

export default {
  setup() {
    const { sendRequest, isProcessing } = useAIAssistant();

    const handleAICommand = async () => {
      try {
        const result = await sendRequest("Navigate to pets page and add a new pet named Max");
        console.log('AI result:', result);
      } catch (error) {
        console.error('Error:', error);
      }
    };

    return { handleAICommand, isProcessing };
  }
};
```

### Example AI Commands

The AI Agent can understand natural language commands like:

- "Add a new pet named Max"
- "Create a health report for my dog"
- "Navigate to the social feed and create a post"
- "Show me my pet's health reports"
- "Go to the interactive city page"

## Testing

### 1. Check MCP Server Status

```bash
curl -H "X-API-Key: your_mcp_key" http://localhost:5000/session/create
```

### 2. Check Backend AI Status

```bash
curl -H "Authorization: Bearer your_token" http://localhost:8000/api/ai/status/
```

### 3. Send Test Request

```bash
curl -X POST http://localhost:8000/api/ai/assist/ \
  -H "Authorization: Bearer your_token" \
  -H "Content-Type: application/json" \
  -d '{"request": "Navigate to home page"}'
```

## Troubleshooting

### Issue: MCP Server won't start
- Check if port 5000 is already in use
- Verify Playwright is installed: `playwright install`

### Issue: AI Controller import error
- Make sure AgentTest directory is in Python path
- Verify ai_controller.py has no syntax errors

### Issue: OpenAI API errors
- Verify your OPENAI_API_KEY is set correctly
- Check your OpenAI account has credits
- Ensure you're using a supported model (gpt-4-1106-preview)

### Issue: Browser control not working
- Verify MCP server is running on port 5000
- Check MCP_API_KEY matches in both client and server
- Ensure website_features.json has correct selectors

## Running All Services

You need 3 terminals running simultaneously:

**Terminal 1 - MCP Server:**
```bash
cd AgentTest
python mcp_server.py
```

**Terminal 2 - Django Backend:**
```bash
cd backend
python manage.py runserver
```

**Terminal 3 - Frontend:**
```bash
cd frontend
npm run dev
```

## Security Notes

- Always use HTTPS in production
- Store API keys in environment variables, never in code
- Implement rate limiting for AI requests
- Validate and sanitize all user inputs
- Use strong MCP_API_KEY in production