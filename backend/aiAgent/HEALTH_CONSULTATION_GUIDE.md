# 🏥 寵物健康諮詢系統實作指南

## 系統概述

寵物健康諮詢系統允許用戶詢問寵物健康問題，AI 會：
1. 從向量資料庫搜尋相似的疾病案例（其他用戶分享的真實經驗）
2. 使用 GPT-4o-mini 分析案例內容
3. 結合 AI 醫療知識提供專業建議
4. 推薦相關的疾病檔案供用戶參考

## 技術架構

### 後端流程

```
用戶提問
    ↓
1. 意圖識別 (OpenAI GPT-4o-mini, temp=0.3)
    → 識別意圖: health_consultation
    → 提取實體: petType, petBreed, symptoms
    ↓
2. 向量搜尋 (BERT + FAISS)
    → 使用 forum_post_embs.npy 向量資料庫
    → 搜尋相似的 DiseaseArchiveContent
    ↓
3. 案例詳情提取 (Django ORM)
    → 從資料庫獲取完整案例內容
    → 只取得公開案例 (is_private=False)
    ↓
4. AI 回應生成 (OpenAI GPT-4o-mini, temp=0.7)
    → 分析案例內容
    → 結合醫療知識
    → 生成專業建議
    → 返回 recommended_article_ids
    ↓
5. 前端顯示
    → 顯示 AI 回應
    → 顯示推薦案例卡片 (RecommendedArticlesPreview)
```

## 關鍵組件

### 1. 意圖識別 Prompt

**位置**: `aiAgent/services/openai_service.py:32-94`

**功能**:
- 識別用戶是否在詢問健康問題
- 提取寵物類型、品種、症狀等實體
- 利用用戶的寵物資訊輔助判斷

**示例**:
```
用戶: "我的布偶貓最近一直咳嗽怎麼辦？"
→ intent: "health_consultation"
→ entities: { petType: "貓", petBreed: "布偶貓", symptoms: ["咳嗽"] }
```

### 2. 向量搜尋服務

**位置**: `aiAgent/services/vector_service.py:163-205`

**使用的向量資料庫**:
- `forum_post_embs.npy`: 所有 DiseaseArchiveContent 的 BERT 嵌入向量
- `forum_post_ids.npy`: 對應的 PostFrame ID

**重要**: 此向量資料庫也被論壇推薦系統使用，**不要修改資料庫結構**！

**搜尋邏輯**:
```python
# 構建查詢文字
query_text = f"{petType} {petBreed} {' '.join(symptoms)}"

# 生成 BERT 向量
query_embedding = self._generate_query_embedding(query_text)

# FAISS 相似度搜尋
similar_cases = self._search_with_faiss(
    query_embedding,
    content_type='forum',  # 使用論壇類型的向量資料庫
    top_k=5
)
```

### 3. 案例詳情提取

**位置**: `aiAgent/services/intent_service.py:93-150`

**功能**:
- 根據 PostFrame ID 列表從資料庫取得完整的 DiseaseArchiveContent
- 只取得公開案例（`is_private=False`）
- 包含完整的內容、寵物資訊、健康狀態、是否就醫等

**返回格式**:
```python
{
    'id': 123,                          # PostFrame ID
    'archive_id': 456,                  # DiseaseArchiveContent ID
    'archive_title': '布偶貓咳嗽案例',
    'content': '我的貓最近一直咳嗽...',  # 完整內容
    'pet_info': {
        'name': 'Mimi',
        'type': '貓',
        'breed': '布偶貓'
    },
    'health_status': 'recovered',       # 健康狀態
    'go_to_doctor': True,               # 是否就醫
    'author': {
        'username': 'user123',
        'fullname': '張三'
    },
    'created_at': '2025-09-30T10:00:00Z'
}
```

### 4. AI 回應生成 Prompt

**位置**: `aiAgent/services/openai_service.py:180-235`

**System Prompt 要求**:
```
你是 Peter AI，一個友善專業的寵物照護助理。

你必須：
1. 仔細閱讀並分析每個相似案例的內容
2. 從案例中提取：症狀描述、可能原因、治療方式、結果
3. 結合你的醫療知識，給出專業分析和建議
4. 如果多個案例有共同點，要特別指出
5. 提醒飼主何時需要就醫

回應長度：3-6 句話
語氣：專業、友善、有同理心，但不要過度承諾療效
```

