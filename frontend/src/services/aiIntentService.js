// AI 意圖識別服務 - AI Agent 架構的核心
// 負責分析用戶自然語言輸入，識別意圖並路由到相應的專業服務

// 導入所有專業服務
import aiOperationService from './aiOperationService';
import aiRecommendationService from './aiRecommendationService';
import aiTutorialService from './aiTutorialService';
import aiFeedingService from './aiFeedingService';

class AIIntentService {
  constructor() {
    // 意圖類型定義
    this.INTENT_TYPES = {
      OPERATION: 'operation',           // 執行操作（查找記錄、設置提醒等）
      RECOMMENDATION: 'recommendation', // 推薦（用戶、文章、產品等）
      TUTORIAL: 'tutorial',            // 教學指導
      FEEDING: 'feeding',              // 飼料建議
      GENERAL: 'general',              // 一般對話
      UNKNOWN: 'unknown'               // 無法識別
    };

    // 服務映射
    this.SERVICE_MAP = {
      [this.INTENT_TYPES.OPERATION]: aiOperationService,
      [this.INTENT_TYPES.RECOMMENDATION]: aiRecommendationService,
      [this.INTENT_TYPES.TUTORIAL]: aiTutorialService,
      [this.INTENT_TYPES.FEEDING]: aiFeedingService
    };

    // 意圖識別模式庫（Demo版本）
    this.intentPatterns = this.initializeIntentPatterns();

    // 對話上下文
    this.conversationContext = {
      lastIntent: null,
      entities: {},
      sessionData: {}
    };
  }

  /**
   * 初始化意圖識別模式
   */
  initializeIntentPatterns() {
    return {
      // 操作意圖模式
      [this.INTENT_TYPES.OPERATION]: [
        {
          patterns: ['幫我找', '查找', '搜尋', '找出', '顯示'],
          keywords: ['記錄', '異常', '健康', '疫苗', '提醒'],
          operationTypes: {
            'findAbnormalPosts': ['異常記錄', '異常', '問題', '症狀'],
            'findHealthRecords': ['健康記錄', '醫療記錄', '病歷'],
            'setFeedingReminder': ['餵食提醒', '餵食', '提醒'],
            'searchNearbyHospitals': ['附近醫院', '動物醫院', '獸醫']
          }
        }
      ],

      // 推薦意圖模式
      [this.INTENT_TYPES.RECOMMENDATION]: [
        {
          patterns: ['推薦', '介紹', '建議', '有什麼', '可以推薦'],
          keywords: ['用戶', '文章', '貼文', '論壇'],
          recommendationTypes: {
            'users': ['用戶', '飼主', '朋友', '追蹤'],
            'articles': ['文章', '貼文', '討論', '經驗', '分享'],
            'posts': ['貼文', '動態', '發文']
          }
        }
      ],

      // 教學意圖模式
      [this.INTENT_TYPES.TUTORIAL]: [
        {
          patterns: ['如何', '怎麼', '教學', '學習', '操作', '使用方法'],
          keywords: ['標註', '貼文', '設置', '功能'],
          tutorialTypes: {
            'tagPet': ['標註', '標記', '寵物標註'],
            'createPost': ['發文', '貼文', '創建', '新增'],
            'setReminder': ['設置', '提醒', '設定'],
            'healthRecord': ['健康記錄', '記錄', '健康管理']
          }
        }
      ],

      // 飼料建議意圖模式
      [this.INTENT_TYPES.FEEDING]: [
        {
          patterns: ['飼料', '食物', '營養', '餵食', '吃什麼'],
          keywords: ['推薦', '建議', '適合', '比較', '選擇', '品牌'],
          feedingTypes: {
            'recommendation': ['推薦', '建議', '適合'],
            'comparison': ['比較', '差別', '哪個好'],
            'nutrition': ['營養', '成分', '分析']
          }
        }
      ]
    };
  }

