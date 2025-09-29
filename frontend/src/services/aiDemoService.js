// AI Demo Service - 用於展示的預設問答服務
// 這是一個純前端的 Demo Service，所有問答都是預先寫死的

class AIDemoService {
  constructor() {
    // 檢測使用者的語言偏好
    this.userLanguage = this.detectUserLanguage();

    // 預設的問答對照表（多語言支援）
    // 可以根據需要新增或修改問答內容
    this.demoQA = [
      {
        // 問題可以是陣列，支援多種問法
        questions: {
          'zh': ['請問如何在貼文裡標註寵物？', '標註寵物', '標記寵物', '怎麼標註'],
          'en': ['How to tag pets in posts?', 'tag pets', 'mark pets', 'how to tag', 'pet tagging']
        },
        answers: {
          'zh': [
            '我明白了，您希望在貼文的相片中標註寵物。如果要在貼文的相片中標註寵物，可以在建立貼文時點擊已新增的相片叫出相片編輯視窗，並在該視窗中標註寵物。\n請問您希望使用教學模式嗎？我可以帶著您完整操作一遍。'
          ],
          'en': [
            'I understand you want to tag pets in your post photos. To tag pets in post photos, you can click on the added photo when creating a post to open the photo editing window, and tag pets in that window.\nWould you like to use tutorial mode? I can guide you through the complete process.'
          ]
        },
        // 標記此回應需要顯示教學按鈕
        hasTutorial: true,
        tutorialType: 'tagPet' // 教學類型，用於識別不同的教學流程
      },
      {
        questions: {
          'zh': ['我很喜歡布偶貓，可以推薦我幾個有養布偶貓的用戶嗎？', '推薦用戶', '推薦養貓的用戶', '有養貓的用戶'],
          'en': ['I love Ragdoll cats, can you recommend some users who have Ragdolls?', 'recommend users', 'recommend cat owners', 'cat owner users']
        },
        answers: {
          'zh': [
            '好的！以下是一些有養布偶貓且帳戶為公開的用戶，您可以關注他們，看看他們分享的可愛貓咪日常：'
          ],
          'en': [
            'Sure! Here are some users who have Ragdoll cats with public accounts. You can follow them to see their adorable cat daily life:'
          ]
        },
        // 標記此回應需要顯示推薦用戶
        hasRecommendedUsers: true
      },
      {
        questions: {
          'zh': ['我的吉娃娃目前有點咳嗽和嘔吐的症狀，請問他可能是生了甚麼病？', '吉娃娃咳嗽', '小型犬咳嗽', '狗狗咳嗽嘔吐'],
          'en': ['My Chihuahua has coughing and vomiting symptoms, what illness might it be?', 'chihuahua cough', 'small dog cough', 'dog coughing vomiting']
        },
        answers: {
          'zh': [
            '我不是獸醫，但根據 AI 和系統中的相關資訊判斷，咳嗽加上嘔吐在狗狗身上可能有幾種原因：\n\n1. 犬舍咳（傳染性支氣管炎）\n2. 支氣管炎、氣管塌陷（小型犬常見）\n3. 吞入異物\n\n建議您觀察咳嗽頻率與情況（乾咳/有痰/像反胃），記錄嘔吐物狀況（是否有食物、膽汁、血），保持環境空氣流通，避免二手菸或刺激氣味，暫時禁食4-6小時觀察。\n\n⚠️ 如果病情惡化請盡快就醫。\n\n以下是我從論壇中篩選出的和 咳嗽 嘔吐 症狀相關的文章，供您參考：'
          ],
          'en': [
            'I\'m not a veterinarian, but based on AI and system information, coughing plus vomiting in dogs could have several causes:\n\n1. Kennel cough (infectious bronchitis)\n2. Bronchitis, tracheal collapse (common in small dogs)\n3. Foreign object ingestion\n\nI recommend observing cough frequency and type (dry/with phlegm/like retching), recording vomit condition (food, bile, blood), maintaining good air circulation, avoiding secondhand smoke or irritating odors, and temporarily fasting for 4-6 hours for observation.\n\n⚠️ Please seek veterinary care immediately if symptoms worsen.\n\nHere are related articles about coughing and vomiting symptoms from the forum for your reference:'
          ]
        },
        // 標記此回應需要顯示推薦文章
        hasRecommendedArticles: true
      },
      {
        questions: {
          'zh': ['請問耐吉斯和toma-pro兩種飼料哪種比較適合我的貓？', '飼料建議', '營養計算', '餵食建議', '飼料比較', '營養分析'],
          'en': ['Which food is better for my cat, Nutro or Toma-Pro?', 'food recommendation', 'nutrition calculation', 'feeding advice', 'food comparison', 'nutrition analysis']
        },
        answers: {
          'zh': [
            '根據您的貓咪情況，我認為 Toma-Pro比較適合，因為它的蛋白質較耐吉斯低，熱量也較少，還額外添加 DHA、茄紅素與 Omega 脂肪酸，有助於抗氧化與減輕肝臟負擔；而耐吉斯屬於高蛋白高礦物質配方，更適合年輕健康貓，不太適合肝臟病的高齡貓。\n若您需要更詳細與客製化的餵食建議，我可以帶您使用營養計算機進行詳細計算。'
          ],
          'en': [
            'Based on your cat\'s condition, I think Toma-Pro is more suitable because it has lower protein than Nutro, fewer calories, and additional DHA, lycopene, and Omega fatty acids that help with antioxidation and reducing liver burden. Nutro is a high-protein, high-mineral formula more suitable for young healthy cats, not ideal for senior cats with liver disease.\nIf you need more detailed and customized feeding advice, I can guide you to use the nutrition calculator for detailed calculations.'
          ]
        },
        // 標記此回應需要顯示營養計算機按鈕
        hasCalculator: true
      },
      {
        questions: {
          'zh': ['幫我找出最近兩個禮拜內小吉的異常記錄', '查找異常記錄', '異常記錄', '小吉異常', '找異常記錄', '兩週異常記錄'],
          'en': ['Help me find abnormal records of Xiaoji in the past two weeks', 'find abnormal records', 'abnormal records', 'Xiaoji abnormal', 'search abnormal records', 'two weeks abnormal']
        },
        answers: {
          'zh': [
            '好的！我來幫你找出最近兩個禮拜內小吉的異常記錄。'
          ],
          'en': [
            'Alright! I\'ll help you find Xiaoji\'s abnormal records in the past two weeks.'
          ]
        },
        // 標記此回應需要顯示操作按鈕
        hasOperation: true,
        operationType: 'findAbnormalPosts'
      },
    ];

    // 預設回應（當找不到匹配的問題時）
    this.defaultResponses = {
      'zh': [
        '抱歉，我不太理解您的問題。您可以試著問我關於寵物照護、健康管理、或是 App 功能的問題！',
        '這個問題很有趣！不過我需要更多資訊才能準確回答。您可以說得更具體一些嗎？',
        '我還在學習中！您可以問我關於餵食提醒、醫院查詢、疫苗記錄等功能的使用方法。'
      ],
      'en': [
        'Sorry, I don\'t quite understand your question. You can try asking me about pet care, health management, or app features!',
        'That\'s an interesting question! However, I need more information to answer accurately. Could you be more specific?',
        'I\'m still learning! You can ask me about how to use features like feeding reminders, hospital searches, or vaccination records.'
      ]
    };

    // 記錄對話歷史（可選）
    this.conversationHistory = [];
  }

