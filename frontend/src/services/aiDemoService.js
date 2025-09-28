// AI Demo Service - 用於展示的預設問答服務
// 這是一個純前端的 Demo Service，所有問答都是預先寫死的

class AIDemoService {
  constructor() {
    // 預設的問答對照表
    // 可以根據需要新增或修改問答內容
    this.demoQA = [
      {
        // 問題可以是陣列，支援多種問法
        questions: ['請問如何在貼文裡標註寵物？', '標註寵物', '標記寵物', '怎麼標註'],
        answers: [
          '我明白了，您希望在貼文的相片中標註寵物。如果要在貼文的相片中標註寵物，可以在建立貼文時點擊已新增的相片叫出相片編輯視窗，並在該視窗中標註寵物。\n請問您希望使用教學模式嗎？我可以帶著您完整操作一遍。',
        ],
        // 標記此回應需要顯示教學按鈕
        hasTutorial: true,
        tutorialType: 'tagPet' // 教學類型，用於識別不同的教學流程
      },
      {
        questions: ['我很喜歡布偶貓，可以推薦我幾個有養布偶貓的用戶嗎？', '推薦用戶', '推薦養貓的用戶', '有養貓的用戶'],
        answers: [
          '好的！以下是一些有養布偶貓且帳戶為公開的用戶，您可以關注他們，看看他們分享的可愛貓咪日常：'
        ],
        // 標記此回應需要顯示推薦用戶
        hasRecommendedUsers: true
      },
      {
        questions: ['我的吉娃娃目前有點咳嗽的症狀，請問他可能是生了甚麼病？', '吉娃娃咳嗽', '小型犬咳嗽', '狗狗咳嗽嘔吐'],
        answers: [
          '我不是獸醫，但根據 AI 和系統中的相關資訊判斷，咳嗽加上嘔吐在狗狗身上可能有幾種原因：\n\n1. 犬舍咳（傳染性支氣管炎）\n2. 支氣管炎、氣管塌陷（小型犬常見）\n3. 吞入異物\n\n建議您觀察咳嗽頻率與情況（乾咳/有痰/像反胃），記錄嘔吐物狀況（是否有食物、膽汁、血），保持環境空氣流通，避免二手菸或刺激氣味，暫時禁食4-6小時觀察。\n\n⚠️ 如果病情惡化請盡快就醫。\n\n以下是我從論壇中篩選出的和 咳嗽 嘔吐 症狀相關的文章，供您參考：'
        ],
        // 標記此回應需要顯示推薦文章
        hasRecommendedArticles: true
      },
      {
        questions: ['請問耐吉斯和toma-pro兩種飼料哪種比較適合我的貓？', '飼料建議', '營養計算', '餵食建議', '飼料比較', '營養分析'],
        answers: [
          '根據您的貓咪情況，我認為 Toma-Pro比較適合，因為它的蛋白質較耐吉斯低，熱量也較少，還額外添加 DHA、茄紅素與 Omega 脂肪酸，有助於抗氧化與減輕肝臟負擔；而耐吉斯屬於高蛋白高礦物質配方，更適合年輕健康貓，不太適合肝臟病的高齡貓。\n若您需要更詳細與客製化的餵食建議，我可以帶您使用營養計算機進行詳細計算。'
        ],
        // 標記此回應需要顯示營養計算機按鈕
        hasCalculator: true
      },
      {
        questions: ['幫我找出最近兩個禮拜內小吉的異常記錄', '查找異常記錄', '異常記錄', '小吉異常', '找異常記錄', '兩週異常記錄'],
        answers: [
          '好的！我來幫你找出最近兩個禮拜內小吉的異常記錄。'
        ],
        // 標記此回應需要顯示操作按鈕
        hasOperation: true,
        operationType: 'findAbnormalPosts'
      },
    ];

    // 預設回應（當找不到匹配的問題時）
    this.defaultResponses = [
      '抱歉，我不太理解您的問題。您可以試著問我關於寵物照護、健康管理、或是 App 功能的問題！',
      '這個問題很有趣！不過我需要更多資訊才能準確回答。您可以說得更具體一些嗎？',
      '我還在學習中！您可以問我關於餵食提醒、醫院查詢、疫苗記錄等功能的使用方法。'
    ];

    // 記錄對話歷史（可選）
    this.conversationHistory = [];
  }