  /**
   * 分析用戶輸入並路由到相應服務
   * @param {string} userInput - 用戶輸入
   * @param {Object} context - 對話上下文
   * @returns {Promise<Object>} 處理結果
   */
  async processUserInput(userInput, context = {}) {
    try {
      // 1. 預處理輸入
      const preprocessedInput = this.preprocessInput(userInput);

      // 2. 識別意圖
      const intentResult = await this.identifyIntent(preprocessedInput);

      // 3. 提取實體
      const entities = this.extractEntities(preprocessedInput, intentResult.intent);

      // 4. 更新對話上下文
      this.updateContext(intentResult, entities, context);

      // 5. 路由到相應服務
      const serviceResult = await this.routeToService(intentResult, entities, context);

      // 6. 生成統一回應格式
      const response = this.formatResponse(serviceResult, intentResult, entities);

      return {
        success: true,
        intent: intentResult.intent,
        confidence: intentResult.confidence,
        entities,
        response,
        serviceUsed: intentResult.serviceType,
        context: this.conversationContext
      };

    } catch (error) {
      console.error('AI Intent Service 處理失敗:', error);
      return {
        success: false,
        error: error.message,
        fallbackResponse: '抱歉，我無法理解您的請求。您可以試著換個方式問我。'
      };
    }
  }

  /**
   * 識別用戶意圖
   * @param {string} input - 預處理後的輸入
   * @returns {Promise<Object>} 意圖識別結果
   */
  async identifyIntent(input) {
    // Demo 模式：使用規則匹配
    // 未來可替換為真實的 NLP 模型

    let bestMatch = {
      intent: this.INTENT_TYPES.UNKNOWN,
      confidence: 0,
      serviceType: null,
      subType: null
    };

    // 遍歷所有意圖模式
    for (const [intentType, patterns] of Object.entries(this.intentPatterns)) {
      for (const pattern of patterns) {
        const score = this.calculateIntentScore(input, pattern);

        if (score > bestMatch.confidence) {
          bestMatch = {
            intent: intentType,
            confidence: score,
            serviceType: intentType,
            subType: this.identifySubType(input, pattern)
          };
        }
      }
    }

    // 設置最低置信度閾值
    if (bestMatch.confidence < 0.3) {
      bestMatch.intent = this.INTENT_TYPES.GENERAL;
      bestMatch.serviceType = 'general';
    }

    return bestMatch;
  }

  /**
   * 計算意圖匹配分數
   * @param {string} input - 輸入文本
   * @param {Object} pattern - 模式配置
   * @returns {number} 匹配分數
   */
  calculateIntentScore(input, pattern) {
    let score = 0;

    // 檢查模式匹配
    for (const patternWord of pattern.patterns) {
      if (input.includes(patternWord)) {
        score += 0.3;
      }
    }

    // 檢查關鍵詞匹配
    for (const keyword of pattern.keywords) {
      if (input.includes(keyword)) {
        score += 0.4;
      }
    }

    // 檢查子類型匹配
    if (pattern.operationTypes || pattern.recommendationTypes ||
        pattern.tutorialTypes || pattern.feedingTypes) {
      const subTypes = pattern.operationTypes || pattern.recommendationTypes ||
                      pattern.tutorialTypes || pattern.feedingTypes;

      for (const [subType, subKeywords] of Object.entries(subTypes)) {
        for (const subKeyword of subKeywords) {
          if (input.includes(subKeyword)) {
            score += 0.3;
          }
        }
      }
    }

    return Math.min(score, 1.0); // 限制最大分數為1.0
  }

  /**
   * 識別子類型
   * @param {string} input - 輸入文本
   * @param {Object} pattern - 模式配置
   * @returns {string|null} 子類型
   */
  identifySubType(input, pattern) {
    const subTypeConfig = pattern.operationTypes || pattern.recommendationTypes ||
                         pattern.tutorialTypes || pattern.feedingTypes;

    if (!subTypeConfig) return null;

    for (const [subType, keywords] of Object.entries(subTypeConfig)) {
      for (const keyword of keywords) {
        if (input.includes(keyword)) {
          return subType;
        }
      }
    }

    return null;
  }