  // 檢測使用者語言偏好
  detectUserLanguage() {
    // 優先級：瀏覽器語言 > 系統語言 > 預設中文
    const browserLang = navigator.language || navigator.userLanguage || 'zh-TW';

    // 如果是英文相關語言，返回 'en'
    if (browserLang.toLowerCase().startsWith('en')) {
      return 'en';
    }

    // 其他情況預設為中文
    return 'zh';
  }

  // 檢測輸入文字的語言
  detectInputLanguage(input) {
    // 簡單的語言檢測：如果包含中文字符，則為中文
    const chineseRegex = /[\u4e00-\u9fa5]/;
    return chineseRegex.test(input) ? 'zh' : 'en';
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

      // 尋找最佳匹配的回應（傳遞原始輸入用於語言檢測）
      const response = this.findBestMatch(processedInput, userInput);

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
  findBestMatch(processedInput, originalInput) {
    let bestMatch = null;
    let highestScore = 0;
    let inputLang = 'zh'; // 預設語言

    // 檢測輸入語言
    inputLang = this.detectInputLanguage(originalInput);

    // 遍歷所有問答對
    for (const qa of this.demoQA) {
      // 根據語言選擇對應的問題列表
      const questions = qa.questions[inputLang] || qa.questions['zh'] || [];

      for (const question of questions) {
        const score = this.calculateSimilarity(processedInput, question.toLowerCase());

        if (score > highestScore) {
          highestScore = score;
          bestMatch = { ...qa, detectedLang: inputLang };
        }
      }
    }

    // 如果找到高匹配度的答案
    if (highestScore > 0.5) {
      const detectedLang = bestMatch.detectedLang;
      const answers = bestMatch.answers[detectedLang] || bestMatch.answers['zh'] || bestMatch.answers;
      const answer = this.getRandomFromArray(answers);

      return {
        response: answer,
        source: 'demo',
        confidence: highestScore,
        language: detectedLang,
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

    // 使用已經檢測的語言來選擇預設回應
    const defaultResponses = this.defaultResponses[inputLang] || this.defaultResponses['zh'];

    // 返回預設回應
    return {
      response: this.getRandomFromArray(defaultResponses),
      source: 'default',
      confidence: 0.3,
      language: inputLang
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
    const delay = 1000 + Math.random() * 2000; // 300-1000ms
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