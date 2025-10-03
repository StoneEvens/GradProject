# 系統導覽與操作資料庫說明

## 概覽

本系統包含兩個獨立的 JSON 資料庫：

1. **系統導覽 FAQ (`system_faq.json`)**: 用於回答使用者關於系統功能的諮詢問題
2. **系統操作 (`system_operations.json`)**: 用於 AI 代理使用者執行系統操作的詳細資訊

## 架構說明

### 1. 系統導覽 FAQ 資料庫

**用途**: 當使用者詢問如何使用系統功能時，AI 會從這個資料庫搜尋相關 FAQ 並回答。

**資料結構**:
```json
{
  "id": 1,
  "name": "問題簡短名稱",
  "description": "問題的詳細描述",
  "keywords": ["關鍵字1", "關鍵字2", ...],
  "use_cases": ["使用者可能的問法1", "使用者可能的問法2", ...],
  "answer": "FAQ 的詳細回答",
  "has_tutorial": true/false,
  "tutorial_type": "對應的教學類型或 null",
  "category": "分類標籤"
}
```

**教學整合**:
- 當 `has_tutorial` 為 `true` 時，前端會顯示「開始教學」按鈕
- `tutorial_type` 必須對應 `/frontend/src/data/tutorialData.js` 中的 key
- 目前可用的教學類型：`tagPet`, `createPost`, `feedPet`

**填寫指南**:
1. **id**: 從 1 開始遞增的唯一編號
2. **name**: 簡短明確的問題標題（10-20 字）
3. **description**: 詳細描述問題場景（30-50 字）
4. **keywords**: 5-10 個關鍵字，包含同義詞和常見說法
5. **use_cases**: 3-5 個使用者可能的實際問法
6. **answer**: 清楚的步驟說明，可包含：
   - 步驟編號
   - 路徑指引（例如：「進入『設定』→『個人資料』」）
   - 注意事項
7. **has_tutorial**: 是否有互動式教學
8. **tutorial_type**: 必須與前端 `tutorialData.js` 的 key 完全一致
9. **category**: 用於分類管理，建議類別：
   - `account`: 帳號相關
   - `social`: 社群功能
   - `pet`: 寵物管理
   - `health`: 健康記錄
   - `feed`: 飼料功能

**範例**:
```json
{
  "id": 2,
  "name": "如何在貼文中標註寵物",
  "description": "教導使用者如何在發布的照片中標記和標註自己的寵物",
  "keywords": ["標註", "標記", "寵物標註", "tag", "標籤", "照片", "貼文", "圖片標註"],
  "use_cases": [
    "如何標註寵物",
    "怎麼標記我的貓",
    "標註功能怎麼用",
    "如何在照片上標記寵物",
    "貼文標註教學"
  ],
  "answer": "您可以在發布貼文時，點擊上傳的照片進入編輯模式，然後在照片上點擊您想標註的位置，選擇「寵物」類型並選擇您的寵物名稱，即可完成標註。如需詳細步驟，可以點擊下方的「開始教學」按鈕。",
  "has_tutorial": true,
  "tutorial_type": "tagPet",
  "category": "social"
}
```

### 2. 系統操作資料庫

**用途**: 當使用者請求 AI 幫助執行某項操作時，AI 會從這個資料庫獲取執行所需的詳細資訊。

**資料結構**:
```json
{
  "id": 1,
  "operation_type": "操作類型標識符",
  "name": "操作名稱",
  "description": "操作描述",
  "keywords": ["關鍵字陣列"],
  "use_cases": ["使用者可能的請求"],
  "method": "HTTP方法或NAVIGATE",
  "endpoint": "API端點或前端路由",
  "requires_auth": true/false,
  "required_params": [參數陣列],
  "optional_params": [可選參數陣列],
  "response_format": "回應格式說明",
  "success_message": "成功訊息模板",
  "error_handling": "錯誤處理說明",
  "category": "分類標籤"
}
```

