# Backend AI Agent Response Format

## Required Fields (Always Present)

```json
{
  "response": "AI's text response to the user",
  "source": "mcp_agent | ai_agent | error",
  "conversationId": "uuid-or-null",
  
  "hasTutorial": false,
  "hasRecommendedUsers": false,
  "hasRecommendedArticles": false,
  "hasCalculator": false,
  "hasOperation": false,
  
  "operations": []
}
```

## Optional Fields (Only When Applicable)

```json
{
  "operationType": "navigate | create_post | search | fill_form | click | display_data",
  "tutorialType": "health | training | nutrition",
  "recommendedUserIds": [1, 2, 3],
  "recommendedUserDetails": [...],
  "recommendedArticleIds": [10, 20, 30],
  "socialPostDetails": [...],
  "forumPostDetails": [...],
  "operationParams": {},
  "entities": {},
  "error": "Error message if applicable"
}
```

## Operations Array Format

Each operation in the `operations` array:

```json
{
  "operation_id": "unique-uuid-or-string",
  "type": "navigate | fill_form | click | display_data",
  "params": {
    // Type-specific parameters
  },
  "requires_confirmation": false
}
```

### Operation Types

**navigate:**
```json
{
  "operation_id": "op-123",
  "type": "navigate",
  "params": {
    "path": "/social",
    "state": {}
  },
  "requires_confirmation": false
}
```

**fill_form:**
```json
{
  "operation_id": "op-456",
  "type": "fill_form",
  "params": {
    "fieldName": "value",
    "email": "user@example.com"
  },
  "requires_confirmation": true
}
```

**click:**
```json
{
  "operation_id": "op-789",
  "type": "click",
  "params": {
    "selector": "#submit-button",
    "text": "Submit"
  },
  "requires_confirmation": false
}
```

**display_data:**
```json
{
  "operation_id": "op-012",
  "type": "display_data",
  "params": {
    "dataType": "calculation_result",
    "data": {
      "bmi": 22.5,
      "status": "healthy"
    }
  },
  "requires_confirmation": false
}
```

## Complete Examples

### Example 1: Simple Response
```json
{
  "response": "您的寵物聽起來很健康！",
  "source": "mcp_agent",
  "conversationId": "abc-123",
  "hasTutorial": false,
  "hasRecommendedUsers": false,
  "hasRecommendedArticles": false,
  "hasCalculator": false,
  "hasOperation": false,
  "operations": []
}
```

### Example 2: Response with Operations
```json
{
  "response": "我會幫您導航到社群頁面。",
  "source": "mcp_agent",
  "conversationId": "abc-123",
  "hasTutorial": false,
  "hasRecommendedUsers": false,
  "hasRecommendedArticles": false,
  "hasCalculator": false,
  "hasOperation": true,
  "operationType": "navigate",
  "operations": [
    {
      "operation_id": "op-1234567890",
      "type": "navigate",
      "params": {
        "path": "/social",
        "state": {"source": "ai_assist"}
      },
      "requires_confirmation": false
    }
  ]
}
```

### Example 3: Error Response
```json
{
  "error": "處理請求時發生錯誤",
  "response": "抱歉，我暫時無法處理您的請求。",
  "source": "error",
  "conversationId": null,
  "hasTutorial": false,
  "hasRecommendedUsers": false,
  "hasRecommendedArticles": false,
  "hasCalculator": false,
  "hasOperation": false,
  "operations": []
}
```