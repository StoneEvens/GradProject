// AI 飼料建議服務 - 專門處理寵物飼料推薦和營養分析
// 這個服務負責分析寵物需求並提供個性化的飼料建議

class AIFeedingService {
  constructor() {
    // 飼料品牌資料庫
    this.FEED_BRANDS = {
      TOMA_PRO: 'Toma-Pro',
      NUTRO: '耐吉斯',
      ROYAL_CANIN: 'Royal Canin',
      HILLS: 'Hill\'s',
      PURINA: 'Purina',
      ORIJEN: 'Orijen'
    };

    // 寵物生命階段
    this.LIFE_STAGES = {
      KITTEN: 'kitten',
      ADULT: 'adult',
      SENIOR: 'senior',
      PUPPY: 'puppy',
      MATURE: 'mature'
    };

    // 健康狀況
    this.HEALTH_CONDITIONS = {
      HEALTHY: 'healthy',
      OVERWEIGHT: 'overweight',
      UNDERWEIGHT: 'underweight',
      KIDNEY_DISEASE: 'kidney_disease',
      LIVER_DISEASE: 'liver_disease',
      DIABETES: 'diabetes',
      ALLERGIES: 'allergies',
      DIGESTIVE_ISSUES: 'digestive_issues'
    };

    // 活動量級別
    this.ACTIVITY_LEVELS = {
      LOW: 'low',
      MODERATE: 'moderate',
      HIGH: 'high',
      VERY_HIGH: 'very_high'
    };
  }

