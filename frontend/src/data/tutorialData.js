/**
 * 教學模式資料結構
 * 包含所有教學流程的步驟定義
 */

const tutorialData = {
  // 標註寵物教學
  tagPet: {
    id: 'tagPet',
    title: '如何在貼文中標註寵物',
    description: '學習如何在照片中標記您的寵物',
    steps: [
      {
        id: 1,
        title: '步驟 1：開啟發文選單',
        instruction: '點擊底部導覽列中間的「發文」按鈕',
        targetElement: {
          component: 'BottomNavbar',
          selector: 'img[alt*="post"], img[src*="CreatePost"], [class*="createPost"]',
          className: 'createPost',
          fallbackSelector: '.icon'
        },
        highlight: {
          type: 'circle',
          position: 'bottom-center'
        },
        action: 'click',
        nextCondition: 'menuOpen'
      },
      {
        id: 2,
        title: '步驟 2：選擇日常記錄',
        instruction: '在彈出的選單中，選擇「日常記錄」',
        targetElement: {
          component: 'PostMenu',
          selector: '[class*="menuItem"]:first-child, [class*="buttonElement"]:first-child, [class*="menu"] button:first-child, [class*="popup"] button:first-child',
          className: 'menuItem',
          fallbackSelector: 'button:first-child, div:first-child'
        },
        highlight: {
          type: 'rectangle',
          position: 'menu'
        },
        action: 'click',
        nextCondition: 'pageNavigate',
        expectedPath: '/create-post',
        // 添加過渡配置來減少閃爍
        transition: {
          fadeOut: true,
          delay: 320
        }
      },
      {
        id: 3,
        title: '步驟 3：新增照片',
        instruction: '點擊「新增圖片」按鈕，選擇您要上傳的照片',
        targetElement: {
          component: 'CreatePostPage',
          selector: '[class*="addImageBtn"], button[class*="addImage"], input[type="file"], [class*="upload"]',
          className: 'addImageBtn',
          fallbackSelector: 'button, input[type="file"]'
        },
        highlight: {
          type: 'rectangle',
          position: 'center'
        },
        action: 'click',
        nextCondition: 'imageAdded',
        waitFor: 'fileInput',
        // 添加過渡配置來平滑進入
        transition: {
          fadeIn: true,
          delay: 480,
          waitForPageLoad: true
        }
      },
      {
        id: 4,
        title: '步驟 4：點擊照片進行編輯',
        instruction: '點擊剛才上傳的照片，開啟圖片編輯器',
        targetElement: {
          component: 'CreatePostPage',
          selector: '[class*="imagePreview"] img, [class*="clickableImage"]',
          className: 'clickableImage',
          fallbackSelector: 'img'
        },
        highlight: {
          type: 'rectangle',
          position: 'image'
        },
        action: 'click',
        nextCondition: 'editorOpen'
      },
      {
        id: 5,
        title: '步驟 5：在照片上點擊',
        instruction: '在照片中您想要標註寵物的位置點擊一下',
        targetElement: {
          component: 'ImageEditor',
          selector: '[class*="editImage"], img[alt*="編輯"], img[alt*="圖片"]',
          className: 'editImage',
          fallbackSelector: 'img'
        },
        highlight: {
          type: 'fullImage',
          position: 'center'
        },
        action: 'click',
        nextCondition: 'annotationPointAdded',
        showPointer: true
      },
      {
        id: 6,
        title: '步驟 6：選擇標註類型',
        instruction: '在「標註類型」下拉選單中，選擇「寵物」',
        targetElement: {
          component: 'ImageEditor',
          selector: '[class*="typeSelect"], select',
          className: 'typeSelect',
          fallbackSelector: 'select'
        },
        highlight: {
          type: 'rectangle',
          position: 'form'
        },
        action: 'select',
        selectValue: 'pet',
        nextCondition: 'typeSelected'
      },
      {
        id: 7,
        title: '步驟 7：選擇寵物名稱',
        instruction: '在「標註內容」下拉選單中，選擇您的寵物',
        targetElement: {
          component: 'ImageEditor',
          selector: '[class*="searchInput"], select[class*="search"]',
          className: 'searchInput',
          fallbackSelector: 'select:last-of-type'
        },
        highlight: {
          type: 'rectangle',
          position: 'form'
        },
        action: 'select',
        nextCondition: 'petSelected'
      },
      {
        id: 8,
        title: '步驟 8：新增標註',
        instruction: '點擊「新增」按鈕，完成標註',
        targetElement: {
          component: 'ImageEditor',
          selector: '[class*="confirmButton"], button:contains("新增")',
          className: 'confirmButton',
          fallbackSelector: 'button:last-of-type'
        },
        highlight: {
          type: 'rectangle',
          position: 'button'
        },
        action: 'click',
        nextCondition: 'annotationAdded'
      },
      {
        id: 9,
        title: '步驟 9：儲存並關閉',
        instruction: '點擊「完成」按鈕，儲存您的標註',
        targetElement: {
          component: 'ImageEditor',
          selector: '[class*="saveButton"], button:contains("完成")',
          className: 'saveButton',
          fallbackSelector: 'button:contains("儲存")'
        },
        highlight: {
          type: 'rectangle',
          position: 'button'
        },
        action: 'click',
        nextCondition: 'editorClosed'
      },
      {
        id: 10,
        title: '完成！',
        instruction: '恭喜！您已成功在照片中標註寵物。標註會在發布貼文後顯示。',
        targetElement: null,
        highlight: {
          type: 'none',
          position: 'center'
        },
        action: 'complete'
      }
    ],
    // 教學選項配置
    options: {
      allowSkip: true,           // 允許跳過教學
      showProgress: true,        // 顯示進度條
      darkBackground: true,      // 使用暗背景突出重點
      autoAdvance: false,        // 不自動前進，需要用戶操作
      showHints: true,          // 顯示提示
      resetOnError: true,        // 錯誤時重置到當前步驟
      // 全局過渡設置來減少閃爍
      globalTransitions: {
        stepTransitionDelay: 350,     // 步驟間過渡延遲 (ms)
        highlightFadeSpeed: 'smooth', // 高光淡入淡出速度
        pageNavigationBuffer: 700,    // 頁面導航緩衝時間 (ms)
        smoothTransitions: true       // 啟用平滑過渡
      }
    }
  },

  // 其他教學模式可以在這裡添加
  createPost: {
    id: 'createPost',
    title: '如何發布貼文',
    description: '學習如何創建和發布貼文',
    steps: [
      // ... 其他教學步驟
    ]
  },

  feedPet: {
    id: 'feedPet',
    title: '如何設定餵食提醒',
    description: '學習如何為您的寵物設定餵食時間提醒',
    steps: [
      // ... 其他教學步驟
    ]
  }
};

