// AI Agent 總控制器 - 統一的 AI 服務入口
// 這是整個 AI Agent 架構的協調中心，負責管理所有 AI 服務的協作

import aiIntentService from './aiIntentService';
import aiDemoService from './aiDemoService';

class AIAgentService {
  constructor() {
    // 服務模式
    this.SERVICE_MODES = {
      DEMO: 'demo',           // Demo 模式（當前）
      PRODUCTION: 'production' // 正式模式（未來）
    };

    // 當前模式
    this.currentMode = this.SERVICE_MODES.DEMO;

    // 會話管理
    this.sessionManager = {
      currentSessionId: null,
      conversationHistory: [],
      userContext: {}
    };
  }

  /**
   * 處理用戶訊息 - 統一入口點
   * @param {string} userMessage - 用戶訊息
   * @param {Object} context - 對話上下文
   * @returns {Promise<Object>} 處理結果
   */
  async processMessage(userMessage, context = {}) {
    try {
      // 記錄用戶訊息
      this.logUserMessage(userMessage, context);

      // 根據當前模式選擇處理方式
      let result;
      if (this.currentMode === this.SERVICE_MODES.DEMO) {
        result = await this.processDemoMode(userMessage, context);
      } else {
        result = await this.processProductionMode(userMessage, context);
      }

      // 記錄 AI 回應
      this.logAIResponse(result);

      // 更新會話狀態
      this.updateSession(userMessage, result, context);

      return result;

    } catch (error) {
      console.error('AI Agent 處理失敗:', error);
      return this.createErrorResponse(error.message);
    }
  }

  /**
   * Demo 模式處理（當前實作）
   * @param {string} userMessage - 用戶訊息
   * @param {Object} context - 對話上下文
   * @returns {Promise<Object>} 處理結果
   */
  async processDemoMode(userMessage, context) {
    // 直接使用現有的 Demo Service
    return await aiDemoService.processMessage(userMessage);
  }

  /**
   * 正式模式處理（未來實作）
   * @param {string} userMessage - 用戶訊息
   * @param {Object} context - 對話上下文
   * @returns {Promise<Object>} 處理結果
   */
  async processProductionMode(userMessage, context) {
    // 1. 使用意圖識別服務分析用戶輸入
    const intentResult = await aiIntentService.processUserInput(userMessage, {
      ...context,
      ...this.sessionManager.userContext
    });

    if (!intentResult.success) {
      return this.createErrorResponse(intentResult.fallbackResponse);
    }

    // 2. 根據意圖結果創建回應
    return this.createSuccessResponse(intentResult);
  }

  /**
   * 切換服務模式
   * @param {string} mode - 服務模式
   */
  switchMode(mode) {
    if (Object.values(this.SERVICE_MODES).includes(mode)) {
      console.log(`AI Agent 模式切換: ${this.currentMode} -> ${mode}`);
      this.currentMode = mode;

      // 重置會話當模式切換時
      this.resetSession();
    } else {
      console.error(`無效的服務模式: ${mode}`);
    }
  }

  /**
   * 創建成功回應
   * @param {Object} intentResult - 意圖處理結果
   * @returns {Object} 統一格式的回應
   */
  createSuccessResponse(intentResult) {
    return {
      response: intentResult.response.text,
      source: this.currentMode,
      confidence: intentResult.confidence,
      metadata: {
        intent: intentResult.intent,
        serviceUsed: intentResult.serviceUsed,
        entities: intentResult.entities,
        sessionId: this.sessionManager.currentSessionId
      },

      // UI 控制標記（從意圖結果傳遞）
      hasTutorial: intentResult.response.hasTutorial || false,
      tutorialType: intentResult.response.tutorialType || null,
      hasRecommendedUsers: intentResult.response.hasRecommendedUsers || false,
      hasRecommendedArticles: intentResult.response.hasRecommendedArticles || false,
      hasCalculator: intentResult.response.hasCalculator || false,
      hasOperation: intentResult.response.hasOperation || false,
      operationType: intentResult.response.operationType || null,

      // 附加資料
      data: intentResult.response.data,
      params: intentResult.response.params
    };
  }

  /**
   * 創建錯誤回應
   * @param {string} errorMessage - 錯誤訊息
   * @returns {Object} 錯誤回應
   */
  createErrorResponse(errorMessage) {
    return {
      response: errorMessage || '抱歉，我暫時無法處理您的請求。請稍後再試。',
      source: 'error',
      confidence: 0,
      metadata: {
        error: true,
        sessionId: this.sessionManager.currentSessionId
      }
    };
  }

  /**
   * 記錄用戶訊息
   * @param {string} message - 用戶訊息
   * @param {Object} context - 對話上下文
   */
  logUserMessage(message, context) {
    const logEntry = {
      type: 'user',
      message,
      timestamp: new Date(),
      context,
      sessionId: this.sessionManager.currentSessionId
    };

    this.sessionManager.conversationHistory.push(logEntry);

    // 限制歷史記錄長度
    if (this.sessionManager.conversationHistory.length > 50) {
      this.sessionManager.conversationHistory.shift();
    }

    console.log('用戶訊息:', message);
  }