  /**
   * 提取實體信息
   * @param {string} input - 輸入文本
   * @param {string} intent - 意圖類型
   * @returns {Object} 提取的實體
   */
  extractEntities(input, intent) {
    const entities = {};

    // 提取時間相關實體
    const timePatterns = {
      '最近': { period: 7, unit: 'days' },
      '兩個禮拜': { period: 14, unit: 'days' },
      '一個月': { period: 30, unit: 'days' },
      '三個月': { period: 90, unit: 'days' }
    };

    for (const [timeWord, timeValue] of Object.entries(timePatterns)) {
      if (input.includes(timeWord)) {
        entities.timeRange = timeValue;
        break;
      }
    }

    // 提取寵物相關實體
    const petPatterns = ['吉娃娃', '布偶貓', '黃金獵犬', '波斯貓', '柴犬'];
    for (const petType of petPatterns) {
      if (input.includes(petType)) {
        entities.petBreed = petType;
        break;
      }
    }

    // 提取症狀相關實體
    const symptomPatterns = ['咳嗽', '嘔吐', '發燒', '食慾不振', '精神不濟'];
    entities.symptoms = symptomPatterns.filter(symptom => input.includes(symptom));

    // 提取飼料品牌實體
    const brandPatterns = ['耐吉斯', 'toma-pro', 'royal canin', 'hills'];
    for (const brand of brandPatterns) {
      if (input.toLowerCase().includes(brand.toLowerCase())) {
        entities.feedBrand = brand;
        break;
      }
    }

    return entities;
  }

  /**
   * 路由到相應的專業服務
   * @param {Object} intentResult - 意圖識別結果
   * @param {Object} entities - 提取的實體
   * @param {Object} context - 對話上下文
   * @returns {Promise<Object>} 服務處理結果
   */
  async routeToService(intentResult, entities, context) {
    const { intent, subType } = intentResult;
    const service = this.SERVICE_MAP[intent];

    if (!service) {
      return this.handleGeneralIntent(intentResult, entities, context);
    }

    try {
      switch (intent) {
        case this.INTENT_TYPES.OPERATION:
          return await this.handleOperationIntent(service, subType, entities, context);

        case this.INTENT_TYPES.RECOMMENDATION:
          return await this.handleRecommendationIntent(service, subType, entities, context);

        case this.INTENT_TYPES.TUTORIAL:
          return await this.handleTutorialIntent(service, subType, entities, context);

        case this.INTENT_TYPES.FEEDING:
          return await this.handleFeedingIntent(service, subType, entities, context);

        default:
          return this.handleGeneralIntent(intentResult, entities, context);
      }
    } catch (error) {
      console.error(`服務路由失敗 (${intent}):`, error);
      throw error;
    }
  }

  /**
   * 處理操作意圖
   */
  async handleOperationIntent(service, subType, entities, context) {
    const operationType = subType || 'findAbnormalPosts';
    const params = {
      ...entities,
      petId: context.petId || 1 // Demo 預設值
    };

    return {
      serviceType: 'operation',
      operationType,
      hasOperation: true,
      response: '好的！我來幫你執行這個操作。',
      params
    };
  }

  /**
   * 處理推薦意圖
   */
  async handleRecommendationIntent(service, subType, entities, context) {
    const recommendationType = subType || 'users';

    if (recommendationType === 'users') {
      const result = await service.getRecommendedUsers({
        context: 'chat_recommendation',
        ...entities
      });

      return {
        serviceType: 'recommendation',
        recommendationType: 'users',
        hasRecommendedUsers: true,
        response: '好的！以下是一些推薦的用戶，您可以關注他們：',
        data: result
      };
    } else if (recommendationType === 'articles') {
      const result = await service.getRecommendedArticles({
        context: 'health_consultation',
        ...entities
      });

      return {
        serviceType: 'recommendation',
        recommendationType: 'articles',
        hasRecommendedArticles: true,
        response: '以下是相關的文章推薦，供您參考：',
        data: result
      };
    }

    return {
      serviceType: 'recommendation',
      response: '我會為您提供相關推薦。'
    };
  }

