# Backend AI Agent Response Format (AI App)

## Required Fields (Always Present)

```json
{
  "response": "AI's text response to the user",
  "conversationId": "uuid-or-null",
  
  "hasTutorial": false,
  "hasCalculator": false,
  
  "operations": [],
  
  "recommendedUsers": {},
  "recommendedSocialPosts": {},
  "recommendedForumPosts": {}
}
```

**Note:** 
- The `hasRecommendedUsers`, `hasRecommendedArticles`, and `hasOperation` flags have been removed. 
- The frontend derives these by checking the data:
  - `hasRecommendedUsers` = `Object.keys(recommendedUsers).length > 0`
  - `hasRecommendedArticles` = `Object.keys(recommendedSocialPosts).length > 0 || Object.keys(recommendedForumPosts).length > 0`
  - `hasOperation` = `operations.length > 0`
- **Recommendation dictionaries and operations array are ALWAYS returned** (even if empty) for consistency
- Each post object inside `recommendedSocialPosts` and `recommendedForumPosts` includes a `created_at` ISO timestamp. The backend normalizes possible variants (`post_date`, `createdAt`, etc.) to `created_at` for frontend compatibility.

## Optional Fields (Only When Applicable)

```json
{
  "operationType": "navigate | create_post | search | fill_form | click | display_data",
  "tutorialType": "health | training | nutrition",
  "recommendedUsers": {
    "1": {
      "user_account": "username1",
      "user_fullname": "Full Name",
      "headshot_url": "url",
      "user_intro": "intro",
      "account_privacy": "public"
    }
  },
  "recommendedSocialPosts": {
    "10": {
      "id": 10,
      "author": {...},
      "content": "post content",
      "location": "location",
      "created_at": "timestamp",
      "likes": 5,
      "comments_count": 3
    }
  },
  "recommendedForumPosts": {
    "20": {
      "id": 20,
      "archive_id": 123,
      "archive_title": "title",
      "author": {...},
      "content": "full content",
      "pet_info": {...},
      "health_status": "status",
      "go_to_doctor": true,
      "created_at": "timestamp",
      "likes": 10,
      "comments_count": 5
    }
  },
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

### Example 1: Simple Response (No Recommendations)
```json
{
  "response": "您的寵物聽起來很健康！",
  "conversationId": "abc-123",
  "hasTutorial": false,
  "hasCalculator": false,
  "operations": [],
  "recommendedUsers": {},
  "recommendedSocialPosts": {},
  "recommendedForumPosts": {}
}
```

### Example 2: Response with User Recommendations
```json
{
  "response": "這些用戶也養了柴犬，您可以參考他們的經驗！",
  "conversationId": "abc-123",
  "hasTutorial": false,
  "hasCalculator": false,
  "recommendedUsers": {
    "1": {
      "user_account": "shiba_lover",
      "user_fullname": "柴犬愛好者",
      "headshot_url": "https://example.com/avatar1.jpg",
      "user_intro": "養了三隻柴犬的鏟屎官",
      "account_privacy": "public"
    },
    "2": {
      "user_account": "pet_expert",
      "user_fullname": "寵物專家",
      "headshot_url": "https://example.com/avatar2.jpg",
      "user_intro": "專業寵物訓練師",
      "account_privacy": "public"
    }
  },
  "operations": []
}
```

### Example 3: Response with Article Recommendations
```json
{
  "response": "我找到了一些相關的疾病案例分享。",
  "conversationId": "abc-123",
  "hasTutorial": false,
  "hasCalculator": false,
  "recommendedSocialPosts": {
    "10": {
      "id": 10,
      "author": {
        "username": "user1",
        "fullname": "使用者一",
        "avatar": "https://example.com/avatar.jpg"
      },
      "content": "我家狗狗最近食慾不振...",
      "location": "台北市",
      "created_at": "2025-10-30T10:00:00Z",
      "likes": 15,
      "comments_count": 8
    }
  },
  "recommendedForumPosts": {
    "20": {
      "id": 20,
      "archive_id": 5,
      "archive_title": "狗狗皮膚病治療記錄",
      "author": {
        "username": "user2",
        "fullname": "使用者二",
        "avatar": "https://example.com/avatar2.jpg"
      },
      "content": "完整的治療過程記錄...",
      "pet_info": {
        "name": "小白",
        "type": "狗",
        "breed": "柴犬"
      },
      "health_status": "已康復",
      "go_to_doctor": true,
      "created_at": "2025-10-28T15:30:00Z",
      "likes": 25,
      "comments_count": 12
    }
  },
  "operations": []
}
```

### Example 4: Response with Operations
```json
{
  "response": "我會幫您導航到社群頁面。",
  "conversationId": "abc-123",
  "hasTutorial": false,
  "hasCalculator": false,
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
  ],
  "recommendedUsers": {},
  "recommendedSocialPosts": {},
  "recommendedForumPosts": {}
}
```

**Note:** When `operations.length > 0`, the frontend displays operation buttons. The `operationType` field helps identify the primary operation type for legacy compatibility.

### Example 5: Error Response
```json
{
  "error": "處理請求時發生錯誤",
  "response": "抱歉，我暫時無法處理您的請求。",
  "conversationId": null,
  "hasTutorial": false,
  "hasCalculator": false,
  "operations": [],
  "recommendedUsers": {},
  "recommendedSocialPosts": {},
  "recommendedForumPosts": {}
}
```

## How It Works

The AI app uses the OpenAI Agents SDK with MCP (Model Context Protocol) tools:

1. **User sends message** → Frontend → `ai/views.py`
2. **Backend calls MCP server** → OpenAI Agent uses MCP tools (`get_post_recommendations`, `get_user_information`, etc.)
3. **MCP tools return data** → Agent formats response text
4. **Backend enhances response** → Adds structured data in dictionary format
5. **Frontend receives** → Displays message + recommendations

## MCP Tool Integration

The agent can call these MCP tools:
- `get_post_recommendations` - Returns social/forum posts
- `get_user_information` - Returns user details
- `get_user_pet_info_detailed` - Returns user's pet info
- `get_user_pet_types` - Returns pet types
- `get_pet_foods_details` - Returns pet food information

When these tools are called, the backend automatically extracts and formats the data into the dictionary structure described above.