  // 主要的訊息處理函數
  async processMessage(userInput) {
    try {
      // 模擬 API 延遲（讓體驗更真實）
      await this.simulateDelay();

      // 預處理用戶輸入
      const processedInput = this.preprocessInput(userInput);

      // 記錄到對話歷史
      this.conversationHistory.push({
        type: 'user',
        message: userInput,
        timestamp: new Date()
      });

      // 尋找最佳匹配的回應
      const response = this.findBestMatch(processedInput);

      // 記錄 AI 回應
      this.conversationHistory.push({
        type: 'ai',
        message: response.response,
        timestamp: new Date()
      });

      return response;

    } catch (error) {
      console.error('Demo Service Error:', error);
      return {
        response: '系統暫時無法處理您的請求，請稍後再試。',
        source: 'error',
        confidence: 0
      };
    }
  }

  // 預處理輸入
  preprocessInput(input) {
    return input
      .toLowerCase()
      .trim()
      .replace(/[！。？，、；：「」『』（）【】]/g, '')
      .replace(/[!.?,;:()\[\]{}]/g, '');
  }

  // 尋找最佳匹配
  findBestMatch(processedInput) {
    let bestMatch = null;
    let highestScore = 0;

    // 遍歷所有問答對
    for (const qa of this.demoQA) {
      for (const question of qa.questions) {
        const score = this.calculateSimilarity(processedInput, question.toLowerCase());

        if (score > highestScore) {
          highestScore = score;
          bestMatch = qa;
        }
      }
    }

    // 如果找到高匹配度的答案
    if (highestScore > 0.5) {
      const answer = this.getRandomFromArray(bestMatch.answers);
      return {
        response: answer,
        source: 'demo',
        confidence: highestScore,
        // 如果有教學模式，傳遞教學資訊
        hasTutorial: bestMatch.hasTutorial || false,
        tutorialType: bestMatch.tutorialType || null,
        // 如果有推薦用戶，傳遞推薦用戶資訊
        hasRecommendedUsers: bestMatch.hasRecommendedUsers || false,
        // 如果有推薦文章，傳遞推薦文章資訊
        hasRecommendedArticles: bestMatch.hasRecommendedArticles || false,
        // 如果有營養計算機，傳遞計算機資訊
        hasCalculator: bestMatch.hasCalculator || false,
        // 如果有操作功能，傳遞操作相關資訊
        hasOperation: bestMatch.hasOperation || false,
        operationType: bestMatch.operationType || null
      };
    }

    // 返回預設回應
    return {
      response: this.getRandomFromArray(this.defaultResponses),
      source: 'default',
      confidence: 0.3
    };
  }

  // 計算相似度（簡單的關鍵詞匹配）
  calculateSimilarity(input, question) {
    // 完全匹配
    if (input === question) {
      return 1.0;
    }

    // 包含關係
    if (input.includes(question) || question.includes(input)) {
      return 0.8;
    }

    // 計算共同字元
    const inputChars = new Set(input.split(''));
    const questionChars = new Set(question.split(''));
    const intersection = new Set([...inputChars].filter(x => questionChars.has(x)));
    const union = new Set([...inputChars, ...questionChars]);

    if (union.size === 0) return 0;

    return intersection.size / union.size;
  }

  // 從陣列中隨機選擇
  getRandomFromArray(array) {
    return array[Math.floor(Math.random() * array.length)];
  }

  // 模擬延遲
  simulateDelay() {
    const delay = 300 + Math.random() * 700; // 300-1000ms
    return new Promise(resolve => setTimeout(resolve, delay));
  }

  // 獲取建議問題
  getSuggestedQuestions() {
    return [
      "App 有哪些功能？",
      "如何設定餵食提醒？",
      "怎麼找附近的動物醫院？",
      "如何記錄疫苗資訊？",
      "怎麼使用寵物社群？"
    ];
  }

  // 清除對話歷史
  clearHistory() {
    this.conversationHistory = [];
  }

  // 獲取對話歷史
  getHistory() {
    return this.conversationHistory;
  }
}

// 導出單例
export default new AIDemoService();