**User Message 結構**:
```
使用者問題：[用戶原始問題]

寵物資訊和症狀：{"petType": "貓", "petBreed": "布偶貓", "symptoms": ["咳嗽"]}

找到的相似案例（共 3 個）：

【案例 1】
標題: 布偶貓咳嗽治療經驗
寵物: Mimi (貓 - 布偶貓)
內容: [完整案例內容]
健康狀態: recovered
是否就醫: 是

【案例 2】
...

案例 ID 列表（請將此列表填入 recommended_article_ids）：[123, 124, 125]

請根據這些真實案例，結合你的專業知識，給使用者提供有價值的健康建議。
```

**AI 回應格式**:
```json
{
    "response": "我理解您對布偶貓咳嗽的擔心。從相似案例來看，布偶貓咳嗽可能是呼吸道感染或過敏引起的。案例中有2位飼主帶去就醫後，使用抗生素治療3-5天後症狀改善。建議您觀察貓咪的精神狀況，如果咳嗽持續超過2天、出現食慾不振或呼吸困難，請立即就醫檢查。",
    "ui_controls": {
        "hasRecommendedArticles": true
    },
    "additional_data": {
        "recommended_article_ids": [123, 124, 125]
    }
}
```

## 前端實作

### 1. RecommendedArticlesPreview 組件

**位置**: `frontend/src/components/RecommendedArticlesPreview.jsx`

**Props**:
- `articleIds`: PostFrame ID 陣列（從 AI 回應中取得）
- `onArticleClick`: 點擊回調函數（可選）

**功能**:
1. 根據 `articleIds` 調用 `aiChatService.getDiseaseArchiveDetails()`
2. 從後端批量獲取疾病檔案詳情
3. 顯示案例卡片：標題、寵物資訊、作者、時間
4. 點擊後跳轉到 `/forum/post/{post_id}`

**使用方式**:
```jsx
{message.hasRecommendedArticles && message.recommendedArticleIds && (
  <RecommendedArticlesPreview
    articleIds={message.recommendedArticleIds}
    onArticleClick={(article) => {
      console.log('點擊推薦文章:', article);
    }}
  />
)}
```

### 2. API 服務

**位置**: `frontend/src/services/aiChatService.js:391-407`

**方法**: `getDiseaseArchiveDetails(postIds)`

```javascript
async getDiseaseArchiveDetails(postIds) {
  const response = await this.apiClient.post('/disease-archives/batch/', {
    post_ids: postIds,
  });
  return response.data;
}
```

## 後端 API

### `/api/v1/ai/disease-archives/batch/`

**位置**: `aiAgent/views.py:495-594`

**方法**: POST
**權限**: IsAuthenticated

**請求體**:
```json
{
  "post_ids": [123, 124, 125]
}
```

**返回格式**:
```json
[
  {
    "id": 456,
    "post_id": 123,
    "archive_title": "布偶貓咳嗽案例",
    "content": "我的貓最近一直咳嗽...",
    "health_status": "recovered",
    "go_to_doctor": true,
    "pet_info": {
      "name": "Mimi",
      "type": "貓",
      "breed": "布偶貓"
    },
    "author": {
      "username": "user123",
      "fullname": "張三"
    },
    "created_at": "2025-09-30T10:00:00Z"
  }
]
```

**過濾條件**:
- 只返回公開的疾病檔案（`is_private=False`）
- 按建立時間倒序排列

## 資料庫共享說明

### Forum 向量資料庫

**檔案位置**:
- `backend/forum_post_embs.npy`: 向量嵌入
- `backend/forum_post_ids.npy`: PostFrame ID

**初始化來源**: `utils/recommendation_service.py:73-91`
```python
# 從所有 DiseaseArchiveContent 初始化向量資料庫
all_posts = DiseaseArchiveContent.objects.all()
for post in all_posts:
    post_frame = post.postFrame
    data_array.append({
        "id": post_frame.id,
        "timestamp": int(post_frame.created_at.timestamp()),
        "content": post.content,
        "hashtags": []
    })
```

**使用者**:
1. **健康諮詢系統** (`aiAgent/services/vector_service.py`)
   - 搜尋相似的疾病案例
   - 只讀取，不修改

2. **論壇推薦系統** (`utils/recommendation_service.py`)
   - 推薦相關論壇貼文
   - 讀取和初始化