  /**
   * 獲取飼料建議
   * @param {Object} petProfile - 寵物檔案
   * @returns {Promise<Object>} 飼料建議結果
   */
  async getFeedingRecommendation(petProfile) {
    try {
      // 驗證輸入
      if (!this.validatePetProfile(petProfile)) {
        throw new Error('寵物檔案資料不完整');
      }

      // Demo 模式：使用預設邏輯
      const recommendation = await this.generateRecommendation(petProfile);

      // 未來可以在這裡調用真實的 AI API
      // const aiRecommendation = await this.fetchAIRecommendation(petProfile);

      return {
        success: true,
        recommendation,
        petProfile,
        source: 'demo'
      };

    } catch (error) {
      console.error('獲取飼料建議失敗:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 生成飼料建議（Demo 模式）
   * @param {Object} petProfile - 寵物檔案
   * @returns {Promise<Object>} 建議結果
   */
  async generateRecommendation(petProfile) {
    // 模擬 AI 分析延遲
    await this.simulateDelay(800, 1500);

    const {
      pet_type = 'cat',
      age_stage = 'adult',
      weight = 4,
      health_condition = 'healthy',
      activity_level = 'moderate',
      special_needs = [],
      current_brand = null
    } = petProfile;

    // 根據條件選擇推薦飼料
    let recommendedBrand;
    let reason;
    let nutritionFocus = [];
    let alternatives = [];

    // Demo 邏輯：根據健康狀況和年齡推薦
    if (health_condition === 'liver_disease' && age_stage === 'senior') {
      recommendedBrand = this.FEED_BRANDS.TOMA_PRO;
      reason = '根據您的貓咪情況，我認為 Toma-Pro比較適合，因為它的蛋白質較耐吉斯低，熱量也較少，還額外添加 DHA、茄紅素與 Omega 脂肪酸，有助於抗氧化與減輕肝臟負擔；而耐吉斯屬於高蛋白高礦物質配方，更適合年輕健康貓，不太適合肝臟病的高齡貓。';
      nutritionFocus = ['低蛋白質', '抗氧化配方', 'DHA', '茄紅素', 'Omega脂肪酸'];
      alternatives = [this.FEED_BRANDS.HILLS, this.FEED_BRANDS.ROYAL_CANIN];
    }
    else if (pet_type === 'cat' && age_stage === 'kitten') {
      recommendedBrand = this.FEED_BRANDS.ROYAL_CANIN;
      reason = '幼貓需要高營養密度的食物來支持快速成長，Royal Canin 幼貓配方提供了適當的蛋白質、脂肪和 DHA，有助於大腦和視力發育。';
      nutritionFocus = ['高蛋白質', '高脂肪', 'DHA', '易消化'];
      alternatives = [this.FEED_BRANDS.HILLS, this.FEED_BRANDS.PURINA];
    }
    else if (health_condition === 'overweight') {
      recommendedBrand = this.FEED_BRANDS.HILLS;
      reason = 'Hill\'s 減重配方含有高纖維和適量蛋白質，能夠幫助寵物在減重過程中維持肌肉量，同時增加飽腹感。';
      nutritionFocus = ['高纖維', '適量蛋白質', '低脂肪', '體重管理'];
      alternatives = [this.FEED_BRANDS.ROYAL_CANIN, this.FEED_BRANDS.PURINA];
    }
    else if (activity_level === 'high' || activity_level === 'very_high') {
      recommendedBrand = this.FEED_BRANDS.ORIJEN;
      reason = '高活動量的寵物需要更多的蛋白質和脂肪來維持能量，Orijen 提供高品質的動物蛋白和天然脂肪。';
      nutritionFocus = ['高蛋白質', '高脂肪', '天然食材', '高能量'];
      alternatives = [this.FEED_BRANDS.NUTRO, this.FEED_BRANDS.PURINA];
    }
    else {
      // 預設建議
      recommendedBrand = this.FEED_BRANDS.NUTRO;
      reason = '耐吉斯提供均衡的營養配比，適合一般健康的成年寵物，含有優質蛋白質和必需脂肪酸。';
      nutritionFocus = ['均衡營養', '優質蛋白質', '必需脂肪酸'];
      alternatives = [this.FEED_BRANDS.PURINA, this.FEED_BRANDS.ROYAL_CANIN];
    }

    // 計算每日建議餵食量
    const dailyAmount = this.calculateDailyAmount(petProfile, recommendedBrand);

    // 生成營養分析
    const nutritionAnalysis = this.generateNutritionAnalysis(recommendedBrand, petProfile);

    return {
      recommendedBrand,
      reason,
      confidence: 0.85,
      nutritionFocus,
      alternatives,
      dailyAmount,
      nutritionAnalysis,
      feedingTips: this.generateFeedingTips(petProfile),
      suggestion: '若您需要更詳細與客製化的餵食建議，建議您使用營養計算機進行計算。',
      followUpActions: ['使用營養計算機', '諮詢獸醫師', '逐步轉換飼料']
    };
  }

  /**
   * 計算每日建議餵食量
   * @param {Object} petProfile - 寵物檔案
   * @param {string} brand - 飼料品牌
   * @returns {Object} 餵食量建議
   */
  calculateDailyAmount(petProfile, brand) {
    const { pet_type, weight, age_stage, activity_level } = petProfile;

    // 基礎代謝率計算（簡化版）
    let baseAmount;
    if (pet_type === 'cat') {
      baseAmount = Math.round(weight * 50); // 每公斤50g作為基準
    } else {
      baseAmount = Math.round(weight * 30); // 狗狗每公斤30g作為基準
    }

    // 根據年齡調整
    if (age_stage === 'kitten' || age_stage === 'puppy') {
      baseAmount *= 1.5;
    } else if (age_stage === 'senior') {
      baseAmount *= 0.9;
    }

    // 根據活動量調整
    const activityMultiplier = {
      low: 0.8,
      moderate: 1.0,
      high: 1.2,
      very_high: 1.4
    };
    baseAmount *= activityMultiplier[activity_level] || 1.0;

    return {
      totalDaily: Math.round(baseAmount),
      perMeal: Math.round(baseAmount / 2), // 假設一天兩餐
      unit: 'g',
      frequency: '每日2次',
      note: '建議分2-3次餵食，並根據寵物實際狀況調整'
    };
  }

  /**
   * 生成營養分析
   * @param {string} brand - 飼料品牌
   * @param {Object} petProfile - 寵物檔案
   * @returns {Object} 營養分析
   */
  generateNutritionAnalysis(brand, petProfile) {
    // Demo 數據
    const nutritionData = {
      [this.FEED_BRANDS.TOMA_PRO]: {
        protein: { value: 32, level: '適中', status: 'good' },
        fat: { value: 12, level: '偏低', status: 'good' },
        carbohydrates: { value: 35, level: '適量', status: 'good' },
        fiber: { value: 4, level: '適量', status: 'good' },
        additives: ['DHA', '茄紅素', 'Omega-3脂肪酸', '維生素E']
      },
      [this.FEED_BRANDS.NUTRO]: {
        protein: { value: 36, level: '高', status: 'good' },
        fat: { value: 15, level: '適量', status: 'good' },
        carbohydrates: { value: 30, level: '適量', status: 'good' },
        fiber: { value: 3.5, level: '適量', status: 'good' },
        additives: ['維生素A', '維生素E', '牛磺酸', '礦物質']
      },
      [this.FEED_BRANDS.ROYAL_CANIN]: {
        protein: { value: 34, level: '適中', status: 'good' },
        fat: { value: 14, level: '適量', status: 'good' },
        carbohydrates: { value: 32, level: '適量', status: 'good' },
        fiber: { value: 4.2, level: '適量', status: 'good' },
        additives: ['抗氧化複合物', 'EPA/DHA', '益生元', '牛磺酸']
      }
    };

    return nutritionData[brand] || nutritionData[this.FEED_BRANDS.NUTRO];
  }

  /**
   * 生成餵食建議
   * @param {Object} petProfile - 寵物檔案
   * @returns {Array} 餵食建議
   */
  generateFeedingTips(petProfile) {
    const tips = [
      '定時定量餵食，培養良好飲食習慣',
      '確保隨時有清潔的飲用水',
      '觀察寵物進食狀況和體重變化'
    ];

    if (petProfile.age_stage === 'senior') {
      tips.push('老年寵物消化較慢，可考慮少量多餐');
    }

    if (petProfile.health_condition !== 'healthy') {
      tips.push('有健康問題的寵物建議定期諮詢獸醫師');
    }

    return tips;
  }

  /**
   * 比較不同飼料品牌
   * @param {Array} brands - 要比較的品牌列表
   * @param {Object} petProfile - 寵物檔案
   * @returns {Promise<Object>} 比較結果
   */
  async compareBrands(brands, petProfile) {
    try {
      const comparisons = await Promise.all(
        brands.map(async (brand) => {
          const mockProfile = { ...petProfile, preferred_brand: brand };
          const result = await this.generateRecommendation(mockProfile);
          return {
            brand,
            ...result
          };
        })
      );

      return {
        success: true,
        comparisons,
        recommendation: '建議選擇最適合寵物當前健康狀況的飼料'
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 驗證寵物檔案
   * @param {Object} petProfile - 寵物檔案
   * @returns {boolean} 是否有效
   */
  validatePetProfile(petProfile) {
    if (!petProfile || typeof petProfile !== 'object') {
      return false;
    }

    // 至少需要寵物類型
    return petProfile.pet_type &&
           ['cat', 'dog'].includes(petProfile.pet_type);
  }

  /**
   * 模擬延遲
   */
  simulateDelay(min = 500, max = 1500) {
    const delay = min + Math.random() * (max - min);
    return new Promise(resolve => setTimeout(resolve, delay));
  }

  /**
   * 獲取支援的寵物類型
   * @returns {Array} 寵物類型列表
   */
  getSupportedPetTypes() {
    return ['cat', 'dog'];
  }

  /**
   * 獲取支援的飼料品牌
   * @returns {Array} 品牌列表
   */
  getSupportedBrands() {
    return Object.values(this.FEED_BRANDS);
  }

  /**
   * 未來可以實作的真實 AI API 調用方法
   */

  // async fetchAIRecommendation(petProfile) {
  //   const response = await fetch('/api/ai/feeding/recommendation', {
  //     method: 'POST',
  //     headers: { 'Content-Type': 'application/json' },
  //     body: JSON.stringify(petProfile)
  //   });
  //   return response.json();
  // }

  // async fetchNutritionAnalysis(brand, petProfile) {
  //   const response = await fetch('/api/nutrition/analysis', {
  //     method: 'POST',
  //     headers: { 'Content-Type': 'application/json' },
  //     body: JSON.stringify({ brand, petProfile })
  //   });
  //   return response.json();
  // }

  // async saveFeedingPreferences(userId, preferences) {
  //   const response = await fetch(`/api/users/${userId}/feeding-preferences`, {
  //     method: 'POST',
  //     headers: { 'Content-Type': 'application/json' },
  //     body: JSON.stringify(preferences)
  //   });
  //   return response.json();
  // }
}

// 導出單例
export default new AIFeedingService();