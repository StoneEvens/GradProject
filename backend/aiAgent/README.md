# AI Agent Service

完整的 AI 驅動聊天服務，整合 OpenAI API 與向量資料庫檢索。

## 架構概覽

```
使用者輸入 (Frontend)
    ↓
[aiChatService.js] → POST /api/v1/ai/chat/
    ↓
[AIAgentChatView] → Django REST API
    ↓
[IntentService] → 整合服務
    ├── [OpenAIService] → OpenAI API 調用
    │   ├── 意圖識別 (analyze_intent)
    │   └── 回應生成 (generate_response)
    ├── [VectorService] → BERT + FAISS 向量檢索
    │   ├── 生成查詢向量
    │   ├── 搜尋相似內容
    │   └── 檢索貼文/用戶
    └── [ResponseService] → 回應格式化
        ├── 格式化為前端格式
        ├── 豐富化貼文詳情
        └── 豐富化用戶推薦
    ↓
統一回應格式 → 返回前端
```

## 功能特色

### 1. **OpenAI 意圖識別**
使用 GPT-4o-mini 分析使用者自然語言輸入，識別五大類意圖：
- `operation`: 執行操作（查找記錄、設置提醒、搜尋醫院）
- `recommendation`: 推薦內容（用戶、文章）
- `tutorial`: 教學引導
- `feeding`: 飼料營養建議
- `general`: 一般對話

### 2. **向量資料庫檢索**
整合現有的 BERT + FAISS 系統：
- 使用 `bert-base-chinese` 生成文本嵌入
- FAISS 快速相似度搜尋
- 支援社交貼文（social_post）和論壇貼文（forum_post）

### 3. **智能回應生成**
根據意圖分析與檢索資料，使用 OpenAI 生成友善專業的回應。

### 4. **統一回應格式**
返回前端可直接使用的格式，包含 UI 控制標記和附加資料。

## 安裝與配置

### 1. 環境需求

```bash
pip install openai faiss-cpu transformers torch numpy
```

### 2. 配置 OpenAI API Key

在 `.env` 文件中添加：

```env
OPENAI_API_KEY=your_openai_api_key_here
```

或在 `settings.py` 中配置：

```python
OPENAI_API_KEY = 'your_openai_api_key_here'
OPENAI_MODEL = 'gpt-4o-mini'  # 或其他模型
```

### 3. 確保向量資料庫存在

確認以下文件存在於 backend 根目錄：
- `social_post_embs.npy`
- `social_post_ids.npy`
- `forum_post_embs.npy`
- `forum_post_ids.npy`

### 4. 添加 app 到 INSTALLED_APPS

已在 `settings.py` 中添加：
```python
INSTALLED_APPS = [
    ...
    'aiAgent',
    ...
]
```

### 5. 配置 URL

已在 `gradProject/urls.py` 中添加：
```python
path(f'{api_v1_prefix}ai/', include('aiAgent.urls')),
```

## API 端點

### POST `/api/v1/ai/chat/`

**請求**:
```json
{
  "message": "我家貓咪最近咳嗽，怎麼辦？",
  "context": {
    "petId": 1,
    "lastIntent": "health",
    "conversationHistory": []
  }
}
```

**回應**:
```json
{
  "response": "我了解您的擔憂。根據您的描述，以下是一些相關的文章和建議...",
  "source": "ai_agent",
  "confidence": 0.87,
  "intent": "recommendation",
  "hasTutorial": false,
  "tutorialType": null,
  "hasRecommendedUsers": false,
  "hasRecommendedArticles": true,
  "hasCalculator": false,
  "hasOperation": false,
  "operationType": null,
  "recommendedUserIds": [],
  "recommendedArticleIds": [15, 23, 42],
  "socialPostDetails": [...],
  "forumPostDetails": [
    {
      "id": 15,
      "title": "我家小吉咳不停",
      "author": {
        "username": "leotest",
        "fullname": "Leo",
        "avatar": "/media/avatars/..."
      },
      "created_at": "2025-09-15T...",
      "category": "健康諮詢"
    }
  ],
  "entities": {
    "symptoms": ["咳嗽"],
    "petBreed": "貓"
  }
}
```

### GET `/api/v1/ai/health/`

檢查 AI 服務健康狀態。

**回應**:
```json
{
  "status": "healthy",
  "services": {
    "openai": "configured",
    "vector_db_social": "available",
    "vector_db_forum": "available",
    "bert_model": "loaded"
  }
}
```

## 前端整合

### 使用方式

```javascript
import aiChatService from '../services/aiChatService';

// 處理使用者訊息
const result = await aiChatService.processMessage('推薦我一些養貓的用戶');

// 檢查服務狀態
const health = await aiChatService.checkHealth();

// 重置會話
aiChatService.resetSession();
```

### ChatWindow 整合

ChatWindow.jsx 中已經設定為使用 aiDemoService，切換到正式 API：

```javascript
// 從
import aiChatService from '../services/aiDemoService';

// 改為
import aiChatService from '../services/aiChatService';
```

## 服務架構

### services/openai_service.py
- `analyze_intent()` - 意圖分析
- `generate_response()` - 回應生成
- `generate_embedding()` - 生成嵌入向量

### services/vector_service.py
- `search_relevant_content()` - 根據意圖搜尋內容
- `_search_with_faiss()` - FAISS 向量搜尋
- `get_post_details()` - 獲取貼文詳情

### services/intent_service.py
- `process_user_input()` - 統一處理流程

### services/response_service.py
- `format_chat_response()` - 格式化回應
- `enrich_with_post_details()` - 豐富化貼文資料
- `enrich_with_user_recommendations()` - 豐富化用戶推薦

## 開發與測試

### 測試 API

```bash
curl -X POST http://localhost:8000/api/v1/ai/chat/ \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "message": "推薦一些照顧布偶貓的文章"
  }'
```

### 查看 Swagger 文檔

訪問 `http://localhost:8000/swagger/` 查看完整 API 文檔。

## 擴展與優化

### 1. 添加新的意圖類型

在 `openai_service.py` 的 system prompt 中添加新的意圖類型定義。

### 2. 優化向量搜尋

調整 `top_k` 參數或修改相似度計算方法。

### 3. 添加緩存

對常見問題添加 Redis 緩存，減少 OpenAI API 調用。

### 4. 添加使用統計

記錄意圖分布、回應時間等指標。

## 故障排除

### OpenAI API 錯誤

- 檢查 API Key 是否正確
- 確認是否有足夠的 API 配額
- 查看後端日誌中的詳細錯誤訊息

### 向量資料庫未找到

- 確認 `.npy` 文件存在於正確位置
- 運行推薦服務初始化腳本

### BERT 模型載入失敗

- 確認 `utils/bert-base-chinese` 目錄存在
- 檢查 PyTorch 和 Transformers 版本

## 未來計劃

- [ ] 添加對話上下文記憶
- [ ] 支援多輪對話
- [ ] 整合情感分析
- [ ] 個性化學習與推薦
- [ ] 支援語音輸入
- [ ] 添加意圖分類準確度監控