**重要**:
- ⚠️ 不要修改向量資料庫的結構或格式
- ⚠️ 不要改變 `content` 欄位的來源（必須是 `DiseaseArchiveContent.content`）
- ✅ 兩個系統可以安全地共享此資料庫

## 完整示例

### 用戶提問
```
"我的布偶貓最近一直咳嗽，精神還好，但擔心是生病了，該怎麼辦？"
```

### 系統處理流程

1. **意圖識別**
```json
{
  "intent": "health_consultation",
  "sub_type": "symptom_similar",
  "confidence": 0.92,
  "entities": {
    "petType": "貓",
    "petBreed": "布偶貓",
    "symptoms": ["咳嗽"]
  }
}
```

2. **向量搜尋**
- 查詢: "貓 布偶貓 咳嗽"
- 找到 5 個最相似的案例（PostFrame ID: 123, 124, 125, 126, 127）

3. **案例詳情提取**
- 從資料庫取得 5 個完整的 DiseaseArchiveContent
- 包含完整內容、寵物資訊、治療經驗等

4. **AI 回應生成**
```
"我理解您對布偶貓咳嗽的擔心。從其他飼主的經驗來看，布偶貓咳嗽常見原因包括呼吸道感染、
過敏或異物刺激。多數案例顯示，如果貓咪精神狀況良好、食慾正常，可以先觀察1-2天，同時保持
環境通風、減少灰塵。但如果咳嗽加劇、出現呼吸困難或食慾不振，建議立即就醫檢查。以下案例
可能對您有幫助。"
```

5. **前端顯示**
- AI 回應文字
- 推薦 5 個相關案例的卡片
- 點擊卡片可查看完整的疾病檔案

## 優勢

✅ **真實案例**: 基於其他飼主的真實經驗，更有參考價值
✅ **AI 分析**: GPT-4o-mini 分析案例內容，不只是列出案例
✅ **專業建議**: 結合 AI 醫療知識，提供專業的健康建議
✅ **就醫提醒**: 明確告知何時需要就醫，避免延誤治療
✅ **可追溯**: 用戶可點擊案例查看完整詳情
✅ **隱私保護**: 只推薦公開的疾病檔案

## 未來擴展

### 可能的改進方向

1. **專門的疾病向量資料庫**
   - 目前與論壇推薦共享資料庫
   - 可建立專門的疾病案例向量資料庫，加入更多醫療特徵

2. **症狀嚴重程度判斷**
   - 根據症狀描述判斷緊急程度
   - 嚴重症狀優先提示就醫

3. **獸醫師驗證標記**
   - 標記經過獸醫師驗證的案例
   - 優先推薦驗證過的案例

4. **相似度閾值過濾**
   - 設定最低相似度閾值
   - 如果沒有足夠相似的案例，建議直接就醫

5. **多語言支持**
   - 目前只支持繁體中文
   - 可擴展至英文、簡體中文等

## 注意事項

⚠️ **醫療免責聲明**: AI 建議僅供參考，不能替代專業獸醫診斷
⚠️ **向量資料庫共享**: 修改時要考慮論壇推薦系統的影響
⚠️ **隱私保護**: 只推薦公開案例，不洩露私人健康資訊
⚠️ **案例品質**: 確保向量資料庫中的案例內容完整且準確

## 測試建議

### 功能測試
1. ✅ 測試不同寵物類型的健康諮詢（貓、狗）
2. ✅ 測試不同症狀的識別（咳嗽、嘔吐、食慾不振等）
3. ✅ 測試案例推薦是否相關
4. ✅ 測試點擊案例跳轉是否正常
5. ✅ 測試歷史對話中的推薦案例顯示

### 邊界測試
1. ✅ 測試沒有相似案例時的處理
2. ✅ 測試用戶沒有提供寵物資訊時的處理
3. ✅ 測試症狀描述不清楚時的處理

### 效能測試
1. ✅ 測試向量搜尋的響應時間
2. ✅ 測試批量獲取案例詳情的效能
3. ✅ 測試大量歷史對話的載入速度

## 相關文件

- [AI Agent 快速入門](./QUICKSTART.md)
- [向量資料庫指南](./VECTOR_DB_GUIDE.md)
- [聊天歷史實作說明](../../frontend/CHAT_HISTORY_IMPLEMENTATION.md)