**參數結構**:
```json
{
  "name": "參數名稱",
  "type": "資料類型",
  "format": "格式說明（可選）",
  "description": "參數說明",
  "source": "參數來源類型",
  "default_source": "預設來源（可選）",
  "default": "預設值（可選）"
}
```

**參數來源類型 (source)**:
- `context`: 從上下文獲取（如當前使用者 ID、當前寵物 ID）
- `user_input`: 從使用者輸入中提取
- `gpt_inference`: 由 GPT 推斷或詢問使用者
- `current_time`: 使用當前時間
- `default`: 使用預設值

**HTTP 方法**:
- `GET`: 查詢操作
- `POST`: 創建操作
- `PUT`: 更新操作
- `DELETE`: 刪除操作
- `NAVIGATE`: 前端導航操作（不調用 API，直接跳轉頁面）

**填寫指南**:
1. **operation_type**: 駝峰命名，清楚描述操作（如 `findAbnormalPosts`）
2. **method**:
   - 使用 `NAVIGATE` 表示前端路由跳轉
   - 使用 HTTP 方法表示需要調用後端 API
3. **endpoint**:
   - 導航操作：前端路由（如 `/pet/{petId}/abnormal-posts`）
   - API 操作：完整 API 路徑（如 `/api/v1/pets/{petId}/abnormal-posts`）
4. **required_params**: 必要參數，缺少則操作無法執行
5. **optional_params**: 可選參數，有預設值或可省略
6. **success_message**: 使用 `{參數名}` 作為變數佔位符
7. **category**: 建議類別：
   - `records`: 記錄查詢
   - `reminders`: 提醒設置
   - `navigation`: 導航操作
   - `social`: 社群功能
   - `feed`: 飼料相關

**範例**:
```json
{
  "id": 1,
  "operation_type": "findAbnormalPosts",
  "name": "查找異常記錄",
  "description": "幫助使用者查找指定寵物的異常健康記錄和症狀記錄，可指定時間範圍",
  "keywords": ["異常", "記錄", "症狀", "健康問題", "不正常", "奇怪行為", "異常貼文", "病歷"],
  "use_cases": [
    "我家貓咪最近有什麼異常",
    "幫我找異常記錄",
    "查看過去兩週的健康問題"
  ],
  "method": "NAVIGATE",
  "endpoint": "/pet/{petId}/abnormal-posts",
  "requires_auth": true,
  "required_params": [
    {
      "name": "petId",
      "type": "integer",
      "description": "寵物 ID",
      "source": "context",
      "default_source": "user.default_pet_id"
    }
  ],
  "optional_params": [
    {
      "name": "startDate",
      "type": "string",
      "format": "YYYY-MM-DD",
      "description": "開始日期",
      "source": "gpt_inference",
      "default": "14_days_ago"
    },
    {
      "name": "endDate",
      "type": "string",
      "format": "YYYY-MM-DD",
      "description": "結束日期",
      "source": "current_time",
      "default": "today"
    }
  ],
  "response_format": "導航至異常記錄頁面",
  "success_message": "已為您導航至 {petName} 的異常記錄頁面，顯示 {startDate} 到 {endDate} 的記錄。",
  "error_handling": "如果找不到寵物，詢問使用者要查看哪隻寵物的記錄",
  "category": "records"
}
```

## 向量資料庫初始化

系統會在啟動時自動從 JSON 檔案讀取資料並建立向量索引：

1. **首次啟動**: 自動建立 `.npy` 向量檔案
2. **後續啟動**: 載入現有向量檔案（快速啟動）
3. **更新資料**: 修改 JSON 後需刪除對應的 `.npy` 檔案以重新建立索引

**向量檔案位置**:
- `/backend/system_faq_embs.npy`
- `/backend/system_faq_ids.npy`
- `/backend/system_faq_metadata.npy`
- `/backend/system_operation_embs.npy`
- `/backend/system_operation_ids.npy`
- `/backend/system_operation_metadata.npy`