  /**
   * 記錄 AI 回應
   * @param {Object} response - AI 回應
   */
  logAIResponse(response) {
    const logEntry = {
      type: 'ai',
      message: response.response,
      metadata: response.metadata || {},
      timestamp: new Date(),
      sessionId: this.sessionManager.currentSessionId
    };

    this.sessionManager.conversationHistory.push(logEntry);

    console.log('AI 回應:', response.response);
    if (response.metadata?.intent) {
      console.log('識別意圖:', response.metadata.intent);
    }
  }

  /**
   * 更新會話狀態
   * @param {string} userMessage - 用戶訊息
   * @param {Object} aiResponse - AI 回應
   * @param {Object} context - 對話上下文
   */
  updateSession(userMessage, aiResponse, context) {
    // 更新用戶上下文
    if (context.user) {
      this.sessionManager.userContext.user = context.user;
    }

    if (context.petId) {
      this.sessionManager.userContext.petId = context.petId;
    }

    // 更新會話 ID（如果沒有的話）
    if (!this.sessionManager.currentSessionId) {
      this.sessionManager.currentSessionId = this.generateSessionId();
    }
  }

  /**
   * 開始新會話
   * @param {Object} userContext - 用戶上下文
   * @returns {string} 新的會話 ID
   */
  startNewSession(userContext = {}) {
    this.resetSession();
    this.sessionManager.currentSessionId = this.generateSessionId();
    this.sessionManager.userContext = { ...userContext };

    console.log('新會話開始:', this.sessionManager.currentSessionId);
    return this.sessionManager.currentSessionId;
  }

  /**
   * 重置會話
   */
  resetSession() {
    this.sessionManager.currentSessionId = null;
    this.sessionManager.conversationHistory = [];
    this.sessionManager.userContext = {};

    // 重置意圖服務的上下文
    if (this.currentMode === this.SERVICE_MODES.PRODUCTION) {
      aiIntentService.resetContext();
    }
  }

  /**
   * 獲取會話歷史
   * @returns {Array} 會話歷史
   */
  getConversationHistory() {
    return this.sessionManager.conversationHistory;
  }

  /**
   * 獲取當前會話資訊
   * @returns {Object} 會話資訊
   */
  getSessionInfo() {
    return {
      sessionId: this.sessionManager.currentSessionId,
      mode: this.currentMode,
      messageCount: this.sessionManager.conversationHistory.length,
      userContext: this.sessionManager.userContext,
      startTime: this.sessionManager.conversationHistory[0]?.timestamp || null
    };
  }

  /**
   * 獲取服務統計
   * @returns {Object} 服務統計
   */
  getServiceStats() {
    const history = this.sessionManager.conversationHistory;
    const aiMessages = history.filter(msg => msg.type === 'ai');

    // 統計意圖分佈（僅在正式模式下）
    const intentStats = {};
    if (this.currentMode === this.SERVICE_MODES.PRODUCTION) {
      aiMessages.forEach(msg => {
        const intent = msg.metadata?.intent;
        if (intent) {
          intentStats[intent] = (intentStats[intent] || 0) + 1;
        }
      });
    }

    return {
      mode: this.currentMode,
      totalMessages: history.length,
      userMessages: history.filter(msg => msg.type === 'user').length,
      aiMessages: aiMessages.length,
      intentStats,
      sessionDuration: this.calculateSessionDuration()
    };
  }

  /**
   * 計算會話持續時間
   * @returns {number} 持續時間（毫秒）
   */
  calculateSessionDuration() {
    const history = this.sessionManager.conversationHistory;
    if (history.length < 2) return 0;

    const start = history[0].timestamp;
    const end = history[history.length - 1].timestamp;
    return end.getTime() - start.getTime();
  }

  /**
   * 生成會話 ID
   * @returns {string} 會話 ID
   */
  generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 設置調試模式
   * @param {boolean} enabled - 是否啟用調試
   */
  setDebugMode(enabled) {
    this.debugMode = enabled;
    console.log('AI Agent 調試模式:', enabled ? '啟用' : '停用');
  }

  /**
   * 導出會話資料（用於分析或備份）
   * @returns {Object} 會話資料
   */
  exportSessionData() {
    return {
      sessionInfo: this.getSessionInfo(),
      conversationHistory: this.getConversationHistory(),
      serviceStats: this.getServiceStats(),
      exportTime: new Date().toISOString()
    };
  }

  /**
   * 未來可以添加的功能
   */

  // async saveSessionToCloud(sessionData) {
  //   // 將會話資料保存到雲端
  // }

  // async loadSessionFromCloud(sessionId) {
  //   // 從雲端載入會話資料
  // }

  // async getPersonalizedRecommendations(userId) {
  //   // 基於用戶歷史獲取個性化推薦
  // }

  // async trainPersonalModel(userId, feedbackData) {
  //   // 基於用戶反饋訓練個人化模型
  // }
}

// 導出單例
export default new AIAgentService();