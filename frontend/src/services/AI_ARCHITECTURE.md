# AI Agent 架構說明

## 架構概覽

這是一個完整的 AI Agent 架構，設計用於從 Demo 模式平滑升級到正式的 AI 驅動系統。

```
用戶輸入
    ↓
[aiAgentService] ← 總控制器
    ↓
[aiIntentService] ← 意圖識別
    ↓
路由到專業服務：
├── [aiOperationService] ← 操作執行
├── [aiRecommendationService] ← 推薦服務
├── [aiTutorialService] ← 教學服務
└── [aiFeedingService] ← 飼料建議
    ↓
[ChatWindow] ← 統一回應
```

## 服務說明

### 1. aiAgentService.js - 總控制器
**職責：** 統一的 AI 服務入口，管理所有 AI 服務的協作
**功能：**
- 模式切換（Demo / Production）
- 會話管理和歷史記錄
- 統一的錯誤處理
- 服務統計和監控

### 2. aiIntentService.js - 意圖識別服務
**職責：** 分析用戶自然語言輸入，識別意圖並路由到相應服務
**功能：**
- 自然語言理解（NLU）
- 實體提取（NER）
- 上下文管理
- 服務路由決策

**支援的意圖類型：**
- `operation`: 執行操作（查找記錄、設置提醒等）
- `recommendation`: 推薦（用戶、文章、產品等）
- `tutorial`: 教學指導
- `feeding`: 飼料建議
- `general`: 一般對話

### 3. aiOperationService.js - 操作執行服務
**職責：** 處理 AI 協助用戶執行的各種系統操作
**功能：**
- 查找異常記錄
- 查找健康記錄
- 設置餵食提醒
- 搜尋附近醫院

### 4. aiRecommendationService.js - 推薦服務
**職責：** 處理用戶推薦、文章推薦等推薦功能
**功能：**
- 用戶推薦
- 文章推薦
- 個性化推薦邏輯

### 5. aiTutorialService.js - 教學服務
**職責：** 管理各種教學模式和引導功能
**功能：**
- 教學流程管理
- 步驟追蹤
- 教學配置管理

### 6. aiFeedingService.js - 飼料建議服務
**職責：** 專門處理寵物飼料推薦和營養分析
**功能：**
- 個性化飼料推薦
- 營養分析
- 品牌比較
- 餵食量計算

### 7. aiDemoService.js - Demo 服務（向後相容）
**職責：** 維持現有的 Demo 功能，作為架構升級的緩衝
**功能：**
- 寫死的問答邏輯
- 向後相容性保證

## 使用方式

### 當前（Demo 模式）
```javascript
import aiAgentService from '../services/aiAgentService';

// 使用 Demo 模式（預設）
const result = await aiAgentService.processMessage(userInput);
```

### 未來（Production 模式）
```javascript
import aiAgentService from '../services/aiAgentService';

// 切換到正式模式
aiAgentService.switchMode('production');

// 使用完整的 AI 架構
const result = await aiAgentService.processMessage(userInput, context);
```

## 升級路徑

### 階段 1：當前狀態（Demo）
- ✅ 所有服務已創建
- ✅ 架構已完整
- ✅ 使用 aiDemoService 的寫死邏輯

### 階段 2：逐步升級
```javascript
// 只需要在 aiIntentService 中實作真實的 NLP
async identifyIntent(input) {
  // 替換為真實的 AI API 調用
  const response = await fetch('/api/ai/intent', {
    method: 'POST',
    body: JSON.stringify({ text: input })
  });
  return response.json();
}
```

### 階段 3：完全 AI 驅動
- 將所有 Mock 方法替換為真實 API
- 整合真實的 NLP 模型
- 添加機器學習能力

## 配置管理

### 模式切換
```javascript
// 在環境變數或配置文件中設定
const AI_MODE = process.env.REACT_APP_AI_MODE || 'demo';
aiAgentService.switchMode(AI_MODE);
```

### 服務配置
```javascript
// 每個服務都可以獨立配置
const config = {
  aiIntent: {
    apiEndpoint: '/api/ai/intent',
    confidenceThreshold: 0.7
  },
  aiOperation: {
    defaultPetId: 1,
    maxRetries: 3
  }
  // ... 其他服務配置
};
```

## 監控和調試

### 會話管理
```javascript
// 獲取會話資訊
const sessionInfo = aiAgentService.getSessionInfo();

// 獲取服務統計
const stats = aiAgentService.getServiceStats();

// 導出會話資料
const sessionData = aiAgentService.exportSessionData();
```

### 調試模式
```javascript
// 啟用調試模式
aiAgentService.setDebugMode(true);
```

## 擴展性

### 添加新的意圖類型
1. 在 `aiIntentService.js` 中添加新的意圖模式
2. 創建對應的專業服務
3. 在服務映射中註冊新服務

### 添加新的服務
1. 創建新的服務文件
2. 實作統一的服務接口
3. 在 `aiIntentService.js` 中註冊路由

## 最佳實踐

1. **統一接口：** 所有服務都應該返回統一格式的結果
2. **錯誤處理：** 每個服務都應該有完整的錯誤處理機制
3. **可測試性：** 每個服務都應該是可獨立測試的
4. **向後相容：** 升級過程中保持向後相容性
5. **文檔更新：** 服務變更時及時更新文檔

## 未來功能

- **個性化學習：** 基於用戶行為學習偏好
- **多輪對話：** 支援複雜的多輪對話
- **情感分析：** 理解用戶情緒狀態
- **多模態輸入：** 支援語音、圖片等輸入
- **實時學習：** 在使用過程中不斷改進

這個架構為您的 AI Agent 系統提供了強大的基礎，既滿足了當前的 Demo 需求，又為未來的 AI 升級做好了完整的準備。