**重新建立索引**:
```bash
# 刪除 FAQ 向量檔案
rm backend/system_faq_*.npy

# 刪除操作向量檔案
rm backend/system_operation_*.npy

# 重啟服務，系統會自動重建
```

## 工作流程

### 系統諮詢流程 (FAQ)

1. 使用者詢問：「如何標註寵物？」
2. 意圖檢測：識別為 `system_inquiry`
3. 向量搜尋：在 `system_faq.json` 中搜尋最相關的 FAQ
4. GPT 回應生成：
   - 使用 FAQ 的 `answer` 生成友善回答
   - 檢查 `has_tutorial` 和 `tutorial_type`
   - 如有教學，設置 `hasTutorial: true` 和 `tutorialType`
5. 前端顯示：
   - 顯示 AI 回答
   - 如有教學，顯示「開始教學」按鈕
   - 點擊按鈕後啟動對應的互動式教學

### 系統操作流程

1. 使用者請求：「幫我查看最近的異常記錄」
2. 意圖檢測：識別為 `operation`
3. 向量搜尋：在 `system_operations.json` 中找到 `findAbnormalPosts`
4. 參數提取：
   - 從 context 獲取 `petId`
   - 推斷或詢問 `startDate` 和 `endDate`
5. 執行操作：
   - 如果是 `NAVIGATE`：構建 URL 並導航
   - 如果是 API 調用：發送請求並處理回應
6. 回應使用者：使用 `success_message` 模板通知操作結果

## 維護建議

### 添加新 FAQ

1. 打開 `system_faq.json`
2. 複製現有範例
3. 遞增 `id`
4. 填寫所有欄位
5. 如需教學，確保 `tutorial_type` 在 `tutorialData.js` 中存在
6. 刪除 `system_faq_*.npy` 檔案
7. 重啟服務測試

### 添加新操作

1. 打開 `system_operations.json`
2. 複製現有範例
3. 遞增 `id`
4. 確定操作類型（導航或 API）
5. 詳細定義所有參數
6. 測試 endpoint 是否正確
7. 刪除 `system_operation_*.npy` 檔案
8. 重啟服務測試

### 修改現有資料

1. 直接編輯 JSON 檔案
2. 刪除對應的 `.npy` 檔案
3. 重啟服務
4. 測試修改效果

## 最佳實踐

1. **關鍵字豐富**: 包含同義詞、俗稱、英文術語
2. **問法多樣**: use_cases 涵蓋各種問法
3. **答案清晰**: 使用步驟編號，避免模糊描述
4. **參數完整**: 詳細說明每個參數的用途和來源
5. **錯誤處理**: 考慮各種異常情況
6. **測試驗證**: 每次修改後測試實際效果
7. **定期維護**: 根據使用者反饋更新內容

## 故障排除

### 問題：FAQ 搜尋不到

**可能原因**:
- 關鍵字不夠豐富
- 向量索引未更新

**解決方案**:
1. 增加更多關鍵字和 use_cases
2. 刪除 `.npy` 檔案重建索引
3. 降低搜尋相似度閾值（在 `vector_service.py` 中修改 `min_similarity`）

### 問題：教學按鈕點擊無效

**可能原因**:
- `tutorial_type` 與前端不匹配
- 前端教學資料未定義

**解決方案**:
1. 檢查 `tutorialData.js` 是否有對應的 key
2. 確保 `tutorial_type` 拼寫完全一致（區分大小寫）

### 問題：操作執行失敗

**可能原因**:
- endpoint 路徑錯誤
- 必要參數缺失
- 權限不足

**解決方案**:
1. 驗證 endpoint 是否正確
2. 檢查所有 required_params 是否正確提取
3. 確認 `requires_auth` 設置正確

## 聯絡與支援

如有問題或建議，請：
1. 檢查本文件的故障排除部分
2. 查看 console 日誌錯誤訊息
3. 測試向量搜尋結果
4. 驗證 JSON 格式正確性

---

**最後更新**: 2025-10-01
**版本**: 1.0.0
