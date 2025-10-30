# Backend AI Agent Response Format

## Overview
This document specifies the exact JSON format that the frontend operation client expects from the backend AI Agent API.

## API Endpoint
- **URL**: `/api/v1/ai/chat/`
- **Method**: `POST`
- **Content-Type**: `application/json`

## Request Format (from Frontend)
```json
{
  "message": "User's message text",
  "conversationId": "optional-conversation-uuid",
  "context": {
    "conversationHistory": [],
    "lastIntent": "previous_intent",
    "timestamp": "2025-10-27T10:30:00.000Z"
  }
}
```

## Response Format (Backend Must Return)

### Basic Response (No Operations)
```json
{
  "response": "AI's text response to the user",
  "conversationId": "uuid-for-conversation-tracking",
  "intent": "detected_intent",
  "confidence": 0.95
}
```

### Response with Operations
```json
{
  "response": "AI's text response to the user",
  "conversationId": "uuid-for-conversation-tracking",
  "intent": "detected_intent",
  "confidence": 0.95,
  "operations": [
    {
      "operation_id": "unique-uuid-or-string",
      "type": "navigate",
      "params": {
        "path": "/social",
        "state": {}
      },
      "requires_confirmation": false
    },
    {
      "operation_id": "unique-uuid-or-string-2",
      "type": "fill_form",
      "params": {
        "username": "john_doe",
        "email": "john@example.com",
        "bio": "Hello world"
      },
      "requires_confirmation": true
    }
  ]
}
```

## Operations Array Specification

### Required Fields (Every Operation)
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `operation_id` | `string` | ✅ Yes | Unique identifier (use UUID or timestamp-based) |
| `type` | `string` | ✅ Yes | Must be one of: `navigate`, `fill_form`, `click`, `display_data` |
| `params` | `object` | ✅ Yes | Parameters specific to operation type |
| `requires_confirmation` | `boolean` | ⚠️ Optional | If `true`, user must manually confirm before execution. Default: `false` |

### Operation Types and Parameters

#### 1. Navigate Operation
Navigate to a different page in the application.

```json
{
  "operation_id": "nav-123",
  "type": "navigate",
  "params": {
    "path": "/social",           // Required: Target route path
    "state": {                   // Optional: Data to pass to target page
      "userId": 123,
      "source": "ai_recommendation"
    }
  },
  "requires_confirmation": false
}
```

**Valid Paths Examples:**
- `/social` - Social feed
- `/pets` - Pet management
- `/profile` - User profile
- `/auctions` - Auction listings
- `/calculator` - Health calculator
- `/operation-test` - Operation test page

---

#### 2. Fill Form Operation
Fill out form fields on the current page.

```json
{
  "operation_id": "form-456",
  "type": "fill_form",
  "params": {
    "fieldName1": "value1",     // Field identifier: value to fill
    "fieldName2": "value2",
    "email": "user@example.com",
    "password": "secret123",
    "age": "25"
  },
  "requires_confirmation": true
}
```

**How Field Matching Works:**
The system tries to find form elements using (in order):
1. `name` attribute: `<input name="email" />`
2. `id` attribute: `<input id="email" />`
3. `placeholder` attribute: `<input placeholder="Enter email" />`

**Supported Field Types:**
- Text inputs
- Text areas
- Select dropdowns
- Checkboxes (value should be `true`/`false`)
- Radio buttons

---

#### 3. Click Operation
Click a button or interactive element.

```json
{
  "operation_id": "click-789",
  "type": "click",
  "params": {
    "selector": "#submit-button",  // CSS selector (preferred)
    "text": "Submit"               // Or button text to search for
  },
  "requires_confirmation": false
}
```

**Parameter Options:**
- Use `selector` (CSS selector) for precise targeting
- Use `text` (button text) for fuzzy matching
- Can provide both (selector tried first)

**Examples:**
```json
// By CSS selector
{"selector": "#login-btn"}
{"selector": ".submit-form"}
{"selector": "button[type='submit']"}

// By text content
{"text": "Login"}
{"text": "Submit Form"}
{"text": "Next"}
```

---

#### 4. Display Data Operation
Show structured data to the user (triggers a custom event for UI components to handle).

```json
{
  "operation_id": "display-999",
  "type": "display_data",
  "params": {
    "message": "Here's your health report",
    "reportData": {
      "bmi": 22.5,
      "status": "healthy",
      "recommendation": "Maintain current habits"
    },
    "chartData": [1, 2, 3, 4, 5]
  },
  "requires_confirmation": false
}
```

**Note:** The `params` object can contain any data structure. Frontend components can listen to the `displayOperationData` custom window event to receive this data.

---

## Complete Example Response

### Scenario: User asks AI to help them create a social post

