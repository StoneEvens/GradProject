// AI Chat Service - 連接後端 AI Agent API
// 整合 OpenAI + 向量資料庫的完整 AI 服務

import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

class AIChatService {
  constructor() {
    this.apiClient = axios.create({
      baseURL: `${API_BASE_URL}/ai`,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // 添加請求攔截器來加入 JWT token
    this.apiClient.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('accessToken');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // 會話上下文管理
    this.sessionContext = {
      conversationHistory: [],
      lastIntent: null,
    };

    // 當前對話 ID（用於後端對話記錄）
    this.currentConversationId = null;
  }

  /**
   * 處理使用者訊息
   * @param {string} userMessage - 使用者輸入訊息
   * @param {Object} additionalContext - 額外的上下文資訊
   * @returns {Promise<Object>} AI 回應
   */
  async processMessage(userMessage, additionalContext = {}) {
    try {
      // 準備請求資料
      const requestData = {
        message: userMessage,
        conversationId: this.currentConversationId, // 加入對話 ID
        context: {
          ...this.sessionContext,
          ...additionalContext,
          timestamp: new Date().toISOString(),
        },
      };

      // 調用後端 API
      const response = await this.apiClient.post('/chat/', requestData);

      // 更新當前對話 ID（如果是新對話，後端會返回）
      if (response.data.conversationId) {
        this.currentConversationId = response.data.conversationId;
      }

      // 更新會話上下文
      this.updateSessionContext(userMessage, response.data);

      return response.data;

    } catch (error) {
      console.error('AI Chat Service Error:', error);
      return this.handleError(error);
    }
  }

  /**
   * 更新會話上下文
   * @param {string} userMessage - 使用者訊息
   * @param {Object} aiResponse - AI 回應
   */
  updateSessionContext(userMessage, aiResponse) {
    // 記錄對話歷史
    this.sessionContext.conversationHistory.push({
      user: userMessage,
      ai: aiResponse.response,
      intent: aiResponse.intent,
      timestamp: new Date().toISOString(),
    });

    // 限制歷史記錄數量
    if (this.sessionContext.conversationHistory.length > 10) {
      this.sessionContext.conversationHistory.shift();
    }

    // 更新最後意圖
    if (aiResponse.intent) {
      this.sessionContext.lastIntent = aiResponse.intent;
    }
  }

  /**
   * 錯誤處理
   * @param {Error} error - 錯誤對象
   * @returns {Object} 錯誤回應
   */
  handleError(error) {
    // 網路錯誤或後端未啟動
    if (error.code === 'ERR_NETWORK' || !error.response) {
      return {
        response: '抱歉，目前無法連接到 AI 服務。請確認網路連線或稍後再試。',
        source: 'error',
        confidence: 0.0,
        error: true,
        hasTutorial: false,
        hasRecommendedUsers: false,
        hasRecommendedArticles: false,
        hasCalculator: false,
        hasOperation: false,
      };
    }

    // API 錯誤
    if (error.response) {
      return {
        response: error.response.data?.response || '抱歉，處理您的請求時發生錯誤。',
        source: 'error',
        confidence: 0.0,
        error: true,
        detail: error.response.data?.detail,
        hasTutorial: false,
        hasRecommendedUsers: false,
        hasRecommendedArticles: false,
        hasCalculator: false,
        hasOperation: false,
      };
    }

    // 未知錯誤
    return {
      response: '抱歉，發生了未預期的錯誤。',
      source: 'error',
      confidence: 0.0,
      error: true,
      hasTutorial: false,
      hasRecommendedUsers: false,
      hasRecommendedArticles: false,
      hasCalculator: false,
      hasOperation: false,
    };
  }

  /**
   * 檢查 AI 服務健康狀態
   * @returns {Promise<Object>} 服務狀態
   */
  async checkHealth() {
    try {
      const response = await this.apiClient.get('/health/');
      return response.data;
    } catch (error) {
      console.error('AI Health Check Error:', error);
      return {
        status: 'unhealthy',
        error: error.message,
      };
    }
  }

  /**
   * 重置會話上下文
   */
  resetSession() {
    this.sessionContext = {
      conversationHistory: [],
      lastIntent: null,
    };
    this.currentConversationId = null; // 也重置對話 ID
  }

  /**
   * 獲取會話上下文
   * @returns {Object} 當前會話上下文
   */
  getSessionContext() {
    return { ...this.sessionContext };
  }

  // ========== 對話管理 API ==========

  /**
   * 取得所有對話列表
   * @param {Object} params - 查詢參數 { archived, pinned }
   * @returns {Promise<Array>} 對話列表
   */
  async getConversations(params = {}) {
    try {
      const response = await this.apiClient.get('/conversations/', { params });
      return response.data;
    } catch (error) {
      console.error('Get Conversations Error:', error);
      throw error;
    }
  }

  /**
   * 取得指定對話詳情（包含所有訊息）
   * @param {number} conversationId - 對話 ID
   * @returns {Promise<Object>} 對話詳情
   */
  async getConversationDetail(conversationId) {
    try {
      const response = await this.apiClient.get(`/conversations/${conversationId}/`);
      return response.data;
    } catch (error) {
      console.error('Get Conversation Detail Error:', error);
      throw error;
    }
  }

  /**
   * 載入指定對話（設定為當前對話）
   * @param {number} conversationId - 對話 ID
   * @returns {Promise<Object>} 對話詳情
   */
  async loadConversation(conversationId) {
    try {
      const conversation = await this.getConversationDetail(conversationId);

      // 設定為當前對話
      this.currentConversationId = conversationId;

      // 重建對話歷史到 sessionContext
      this.sessionContext.conversationHistory = conversation.messages
        .filter(msg => msg.role !== 'system')
        .map(msg => ({
          user: msg.role === 'user' ? msg.content : null,
          ai: msg.role === 'assistant' ? msg.content : null,
          intent: msg.intent,
          timestamp: msg.created_at,
        }));

      // 取得最後一個意圖
      const lastAssistantMessage = conversation.messages
        .reverse()
        .find(msg => msg.role === 'assistant');
      if (lastAssistantMessage) {
        this.sessionContext.lastIntent = lastAssistantMessage.intent;
      }

      return conversation;
    } catch (error) {
      console.error('Load Conversation Error:', error);
      throw error;
    }
  }

  /**
   * 建立新對話
   * @param {Object} data - 對話資料 { title, context_data }
   * @returns {Promise<Object>} 新建的對話
   */
  async createConversation(data = {}) {
    try {
      const response = await this.apiClient.post('/conversations/create/', data);
      this.currentConversationId = response.data.id;
      return response.data;
    } catch (error) {
      console.error('Create Conversation Error:', error);
      throw error;
    }
  }

  /**
   * 更新對話
   * @param {number} conversationId - 對話 ID
   * @param {Object} data - 更新資料 { title, is_pinned, is_archived }
   * @returns {Promise<Object>} 更新後的對話
   */
  async updateConversation(conversationId, data) {
    try {
      const response = await this.apiClient.patch(
        `/conversations/${conversationId}/update/`,
        data
      );
      return response.data;
    } catch (error) {
      console.error('Update Conversation Error:', error);
      throw error;
    }
  }

  /**
   * 刪除對話
   * @param {number} conversationId - 對話 ID
   * @returns {Promise<void>}
   */
  async deleteConversation(conversationId) {
    try {
      await this.apiClient.delete(`/conversations/${conversationId}/delete/`);

      // 如果刪除的是當前對話，重置會話
      if (this.currentConversationId === conversationId) {
        this.resetSession();
      }
    } catch (error) {
      console.error('Delete Conversation Error:', error);
      throw error;
    }
  }

  /**
   * 封存/取消封存對話
   * @param {number} conversationId - 對話 ID
   * @param {boolean} isArchived - 是否封存
   * @returns {Promise<Object>} 更新後的對話
   */
  async archiveConversation(conversationId, isArchived = true) {
    try {
      const response = await this.apiClient.post(
        `/conversations/${conversationId}/archive/`,
        { is_archived: isArchived }
      );
      return response.data;
    } catch (error) {
      console.error('Archive Conversation Error:', error);
      throw error;
    }
  }

  /**
   * 置頂/取消置頂對話
   * @param {number} conversationId - 對話 ID
   * @param {boolean} isPinned - 是否置頂
   * @returns {Promise<Object>} 更新後的對話
   */
  async pinConversation(conversationId, isPinned = true) {
    try {
      const response = await this.apiClient.post(
        `/conversations/${conversationId}/pin/`,
        { is_pinned: isPinned }
      );
      return response.data;
    } catch (error) {
      console.error('Pin Conversation Error:', error);
      throw error;
    }
  }

  /**
   * 提交對話回饋
   * @param {number} messageId - 訊息 ID
   * @param {Object} feedback - 回饋資料 { rating, comment, is_inaccurate, is_unhelpful, is_inappropriate }
   * @returns {Promise<Object>} 回饋記錄
   */
  async submitFeedback(messageId, feedback) {
    try {
      const response = await this.apiClient.post('/feedback/', {
        message: messageId,
        ...feedback,
      });
      return response.data;
    } catch (error) {
      console.error('Submit Feedback Error:', error);
      throw error;
    }
  }

  /**
   * 開始新對話（重置當前會話）
   */
  startNewConversation() {
    this.resetSession();
  }

  /**
   * 取得當前對話 ID
   * @returns {number|null} 對話 ID
   */
  getCurrentConversationId() {
    return this.currentConversationId;
  }

  /**
   * 取得疾病檔案詳情（根據 post ID 列表）
   * @param {Array<number>} postIds - PostFrame ID 列表
   * @returns {Promise<Array>} 疾病檔案詳情列表
   */
  async getDiseaseArchiveDetails(postIds) {
    try {
      if (!postIds || postIds.length === 0) {
        return [];
      }

      // 調用後端 API 取得疾病檔案詳情
      const response = await this.apiClient.post('/disease-archives/batch/', {
        post_ids: postIds,
      });

      return response.data;
    } catch (error) {
      console.error('Get Disease Archive Details Error:', error);
      return [];
    }
  }
}

// 導出單例
export default new AIChatService();