// AI 教學服務 - 處理各種教學模式和引導功能
// 這個服務負責管理 AI 觸發的教學流程

class AITutorialService {
  constructor() {
    // 教學類型定義
    this.TUTORIAL_TYPES = {
      TAG_PET: 'tagPet',
      CREATE_POST: 'createPost',
      SET_REMINDER: 'setReminder',
      HEALTH_RECORD: 'healthRecord',
      FORUM_USAGE: 'forumUsage',
      PROFILE_SETUP: 'profileSetup'
    };

    // 教學步驟狀態
    this.TUTORIAL_STATUS = {
      NOT_STARTED: 'not_started',
      IN_PROGRESS: 'in_progress',
      COMPLETED: 'completed',
      SKIPPED: 'skipped'
    };

    // 當前進行中的教學
    this.currentTutorial = null;
  }

  /**
   * 啟動教學模式
   * @param {string} tutorialType - 教學類型
   * @param {Object} options - 教學選項
   * @returns {Promise<Object>} 教學啟動結果
   */
  async startTutorial(tutorialType, options = {}) {
    try {
      // 驗證教學類型
      if (!this.isValidTutorialType(tutorialType)) {
        throw new Error(`無效的教學類型: ${tutorialType}`);
      }

      // 獲取教學配置
      const tutorialConfig = await this.getTutorialConfig(tutorialType);

      // 創建教學實例
      const tutorial = {
        id: Date.now(),
        type: tutorialType,
        config: tutorialConfig,
        status: this.TUTORIAL_STATUS.IN_PROGRESS,
        currentStep: 0,
        startTime: new Date(),
        options
      };

      this.currentTutorial = tutorial;

      // Demo 模式：觸發教學事件
      this.triggerTutorialEvent(tutorial);

      return {
        success: true,
        tutorial,
        message: `開始${tutorialConfig.title}教學`
      };

    } catch (error) {
      console.error('啟動教學失敗:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 獲取教學配置
   * @param {string} tutorialType - 教學類型
   * @returns {Promise<Object>} 教學配置
   */
  async getTutorialConfig(tutorialType) {
    // Demo 模式：返回預設教學配置
    const configs = {
      [this.TUTORIAL_TYPES.TAG_PET]: {
        title: '寵物標註',
        description: '學習如何在貼文中標註寵物',
        estimatedTime: '2-3 分鐘',
        steps: [
          {
            id: 1,
            title: '點擊新增貼文',
            description: '在首頁點擊右下角的新增貼文按鈕',
            target: 'fab-button',
            action: 'click'
          },
          {
            id: 2,
            title: '上傳照片',
            description: '選擇要分享的寵物照片',
            target: 'photo-upload',
            action: 'upload'
          },
          {
            id: 3,
            title: '點擊照片編輯',
            description: '點擊已上傳的照片進入編輯模式',
            target: 'photo-edit',
            action: 'click'
          },
          {
            id: 4,
            title: '標註寵物',
            description: '在照片上點擊要標註的寵物位置',
            target: 'pet-tag',
            action: 'tag'
          },
          {
            id: 5,
            title: '選擇寵物',
            description: '從列表中選擇要標註的寵物',
            target: 'pet-selector',
            action: 'select'
          },
          {
            id: 6,
            title: '完成標註',
            description: '確認標註並發布貼文',
            target: 'publish-button',
            action: 'click'
          }
        ],
        targetPage: '/posts/create',
        prerequisites: ['user_logged_in', 'has_pets']
      },

      [this.TUTORIAL_TYPES.CREATE_POST]: {
        title: '創建貼文',
        description: '學習如何創建和發布貼文',
        estimatedTime: '3-4 分鐘',
        steps: [
          {
            id: 1,
            title: '進入貼文創建頁面',
            description: '點擊新增貼文按鈕',
            target: 'create-post-button',
            action: 'click'
          },
          {
            id: 2,
            title: '輸入貼文內容',
            description: '在文字框中輸入想要分享的內容',
            target: 'post-content',
            action: 'input'
          },
          {
            id: 3,
            title: '添加照片',
            description: '上傳寵物的可愛照片',
            target: 'photo-upload',
            action: 'upload'
          },
          {
            id: 4,
            title: '設定隱私',
            description: '選擇貼文的可見範圍',
            target: 'privacy-setting',
            action: 'select'
          },
          {
            id: 5,
            title: '發布貼文',
            description: '檢查內容後點擊發布',
            target: 'publish-button',
            action: 'click'
          }
        ],
        targetPage: '/posts/create',
        prerequisites: ['user_logged_in']
      },

      [this.TUTORIAL_TYPES.SET_REMINDER]: {
        title: '設置提醒',
        description: '學習如何設置寵物相關提醒',
        estimatedTime: '2-3 分鐘',
        steps: [
          {
            id: 1,
            title: '進入提醒頁面',
            description: '從選單進入提醒設置',
            target: 'reminder-menu',
            action: 'click'
          },
          {
            id: 2,
            title: '選擇提醒類型',
            description: '選擇要設置的提醒類型',
            target: 'reminder-type',
            action: 'select'
          },
          {
            id: 3,
            title: '設定時間',
            description: '設置提醒的時間和頻率',
            target: 'time-setting',
            action: 'input'
          },
          {
            id: 4,
            title: '保存提醒',
            description: '確認設置並保存提醒',
            target: 'save-reminder',
            action: 'click'
          }
        ],
        targetPage: '/reminders',
        prerequisites: ['user_logged_in', 'has_pets']
      }
    };

    return configs[tutorialType] || null;
  }

  /**
   * 觸發教學事件（Demo 模式）
   * @param {Object} tutorial - 教學實例
   */
  triggerTutorialEvent(tutorial) {
    // 使用 CustomEvent 通知應用程式啟動教學
    const event = new CustomEvent('startTutorial', {
      detail: {
        tutorialType: tutorial.type,
        config: tutorial.config,
        tutorial: tutorial
      }
    });

    window.dispatchEvent(event);

    console.log('教學事件已觸發:', tutorial.type);
  }

  /**
   * 繼續到下一個教學步驟
   * @param {string} tutorialId - 教學 ID
   * @returns {Object} 下一步驟資訊
   */
  nextStep(tutorialId) {
    if (!this.currentTutorial || this.currentTutorial.id !== tutorialId) {
      return { success: false, error: '找不到進行中的教學' };
    }

    const tutorial = this.currentTutorial;
    const currentStep = tutorial.currentStep;
    const totalSteps = tutorial.config.steps.length;

    if (currentStep >= totalSteps - 1) {
      // 教學完成
      tutorial.status = this.TUTORIAL_STATUS.COMPLETED;
      tutorial.endTime = new Date();
      this.currentTutorial = null;

      return {
        success: true,
        completed: true,
        message: '教學完成！'
      };
    }

    // 進入下一步
    tutorial.currentStep = currentStep + 1;
    const nextStep = tutorial.config.steps[tutorial.currentStep];

    return {
      success: true,
      completed: false,
      currentStep: tutorial.currentStep,
      step: nextStep,
      progress: ((tutorial.currentStep + 1) / totalSteps) * 100
    };
  }

  /**
   * 跳過當前教學
   * @param {string} tutorialId - 教學 ID
   * @returns {Object} 跳過結果
   */
  skipTutorial(tutorialId) {
    if (!this.currentTutorial || this.currentTutorial.id !== tutorialId) {
      return { success: false, error: '找不到進行中的教學' };
    }

    this.currentTutorial.status = this.TUTORIAL_STATUS.SKIPPED;
    this.currentTutorial.endTime = new Date();
    this.currentTutorial = null;

    return {
      success: true,
      message: '教學已跳過'
    };
  }

  /**
   * 暫停教學
   * @param {string} tutorialId - 教學 ID
   * @returns {Object} 暫停結果
   */
  pauseTutorial(tutorialId) {
    if (!this.currentTutorial || this.currentTutorial.id !== tutorialId) {
      return { success: false, error: '找不到進行中的教學' };
    }

    this.currentTutorial.status = 'paused';
    this.currentTutorial.pauseTime = new Date();

    return {
      success: true,
      message: '教學已暫停'
    };
  }

  /**
   * 恢復教學
   * @param {string} tutorialId - 教學 ID
   * @returns {Object} 恢復結果
   */
  resumeTutorial(tutorialId) {
    if (!this.currentTutorial || this.currentTutorial.id !== tutorialId) {
      return { success: false, error: '找不到進行中的教學' };
    }

    this.currentTutorial.status = this.TUTORIAL_STATUS.IN_PROGRESS;
    delete this.currentTutorial.pauseTime;

    return {
      success: true,
      message: '教學已恢復'
    };
  }

  /**
   * 獲取當前教學狀態
   * @returns {Object|null} 當前教學狀態
   */
  getCurrentTutorial() {
    return this.currentTutorial;
  }

  /**
   * 獲取教學標題
   * @param {string} tutorialType - 教學類型
   * @returns {string} 教學標題
   */
  getTutorialTitle(tutorialType) {
    const titles = {
      [this.TUTORIAL_TYPES.TAG_PET]: '寵物標註教學',
      [this.TUTORIAL_TYPES.CREATE_POST]: '貼文創建教學',
      [this.TUTORIAL_TYPES.SET_REMINDER]: '提醒設置教學',
      [this.TUTORIAL_TYPES.HEALTH_RECORD]: '健康記錄教學',
      [this.TUTORIAL_TYPES.FORUM_USAGE]: '論壇使用教學',
      [this.TUTORIAL_TYPES.PROFILE_SETUP]: '個人檔案設置教學'
    };

    return titles[tutorialType] || '教學模式';
  }

  /**
   * 獲取教學按鈕文字
   * @param {string} tutorialType - 教學類型
   * @returns {string} 按鈕文字
   */
  getTutorialButtonText(tutorialType) {
    return '開始教學';
  }

  /**
   * 驗證教學類型是否有效
   * @param {string} tutorialType - 教學類型
   * @returns {boolean} 是否有效
   */
  isValidTutorialType(tutorialType) {
    return Object.values(this.TUTORIAL_TYPES).includes(tutorialType);
  }

  /**
   * 獲取所有支援的教學類型
   * @returns {Array} 教學類型列表
   */
  getSupportedTutorials() {
    return Object.values(this.TUTORIAL_TYPES);
  }

  /**
   * 獲取教學統計
   * @returns {Object} 教學統計資訊
   */
  getTutorialStats() {
    // 可以從 localStorage 或後端獲取統計資訊
    return {
      totalTutorials: Object.keys(this.TUTORIAL_TYPES).length,
      completedTutorials: 0, // 從用戶資料獲取
      currentTutorial: this.currentTutorial?.type || null
    };
  }

  /**
   * 未來可以實作的真實 API 調用方法
   */

  // async fetchTutorialConfigFromAPI(tutorialType) {
  //   const response = await fetch(`/api/tutorials/${tutorialType}/config`);
  //   return response.json();
  // }

  // async saveTutorialProgress(tutorialId, progress) {
  //   const response = await fetch(`/api/tutorials/${tutorialId}/progress`, {
  //     method: 'POST',
  //     headers: { 'Content-Type': 'application/json' },
  //     body: JSON.stringify(progress)
  //   });
  //   return response.json();
  // }

  // async getTutorialHistory(userId) {
  //   const response = await fetch(`/api/users/${userId}/tutorials`);
  //   return response.json();
  // }
}

// 導出單例
export default new AITutorialService();