// 教學狀態管理
export const tutorialStates = {
  NOT_STARTED: 'not_started',
  IN_PROGRESS: 'in_progress',
  PAUSED: 'paused',
  COMPLETED: 'completed',
  SKIPPED: 'skipped'
};

// 教學工具函數
export const tutorialUtils = {
  // 獲取特定教學
  getTutorial: (tutorialType) => {
    return tutorialData[tutorialType] || null;
  },

  // 獲取教學的特定步驟
  getStep: (tutorialType, stepId) => {
    const tutorial = tutorialData[tutorialType];
    if (!tutorial) return null;
    return tutorial.steps.find(step => step.id === stepId) || null;
  },

  // 獲取下一步驟
  getNextStep: (tutorialType, currentStepId) => {
    const tutorial = tutorialData[tutorialType];
    if (!tutorial) return null;
    const currentIndex = tutorial.steps.findIndex(step => step.id === currentStepId);
    if (currentIndex === -1 || currentIndex === tutorial.steps.length - 1) {
      return null;
    }
    return tutorial.steps[currentIndex + 1];
  },

  // 獲取上一步驟
  getPreviousStep: (tutorialType, currentStepId) => {
    const tutorial = tutorialData[tutorialType];
    if (!tutorial) return null;
    const currentIndex = tutorial.steps.findIndex(step => step.id === currentStepId);
    if (currentIndex <= 0) {
      return null;
    }
    return tutorial.steps[currentIndex - 1];
  },

  // 檢查是否為最後步驟
  isLastStep: (tutorialType, stepId) => {
    const tutorial = tutorialData[tutorialType];
    if (!tutorial) return false;
    const lastStep = tutorial.steps[tutorial.steps.length - 1];
    return lastStep && lastStep.id === stepId;
  },

  // 獲取教學進度
  getProgress: (tutorialType, currentStepId) => {
    const tutorial = tutorialData[tutorialType];
    if (!tutorial) return 0;
    const currentIndex = tutorial.steps.findIndex(step => step.id === currentStepId);
    if (currentIndex === -1) return 0;
    return ((currentIndex + 1) / tutorial.steps.length) * 100;
  },

  // 儲存教學進度到 localStorage
  saveTutorialProgress: (tutorialType, stepId, state) => {
    const key = `tutorial_${tutorialType}_progress`;
    const progress = {
      tutorialType,
      currentStep: stepId,
      state,
      timestamp: new Date().toISOString()
    };
    localStorage.setItem(key, JSON.stringify(progress));
  },

  // 載入教學進度
  loadTutorialProgress: (tutorialType) => {
    const key = `tutorial_${tutorialType}_progress`;
    const saved = localStorage.getItem(key);
    if (saved) {
      return JSON.parse(saved);
    }
    return null;
  },

  // 清除教學進度
  clearTutorialProgress: (tutorialType) => {
    const key = `tutorial_${tutorialType}_progress`;
    localStorage.removeItem(key);
  },

  // 標記教學為已完成
  markTutorialComplete: (tutorialType) => {
    const key = `tutorial_${tutorialType}_completed`;
    localStorage.setItem(key, 'true');
  },

  // 檢查教學是否已完成
  isTutorialCompleted: (tutorialType) => {
    const key = `tutorial_${tutorialType}_completed`;
    return localStorage.getItem(key) === 'true';
  }
};

export default tutorialData;