  /**
   * 處理教學意圖
   */
  async handleTutorialIntent(service, subType, entities, context) {
    const tutorialType = subType || 'tagPet';
    const tutorialConfig = await service.getTutorialConfig(tutorialType);

    let response = '我明白了，您希望學習相關操作。';
    if (tutorialConfig) {
      response = `我明白了，您希望學習${tutorialConfig.title}。${tutorialConfig.description}，預計需要${tutorialConfig.estimatedTime}。\n\n請問您希望使用教學模式嗎？我可以帶著您完整操作一遍。`;
    }

    return {
      serviceType: 'tutorial',
      tutorialType,
      hasTutorial: true,
      response
    };
  }

  /**
   * 處理飼料建議意圖
   */
  async handleFeedingIntent(service, subType, entities, context) {
    const petProfile = {
      pet_type: entities.petBreed?.includes('貓') ? 'cat' : 'dog',
      age_stage: 'senior', // Demo 預設
      health_condition: 'liver_disease', // Demo 預設
      ...context.petProfile
    };

    const result = await service.getFeedingRecommendation(petProfile);

    if (result.success) {
      return {
        serviceType: 'feeding',
        hasCalculator: true,
        response: result.recommendation.reason + '\n\n' + result.recommendation.suggestion,
        data: result
      };
    }

    return {
      serviceType: 'feeding',
      response: '抱歉，無法獲取飼料建議。請稍後再試。'
    };
  }

  /**
   * 處理一般對話意圖
   */
  handleGeneralIntent(intentResult, entities, context) {
    const generalResponses = [
      '我理解您的問題。您可以問我關於寵物照護、健康管理、或是 App 功能的問題！',
      '這個問題很有趣！您可以說得更具體一些嗎？',
      '我可以幫您處理寵物相關的各種問題。請告訴我您需要什麼幫助？'
    ];

    return {
      serviceType: 'general',
      response: generalResponses[Math.floor(Math.random() * generalResponses.length)]
    };
  }

  /**
   * 格式化最終回應
   */
  formatResponse(serviceResult, intentResult, entities) {
    return {
      text: serviceResult.response,
      intent: intentResult.intent,
      confidence: intentResult.confidence,
      serviceUsed: serviceResult.serviceType,

      // 傳遞服務特定的標記
      hasTutorial: serviceResult.hasTutorial || false,
      tutorialType: serviceResult.tutorialType || null,
      hasRecommendedUsers: serviceResult.hasRecommendedUsers || false,
      hasRecommendedArticles: serviceResult.hasRecommendedArticles || false,
      hasCalculator: serviceResult.hasCalculator || false,
      hasOperation: serviceResult.hasOperation || false,
      operationType: serviceResult.operationType || null,

      // 附加資料
      data: serviceResult.data || null,
      params: serviceResult.params || null
    };
  }

  /**
   * 更新對話上下文
   */
  updateContext(intentResult, entities, context) {
    this.conversationContext.lastIntent = intentResult.intent;
    this.conversationContext.entities = { ...this.conversationContext.entities, ...entities };
    this.conversationContext.sessionData = { ...this.conversationContext.sessionData, ...context };
  }

  /**
   * 預處理輸入
   */
  preprocessInput(input) {
    return input
      .toLowerCase()
      .trim()
      .replace(/[！。？，、；：「」『』（）【】]/g, '')
      .replace(/[!.?,;:()[\]{}]/g, '');
  }

  /**
   * 獲取支援的意圖類型
   */
  getSupportedIntents() {
    return Object.values(this.INTENT_TYPES);
  }

  /**
   * 重置對話上下文
   */
  resetContext() {
    this.conversationContext = {
      lastIntent: null,
      entities: {},
      sessionData: {}
    };
  }

  /**
   * 未來可以實作的真實 AI API 調用方法
   */

  // async fetchIntentFromAI(input) {
  //   const response = await fetch('/api/ai/intent/analyze', {
  //     method: 'POST',
  //     headers: { 'Content-Type': 'application/json' },
  //     body: JSON.stringify({ text: input })
  //   });
  //   return response.json();
  // }

  // async fetchEntitiesFromAI(input, intent) {
  //   const response = await fetch('/api/ai/entities/extract', {
  //     method: 'POST',
  //     headers: { 'Content-Type': 'application/json' },
  //     body: JSON.stringify({ text: input, intent })
  //   });
  //   return response.json();
  // }
}

// 導出單例
export default new AIIntentService();