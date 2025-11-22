// AI Chat Service - 連接後端 AI Agent API
// 整合 OpenAI Agents SDK with MCP tools

import axiosInstance from '../utils/axios';

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
    // 當前 OpenAI Session ID（用於延續同一個 AI 對話）
    this.currentSessionId = null;
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
        session_id: this.currentSessionId, // 加入 OpenAI Session ID 以延續對話
        context: {
          ...this.sessionContext,
          ...additionalContext,
          timestamp: new Date().toISOString(),
        },
      };

      // DEBUG: Log what we're sending
      console.log('[AIChatService] Sending message with session_id:', this.currentSessionId);
      console.log('[AIChatService] Request data:', { conversationId: requestData.conversationId, session_id: requestData.session_id });

      // 調用後端 API
  const response = await this.apiClient.post(`${this.basePath}/chat/`, requestData);

      // 更新當前對話 ID（如果是新對話，後端會返回）
      if (response.data.conversationId) {
        this.currentConversationId = response.data.conversationId;
      }

      // 更新當前 Session ID（OpenAI 對話延續 ID）
      if (response.data.session_id) {
        this.currentSessionId = response.data.session_id;
        console.log('[AIChatService] Updated session_id to:', this.currentSessionId);
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
    this.currentSessionId = null; // 也重置 Session ID
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
      // Guard: if missing/invalid id, throw error (don't auto-create)
      if (!conversationId || String(conversationId) === 'undefined') {
        throw new Error('Invalid conversation id - no conversation to load');
      }
      const conversation = await this.getConversationDetail(conversationId);

      // 設定為當前對話
      this.currentConversationId = conversationId;

      // 提取並設定 OpenAI Session ID（從訊息的 message_data 或 additional_data 中）
      // 這樣可以延續同一個 OpenAI 對話，而不是每次重開都建立新對話
      this.currentSessionId = null;
      if (conversation.messages && conversation.messages.length > 0) {
        console.log(`[AIChatService] Looking for session_id in ${conversation.messages.length} messages`);
        // 從最後一條助手訊息中提取 session_id
        for (let i = conversation.messages.length - 1; i >= 0; i--) {
          const msg = conversation.messages[i];
          // Try message_data first (for compatibility), then additional_data
          const sessionId = msg.message_data?.session_id || msg.additional_data?.session_id;
          console.log(`[AIChatService] Message ${i}: role=${msg.role}, session_id=${sessionId}`);
          if (msg.role === 'assistant' && sessionId) {
            this.currentSessionId = sessionId;
            console.log(`[AIChatService] ✓ Restored session_id: ${this.currentSessionId}`);
            break;
          }
        }
        if (!this.currentSessionId) {
          console.warn('[AIChatService] ✗ No session_id found in conversation messages!');
        }
      }

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

  /**
   * 為貼文上傳圖片（AI Agent 建立貼文後使用）
   * @param {number} postId - 貼文 ID
   * @param {Array<Object>} images - 圖片陣列 [{file, preview, id}]
   * @returns {Promise<Object>} 上傳結果
   */
  async uploadPostImages(postId, images) {
    try {
      if (!postId) {
        throw new Error('Post ID is required');
      }

      if (!images || images.length === 0) {
        throw new Error('At least one image is required');
      }

      // 建立 FormData
      const formData = new FormData();

      // 添加圖片檔案
      images.forEach((image, index) => {
        if (image.file) {
          formData.append('images', image.file);
        }
      });

      console.log(`[AIChatService] Uploading ${images.length} images to post ${postId}`);

      // 調用上傳 API
      const response = await this.apiClient.post(
        `/social/posts/${postId}/upload-images/`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      console.log('[AIChatService] Image upload successful:', response.data);
      return response.data;

    } catch (error) {
      console.error('Upload Post Images Error:', error);
      throw error;
    }
  }

  /**
   * 為異常記錄上傳圖片（AI Agent 建立異常記錄後使用）
   * @param {number} abnormalPostId - 異常記錄 ID
   * @param {Array<Object>} images - 圖片陣列 [{file, preview, id}]
   * @returns {Promise<Object>} 上傳結果
   */
  async uploadAbnormalPostImages(abnormalPostId, images) {
    try {
      if (!abnormalPostId) {
        throw new Error('Abnormal post ID is required');
      }

      if (!images || images.length === 0) {
        throw new Error('At least one image is required');
      }

      // 建立 FormData
      const formData = new FormData();

      // 添加圖片檔案
      images.forEach((image, index) => {
        if (image.file) {
          formData.append('images', image.file);
        }
      });

      console.log(`[AIChatService] Uploading ${images.length} images to abnormal post ${abnormalPostId}`);

      // 調用上傳 API
      const response = await this.apiClient.post(
        `/pets/abnormal-posts/${abnormalPostId}/upload-images/`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      console.log('[AIChatService] Abnormal post image upload successful:', response.data);
      return response.data;

    } catch (error) {
      console.error('Upload Abnormal Post Images Error:', error);
      throw error;
    }
  }

  /**
   * 為飼料上傳圖片（AI Agent 建立飼料後使用）
   * @param {number} feedId - 飼料 ID
   * @param {Array<Object>} images - 圖片陣列 [{file, preview, id}]
   * @returns {Promise<Object>} 上傳結果
   */
  async uploadFeedImages(feedId, images) {
    try {
      if (!feedId) {
        throw new Error('Feed ID is required');
      }

      if (!images || images.length === 0) {
        throw new Error('At least one image is required');
      }

      // 獲取 OCR 識別出的圖片類型映射
      let imageTypeMap = null;
      try {
        const storedMap = localStorage.getItem('feedImageTypeMap');
        if (storedMap) {
          imageTypeMap = JSON.parse(storedMap);
          console.log('[AIChatService] 使用 OCR 識別的圖片類型映射:', imageTypeMap);
        }
      } catch (e) {
        console.warn('[AIChatService] 無法讀取圖片類型映射，使用預設順序');
      }

      // 建立 FormData
      const formData = new FormData();

      // 根據圖片類型映射重新排序圖片
      // 後端期待：第一張 = front, 第二張 = nutrition
      if (imageTypeMap) {
        // 找出哪張圖片是 front 和 nutrition
        const frontIndex = Object.keys(imageTypeMap).find(key => imageTypeMap[key] === 'front');
        const nutritionIndex = Object.keys(imageTypeMap).find(key => imageTypeMap[key] === 'nutrition');

        // 按照 front, nutrition 的順序添加
        if (frontIndex !== undefined && images[frontIndex]) {
          formData.append('images', images[frontIndex].file);
          console.log(`[AIChatService] 第 1 張（front）: 原始第 ${parseInt(frontIndex) + 1} 張圖片`);
        }
        if (nutritionIndex !== undefined && images[nutritionIndex]) {
          formData.append('images', images[nutritionIndex].file);
          console.log(`[AIChatService] 第 2 張（nutrition）: 原始第 ${parseInt(nutritionIndex) + 1} 張圖片`);
        }
      } else {
        // 沒有類型映射時，使用原始順序
        images.forEach((image, index) => {
          if (image.file) {
            formData.append('images', image.file);
            console.log(`[AIChatService] 第 ${index + 1} 張: 原始順序`);
          }
        });
      }

      console.log(`[AIChatService] Uploading ${images.length} images to feed ${feedId}`);

      // 調用上傳 API
      const response = await this.apiClient.post(
        `/feeds/${feedId}/upload-images/`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      console.log('[AIChatService] Feed image upload successful:', response.data);
      
      // 清除 localStorage 中的圖片類型映射
      try {
        localStorage.removeItem('feedImageTypeMap');
      } catch (e) {
        console.warn('[AIChatService] 無法清除圖片類型映射');
      }

      return response.data;

    } catch (error) {
      console.error('Upload Feed Images Error:', error);
      throw error;
    }
  }

  /**
   * 辨識飼料營養標示（使用現有的 OCR API）
   * @param {Object} nutritionImage - 營養標示圖片 {file, preview, id}
   * @returns {Promise<Object>} OCR 辨識結果
   */
  async analyzeFeedNutrition(nutritionImage) {
    try {
      if (!nutritionImage || !nutritionImage.file) {
        throw new Error('Nutrition image is required');
      }

      const formData = new FormData();
      formData.append('image', nutritionImage.file);

      console.log(`[AIChatService] Analyzing nutrition label with OCR`);

      const response = await this.apiClient.post(
        `/feeds/ocr/`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      console.log('[AIChatService] OCR analysis successful:', response.data);
      return {
        success: true,
        data: response.data
      };

    } catch (error) {
      console.error('Analyze Feed Nutrition Error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 分析飼料圖片（兩張圖片：包裝正面 + 營養標示）
   * 自動識別哪張是營養標示並提取營養成分
   * @param {Array<Object>} images - 圖片陣列 [{file, preview, id}]
   * @returns {Promise<Object>} OCR 結果
   */
  async analyzeFeedWithOCR(images) {
    console.log('[AIChatService] Starting OCR feed analysis');

    try {
      if (!images || images.length < 2) {
        throw new Error('請選擇兩張圖片：包裝照片和營養標示照片');
      }

      console.log('[AIChatService] 辨識兩張圖片以找出營養標示...');

      // 輔助函數：將 base64 轉換為 Blob
      const base64ToBlob = (base64String, fileType) => {
        const base64Data = base64String.split(',')[1];
        const byteCharacters = atob(base64Data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        return new Blob([byteArray], { type: fileType });
      };

      // 輔助函數：標準化營養成分（將 null/undefined 轉為 0）
      const normalizeNutrients = (nutrients) => {
        const normalized = {
          protein: 0,
          fat: 0,
          carbohydrate: 0,
          calcium: 0,
          phosphorus: 0,
          magnesium: 0,
          sodium: 0
        };

        // 覆蓋有值的營養成分
        Object.keys(normalized).forEach(key => {
          const value = nutrients[key];
          if (value !== null && value !== undefined && value !== '') {
            const parsed = parseFloat(value);
            if (!isNaN(parsed) && parsed >= 0) {
              normalized[key] = parsed;
            }
          }
        });

        return normalized;
      };

      // 輔助函數：計算營養成分資料的完整度
      const calculateNutrientScore = (nutrients) => {
        let score = 0;
        const keys = ['protein', 'fat', 'carbohydrate', 'calcium', 'phosphorus', 'magnesium', 'sodium'];

        keys.forEach(key => {
          if (nutrients[key] !== null && nutrients[key] !== undefined && nutrients[key] > 0) {
            score++;
          }
        });

        return score;
      };

      // 辨識兩張圖片
      const ocrResults = [];

      for (let i = 0; i < 2; i++) {
        try {
          const image = images[i];
          const formData = new FormData();
          const blob = base64ToBlob(image.preview, image.file.type);
          formData.append('image', blob, image.file.name);

          console.log(`[AIChatService] 辨識第 ${i + 1} 張圖片...`);

          const response = await this.apiClient.post('/feeds/ocr/', formData, {
            headers: {
              'Content-Type': 'multipart/form-data',
            },
          });

          // 標準化營養成分（將 null/undefined 轉為 0）
          const rawNutrients = response.data.extracted_nutrients || {};
          const nutrients = normalizeNutrients(rawNutrients);
          const score = calculateNutrientScore(nutrients);

          ocrResults.push({
            index: i,
            nutrients,
            score,
            rawText: response.data.raw_text
          });

          console.log(`[AIChatService] 第 ${i + 1} 張圖片辨識完成，營養成分數量: ${score}`);

        } catch (error) {
          console.warn(`[AIChatService] 第 ${i + 1} 張圖片辨識失敗:`, error);
          ocrResults.push({
            index: i,
            nutrients: normalizeNutrients({}),  // 使用標準化的空營養成分（全為 0）
            score: 0,
            error: error.message
          });
        }
      }

      // 選擇營養成分最完整的結果
      ocrResults.sort((a, b) => b.score - a.score);
      const bestResult = ocrResults[0];

      if (bestResult.score === 0) {
        throw new Error('兩張圖片都無法辨識出營養成分，請確保上傳清晰的營養標示照片');
      }

      // 建立圖片類型映射：分數最高的是 nutrition，另一張是 front
      const nutritionIndex = bestResult.index;
      const frontIndex = nutritionIndex === 0 ? 1 : 0;
      
      const imageTypeMap = {
        [nutritionIndex]: 'nutrition',  // 營養標示（辨識出營養成分的那張）
        [frontIndex]: 'front'            // 包裝正面（另一張）
      };

      console.log(`[AIChatService] 圖片類型識別結果:`);
      console.log(`  - 第 ${nutritionIndex + 1} 張圖片: nutrition (營養成分數量: ${bestResult.score})`);
      console.log(`  - 第 ${frontIndex + 1} 張圖片: front`);
      console.log('[AIChatService] 營養成分:', bestResult.nutrients);

      // 將 OCR 結果和圖片類型映射存到 localStorage
      localStorage.setItem('feedOcrData', JSON.stringify(bestResult.nutrients));
      localStorage.setItem('feedImageTypeMap', JSON.stringify(imageTypeMap));

      return {
        success: true,
        ocrData: bestResult.nutrients,
        rawText: bestResult.rawText,
        nutritionImageIndex: nutritionIndex,
        frontImageIndex: frontIndex,
        imageTypeMap: imageTypeMap,
        message: `OCR 辨識完成 (第 ${nutritionIndex + 1} 張為營養標示，第 ${frontIndex + 1} 張為包裝正面)`
      };

    } catch (error) {
      console.error('[AIChatService] OCR analysis failed:', error);
      throw error;
    }
  }
}

// 導出單例
export default new AIChatService();