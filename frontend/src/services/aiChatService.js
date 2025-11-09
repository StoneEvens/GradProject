// AI Chat Service - 連接後端 AI Agent API
// 整合 OpenAI Agents SDK with MCP tools

import axiosInstance from '../utils/axios';
import operationClient from './operationClient';

class AIChatService {
  constructor() {
    // Use shared axios instance with standard interceptors
    this.apiClient = axiosInstance;
    this.basePath = '/ai';
    this.agentBasePath = '/ai-agent'; // for legacy endpoints still provided by aiAgent app

    // 會話上下文管理
    this.sessionContext = {
      conversationHistory: [],
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
  const response = await this.apiClient.post(`${this.basePath}/chat/`, requestData);

      // 更新當前對話 ID（如果是新對話，後端會返回）
      if (response.data.conversationId) {
        this.currentConversationId = response.data.conversationId;
      }

      // 更新會話上下文
      this.updateSessionContext(userMessage, response.data);

      // Check if backend returned operations and add them to operation client
      if (response.data.operations && Array.isArray(response.data.operations)) {
        console.log('[AIChatService] Received operations from backend:', response.data.operations);
        const result = operationClient.addOperations(response.data.operations);
        console.log(`[AIChatService] Added ${result.success} operations to queue, ${result.failed} failed`);
        
        // Add operation count info to response for logging
        response.data.operationCount = result.success;
      }

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
      timestamp: new Date().toISOString(),
    });

    // 限制歷史記錄數量
    if (this.sessionContext.conversationHistory.length > 10) {
      this.sessionContext.conversationHistory.shift();
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
        error: true,
        tutorial: null,
        hasCalculator: false,
        operations: [],
  recommendedUsers: [],
        recommendedSocialPosts: [],
        recommendedForumPosts: []
      };
    }

    // API 錯誤
    if (error.response) {
      return {
        response: error.response.data?.response || '抱歉，處理您的請求時發生錯誤。',
        error: true,
        detail: error.response.data?.detail,
        tutorial: null,
        hasCalculator: false,
        operations: [],
  recommendedUsers: [],
        recommendedSocialPosts: [],
        recommendedForumPosts: []
      };
    }

    // 未知錯誤
    return {
      response: '抱歉，發生了未預期的錯誤。',
      error: true,
      tutorial: null,
      hasCalculator: false,
      operations: [],
  recommendedUsers: [],
      recommendedSocialPosts: [],
      recommendedForumPosts: []
    };
  }

  /**
   * 檢查 AI 服務健康狀態
   * @returns {Promise<Object>} 服務狀態
   */
  async checkHealth() {
    try {
  const response = await this.apiClient.get(`${this.agentBasePath}/health/`);
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
  resetSessionContext() {
    this.sessionContext = {
      conversationHistory: [],
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
  const response = await this.apiClient.get(`${this.basePath}/conversations/`, { params });
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
      if (!conversationId || String(conversationId) === 'undefined') {
        throw new Error('Invalid conversation id');
      }
      const response = await this.apiClient.get(`${this.basePath}/conversations/${conversationId}/`);
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
      // Guard: if missing/invalid id, auto-create a new AI conversation in正确的命名空间
      if (!conversationId || String(conversationId) === 'undefined') {
        const created = await this.createConversation({ title: '新對話' });
        conversationId = created.id;
      }
      const conversation = await this.getConversationDetail(conversationId);

      // 設定為當前對話
      this.currentConversationId = conversationId;

      // 重建對話歷史到 sessionContext
      // Messages are stored in database and returned immediately
      if (conversation.messages && conversation.messages.length > 0) {
        // Convert database format to session format
        // Group user/assistant messages into pairs
        this.sessionContext.conversationHistory = [];
        let currentPair = {};
        
        for (const msg of conversation.messages) {
          if (msg.role === 'user') {
            currentPair = { user: msg.content, timestamp: msg.created_at };
          } else if (msg.role === 'assistant') {
            currentPair.ai = msg.content;
            this.sessionContext.conversationHistory.push(currentPair);
            currentPair = {};
          }
        }
        
        console.log(`[AIChatService] Loaded conversation ${conversationId} with ${this.sessionContext.conversationHistory.length} message pairs`);
      } else {
        // Empty history
        this.sessionContext.conversationHistory = [];
        console.log('[AIChatService] Loaded empty conversation');
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
      // Use AI (AgentThread) namespace so conversation details align with /ai/conversations/:id
      const response = await this.apiClient.post(`${this.basePath}/conversations/create/`, data);
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
        `${this.basePath}/conversations/${conversationId}/update/`,
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
  await this.apiClient.delete(`${this.basePath}/conversations/${conversationId}/delete/`);

      // 如果刪除的是當前對話，重置會話
      if (this.currentConversationId === conversationId) {
        this.resetSessionContext();
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
        `${this.basePath}/conversations/${conversationId}/archive/`,
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
        `${this.agentBasePath}/conversations/${conversationId}/pin/`,
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
      const response = await this.apiClient.post(`${this.agentBasePath}/feedback/`, {
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
    this.resetSessionContext();
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
      const response = await this.apiClient.post(`${this.agentBasePath}/disease-archives/batch/`, {
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