```json
{
  "response": "I'll help you create a social post! I'm navigating to the social page and will fill out the form for you.",
  "conversationId": "conv-8e3a4b2c-1234-5678-9abc-def012345678",
  "intent": "create_social_post",
  "confidence": 0.92,
  "operations": [
    {
      "operation_id": "op-1234567890-nav",
      "type": "navigate",
      "params": {
        "path": "/social",
        "state": {
          "source": "ai_assist",
          "action": "create_post"
        }
      },
      "requires_confirmation": false
    },
    {
      "operation_id": "op-1234567890-fill",
      "type": "fill_form",
      "params": {
        "title": "My Amazing Day!",
        "content": "Today was wonderful! I went to the park with my pet.",
        "category": "daily_life"
      },
      "requires_confirmation": true
    },
    {
      "operation_id": "op-1234567890-click",
      "type": "click",
      "params": {
        "selector": "#publish-button",
        "text": "Publish Post"
      },
      "requires_confirmation": true
    }
  ]
}
```

---

## Validation Rules

### Operations Array Validation
1. Must be an array (even if empty): `[]`
2. Each operation must have all required fields
3. `type` must be one of the 4 valid types
4. `operation_id` must be unique within the array
5. `params` must be an object (not null or array)

### Frontend Handling
- ✅ Valid operations are added to the queue
- ❌ Invalid operations are rejected and logged to console
- 📊 Frontend tracks: success count, failed count
- 🔔 UI shows operation count indicator

---

## Python Django Example

```python
import uuid
from rest_framework.decorators import api_view
from rest_framework.response import Response

@api_view(['POST'])
def ai_chat_view(request):
    user_message = request.data.get('message')
    conversation_id = request.data.get('conversationId')
    
    # Your AI processing logic here...
    ai_response_text = process_with_ai(user_message)
    detected_intent = detect_intent(user_message)
    
    # Determine if operations are needed
    operations = []
    
    if detected_intent == "navigate_to_social":
        operations.append({
            "operation_id": str(uuid.uuid4()),
            "type": "navigate",
            "params": {
                "path": "/social"
            },
            "requires_confirmation": False
        })
    
    elif detected_intent == "create_post":
        operations.extend([
            {
                "operation_id": str(uuid.uuid4()),
                "type": "navigate",
                "params": {"path": "/social"},
                "requires_confirmation": False
            },
            {
                "operation_id": str(uuid.uuid4()),
                "type": "fill_form",
                "params": {
                    "title": "Post title",
                    "content": "Post content"
                },
                "requires_confirmation": True
            }
        ])
    
    # Build response
    response_data = {
        "response": ai_response_text,
        "conversationId": conversation_id or str(uuid.uuid4()),
        "intent": detected_intent,
        "confidence": 0.95
    }
    
    # Add operations if any
    if operations:
        response_data["operations"] = operations
    
    return Response(response_data)
```

---

## Testing Your Backend

### Method 1: Use Frontend Test Page
1. Navigate to `http://localhost:5173/operation-test`
2. Click "Simulate Backend Response"
3. Verify operations appear in queue

### Method 2: Use Browser Console
```javascript
// Simulate a backend response
window.operationClientTest.simulateBackendResponse();

// Check queue status
window.operationClientTest.checkStatus();
```

### Method 3: Test via Actual API
1. Send POST request to your backend endpoint
2. Check browser console for operation logs
3. Look for: `[AIChatService] Received operations from backend`

---

## Common Mistakes to Avoid

❌ **Wrong structure:**
```json
{
  "response": "Hello",
  "operations": "navigate to /social"  // Should be an array!
}
```

❌ **Missing required fields:**
```json
{
  "response": "Hello",
  "operations": [
    {
      "type": "navigate"  // Missing operation_id and params!
    }
  ]
}
```

❌ **Invalid operation type:**
```json
{
  "response": "Hello",
  "operations": [
    {
      "operation_id": "123",
      "type": "submit_form",  // Should be "fill_form" or "click"
      "params": {}
    }
  ]
}
```

✅ **Correct structure:**
```json
{
  "response": "Navigating to social page!",
  "conversationId": "conv-123",
  "operations": [
    {
      "operation_id": "nav-456",
      "type": "navigate",
      "params": {
        "path": "/social"
      },
      "requires_confirmation": false
    }
  ]
}
```

---

## Integration Checklist

- [ ] Backend returns `operations` as an array (or omits it entirely)
- [ ] Each operation has `operation_id`, `type`, and `params`
- [ ] `operation_id` is unique (use UUID)
- [ ] `type` is one of: `navigate`, `fill_form`, `click`, `display_data`
- [ ] `params` matches the expected structure for operation type
- [ ] Test with frontend at `/operation-test` page
- [ ] Check browser console for operation logs
- [ ] Verify operations appear in queue indicator

---

## Questions or Issues?

If operations are not working:
1. Check browser console for error messages
2. Verify response format matches this specification
3. Test with the operation test page at `/operation-test`
4. Use `window.operationClientTest.help()` in console for testing utilities
