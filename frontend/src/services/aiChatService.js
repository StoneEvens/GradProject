import knowledgeBase from '../data/aiKnowledgeBase.json';

class AIChatService {
  constructor() {
    this.kb = knowledgeBase.knowledgeBase;
    this.defaultResponses = knowledgeBase.defaultResponses;
    this.apiConfig = knowledgeBase.apiEndpoints;
  }

  // 主要的訊息處理函數
  async processMessage(userInput) {
    try {
      // 預處理用戶輸入
      const processedInput = this.preprocessInput(userInput);

      // 嘗試從本地知識庫找到匹配
      const localResponse = this.findLocalMatch(processedInput);

      if (localResponse.confidence > 0.6) {
        return {
          response: localResponse.message,
          source: 'local',
          confidence: localResponse.confidence
        };
      }

      // 如果本地匹配度不高，且啟用了 API fallback
      if (this.apiConfig.fallbackToAPI.enabled && localResponse.confidence < this.apiConfig.fallbackToAPI.threshold) {
        return await this.callAIAPI(userInput);
      }

      // 使用預設回應
      return {
        response: this.getRandomResponse(this.defaultResponses),
        source: 'default',
        confidence: 0.3
      };

    } catch (error) {
      console.error('AI Chat Service Error:', error);
      return {
        response: "抱歉，我暫時無法理解您的問題。請稍後再試，或者描述得更具體一些。",
        source: 'error',
        confidence: 0
      };
    }
  }

  // 預處理用戶輸入
  preprocessInput(input) {
    return input
      .toLowerCase()
      .trim()
      .replace(/[！。？，、；：「」『』（）【】]/g, '') // 移除中文標點
      .replace(/[!.?,;:()\[\]{}]/g, ''); // 移除英文標點
  }

  // 在本地知識庫中尋找匹配
  findLocalMatch(processedInput) {
    let bestMatch = {
      message: '',
      confidence: 0,
      category: ''
    };

    // 遍歷知識庫的每個分類
    for (const [category, data] of Object.entries(this.kb)) {
      const matchScore = this.calculateMatchScore(processedInput, data.keywords);

      if (matchScore > bestMatch.confidence) {
        bestMatch = {
          message: this.getRandomResponse(data.responses),
          confidence: matchScore,
          category: category
        };
      }
    }

    return bestMatch;
  }

  // 計算匹配分數
  calculateMatchScore(input, keywords) {
    let score = 0;
    let totalKeywords = keywords.length;

    for (const keyword of keywords) {
      if (input.includes(keyword.toLowerCase())) {
        // 關鍵字匹配基礎分數
        score += 1;

        // 如果是完全匹配，給予額外分數
        if (input === keyword.toLowerCase()) {
          score += 0.5;
        }

        // 如果關鍵字在輸入開頭，給予額外分數
        if (input.startsWith(keyword.toLowerCase())) {
          score += 0.3;
        }
      }
    }

    // 正規化分數 (0-1 之間)
    return Math.min(score / totalKeywords, 1);
  }

  // 從回應陣列中隨機選擇一個
  getRandomResponse(responses) {
    if (!Array.isArray(responses) || responses.length === 0) {
      return "我需要更多資訊才能幫助您。";
    }
    return responses[Math.floor(Math.random() * responses.length)];
  }

  // 調用外部 AI API (為未來擴展預留)
  async callAIAPI(userInput) {
    try {
      // 這裡將來可以整合 OpenAI API 或其他 AI 服務
      const response = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userInput,
          model: this.apiConfig.openaiConfig.model,
          systemPrompt: this.apiConfig.openaiConfig.systemPrompt,
          maxTokens: this.apiConfig.openaiConfig.maxTokens,
          temperature: this.apiConfig.openaiConfig.temperature
        })
      });

      if (response.ok) {
        const data = await response.json();
        return {
          response: data.message,
          source: 'api',
          confidence: 0.9
        };
      }
    } catch (error) {
      console.error('AI API Error:', error);
    }

    // API 調用失敗時的 fallback
    return {
      response: this.getRandomResponse(this.defaultResponses),
      source: 'fallback',
      confidence: 0.4
    };
  }

  // 獲取建議問題 (可選功能)
  getSuggestedQuestions() {
    return [
      "如何使用寵物照護功能？",
      "怎麼在社群發布照片？",
      "如何找到附近的寵物醫院？",
      "怎麼設定餵食提醒？",
      "App 有哪些主要功能？"
    ];
  }

  // 更新知識庫 (為未來的學習功能預留)
  updateKnowledgeBase(category, keywords, responses) {
    // 這個功能可以在未來實現動態學習
    console.log('Knowledge base update requested:', { category, keywords, responses });
  }
}

// 導出單例實例
export default new AIChatService();