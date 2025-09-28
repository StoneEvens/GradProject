// AI 操作服務 - 處理 AI 協助用戶執行的各種操作
// 這個服務負責將 AI 的指令轉換為實際的系統操作

class AIOperationService {
  constructor() {
    // 操作類型定義
    this.OPERATION_TYPES = {
      FIND_ABNORMAL_POSTS: 'findAbnormalPosts',
      FIND_HEALTH_RECORDS: 'findHealthRecords',
      SET_FEEDING_REMINDER: 'setFeedingReminder',
      SEARCH_NEARBY_HOSPITALS: 'searchNearbyHospitals'
      // 可以在這裡添加更多操作類型
    };

    // Demo 模式下的預設寵物 ID
    this.DEFAULT_PET_ID = 1;
  }

  /**
   * 執行指定的操作
   * @param {string} operationType - 操作類型
   * @param {Object} params - 操作參數
   * @param {Function} navigate - React Router 的 navigate 函數
   * @returns {Object} 操作結果
   */
  async executeOperation(operationType, params = {}, navigate) {
    try {
      switch (operationType) {
        case this.OPERATION_TYPES.FIND_ABNORMAL_POSTS:
          return await this.findAbnormalPosts(params, navigate);

        case this.OPERATION_TYPES.FIND_HEALTH_RECORDS:
          return await this.findHealthRecords(params, navigate);

        case this.OPERATION_TYPES.SET_FEEDING_REMINDER:
          return await this.setFeedingReminder(params, navigate);

        case this.OPERATION_TYPES.SEARCH_NEARBY_HOSPITALS:
          return await this.searchNearbyHospitals(params, navigate);

        default:
          throw new Error(`未知的操作類型: ${operationType}`);
      }
    } catch (error) {
      console.error('操作執行失敗:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 查找異常記錄
   * @param {Object} params - 參數 { petId?, startDate?, endDate?, period? }
   * @param {Function} navigate - 導航函數
   */
  async findAbnormalPosts(params, navigate) {
    const { petId = this.DEFAULT_PET_ID, period = 14 } = params;

    // 計算日期範圍
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - period);

    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    // 構建 URL 參數
    const searchParams = new URLSearchParams({
      startDate: startDateStr,
      endDate: endDateStr,
      autoFilter: 'true' // 標記為 AI 自動篩選
    });

    const url = `/pet/${petId}/abnormal-posts?${searchParams.toString()}`;

    console.log('AI 操作：導航到異常記錄頁面');
    console.log('URL:', url);
    console.log('篩選參數:', {
      startDate: startDateStr,
      endDate: endDateStr,
      period: `${period}天`,
      petId
    });

    // 執行導航
    if (navigate) {
      navigate(url);
    }

    return {
      success: true,
      operation: 'findAbnormalPosts',
      url,
      params: {
        petId,
        startDate: startDateStr,
        endDate: endDateStr,
        period
      }
    };
  }

  /**
   * 查找健康記錄
   * @param {Object} params - 參數
   * @param {Function} navigate - 導航函數
   */
  async findHealthRecords(params, navigate) {
    const { petId = this.DEFAULT_PET_ID, recordType = 'all' } = params;

    const searchParams = new URLSearchParams({
      type: recordType,
      autoFilter: 'true'
    });

    const url = `/pet/${petId}/health-records?${searchParams.toString()}`;

    if (navigate) {
      navigate(url);
    }

    return {
      success: true,
      operation: 'findHealthRecords',
      url,
      params: { petId, recordType }
    };
  }

  /**
   * 設置餵食提醒
   * @param {Object} params - 參數
   * @param {Function} navigate - 導航函數
   */
  async setFeedingReminder(params, navigate) {
    const { petId = this.DEFAULT_PET_ID } = params;

    const url = `/pet/${petId}/feeding-reminders/create`;

    if (navigate) {
      navigate(url);
    }

    return {
      success: true,
      operation: 'setFeedingReminder',
      url,
      params: { petId }
    };
  }

  /**
   * 搜尋附近醫院
   * @param {Object} params - 參數
   * @param {Function} navigate - 導航函數
   */
  async searchNearbyHospitals(params, navigate) {
    const { location, radius = 5 } = params;

    const searchParams = new URLSearchParams({
      radius: radius.toString(),
      autoSearch: 'true'
    });

    if (location) {
      searchParams.append('location', location);
    }

    const url = `/hospitals/search?${searchParams.toString()}`;

    if (navigate) {
      navigate(url);
    }

    return {
      success: true,
      operation: 'searchNearbyHospitals',
      url,
      params: { location, radius }
    };
  }

  /**
   * 獲取操作的描述文字
   * @param {string} operationType - 操作類型
   * @returns {string} 描述文字
   */
  getOperationDescription(operationType) {
    const descriptions = {
      [this.OPERATION_TYPES.FIND_ABNORMAL_POSTS]: '查找異常記錄',
      [this.OPERATION_TYPES.FIND_HEALTH_RECORDS]: '查找健康記錄',
      [this.OPERATION_TYPES.SET_FEEDING_REMINDER]: '設置餵食提醒',
      [this.OPERATION_TYPES.SEARCH_NEARBY_HOSPITALS]: '搜尋附近醫院'
    };

    return descriptions[operationType] || '執行操作';
  }

  /**
   * 獲取操作的按鈕文字
   * @param {string} operationType - 操作類型
   * @returns {string} 按鈕文字
   */
  getOperationButtonText(operationType) {
    const buttonTexts = {
      [this.OPERATION_TYPES.FIND_ABNORMAL_POSTS]: '出發!',
      [this.OPERATION_TYPES.FIND_HEALTH_RECORDS]: '查看記錄',
      [this.OPERATION_TYPES.SET_FEEDING_REMINDER]: '設置提醒',
      [this.OPERATION_TYPES.SEARCH_NEARBY_HOSPITALS]: '搜尋醫院'
    };

    return buttonTexts[operationType] || '執行';
  }

  /**
   * 驗證操作參數
   * @param {string} operationType - 操作類型
   * @param {Object} params - 參數
   * @returns {boolean} 是否有效
   */
  validateOperationParams(operationType, params) {
    switch (operationType) {
      case this.OPERATION_TYPES.FIND_ABNORMAL_POSTS:
        // 異常記錄查找不需要特殊參數驗證
        return true;

      case this.OPERATION_TYPES.FIND_HEALTH_RECORDS:
        // 健康記錄查找不需要特殊參數驗證
        return true;

      case this.OPERATION_TYPES.SET_FEEDING_REMINDER:
        // 餵食提醒設置不需要特殊參數驗證
        return true;

      case this.OPERATION_TYPES.SEARCH_NEARBY_HOSPITALS:
        // 醫院搜尋不需要特殊參數驗證
        return true;

      default:
        return false;
    }
  }

  /**
   * 獲取所有支援的操作類型
   * @returns {Array} 操作類型列表
   */
  getSupportedOperations() {
    return Object.values(this.OPERATION_TYPES);
  }
}

// 導出單例
export default new AIOperationService();