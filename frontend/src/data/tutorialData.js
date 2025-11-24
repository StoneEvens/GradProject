/**
 * 教學模式資料結構
 * 包含所有教學流程的步驟定義
 */

import { act } from "react";

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
        title: '步驟 10：新增描述',
        instruction: '在輸入框裡，新增您的貼文描述',
        targetElement: {
          component: 'DescriptionSection',
          selector: '[class*="descriptionInput"]',
          className: 'descriptionInput',
          fallbackSelector: 'textarea'
        },
        highlight: {
          type: 'rectangle',
          position: 'textarea'
        },
        action: 'none',
        nextCondition: 'manualNext'
      },
      {
        id: 11,
        title: '步驟 11：新增標籤',
        instruction: '在「輸入標籤」裡，新增您想使用的 hashtag',
        targetElement: {
          component: 'CreatePostPage',
          selector: '[class*="hashtagInput"], [class*="hashtagInputContainer"], [class*="hashtagInputSection"]',
          className: 'hashtagInput',
          fallbackSelector: 'span[class*="hashSymbol"] + input[type="text"]'
        },
        highlight: {
          type: 'rectangle',
          position: 'button'
        },
        action: 'none',
        nextCondition: 'manualNext'
      },
      {
        id: 12,
        title: '步驟 12：新增hashtag到貼文中',
        instruction: '點擊「新增」按鈕',
        targetElement: {
          component: 'CreatePostPage',
          selector: 'button[class*="addHashtagBtn"], [class*="hashtagInputSection"] > button, [class*="hashtagInputSection"] button',
          className: 'addHashtagButton',
          fallbackSelector: 'div[class*="hashtagInputSection"] button:not([disabled])'
        },
        highlight: {
          type: 'rectangle',
          position: 'button'
        },
        action: 'click'
      },
      {
        id: 13,
        title: '步驟 13：點擊「下一步」按鈕',
        instruction: '確認無誤後點擊按鈕進入預覽頁面',
        targetElement: {
          component: 'CreatePostPage',
          selector: '[class*="nextButton"], button:contains("下一步")',
          className: 'confirmButton',
          fallbackSelector: 'button:last-of-type'
        },
        highlight: {
          type: 'rectangle',
          position: 'button'
        },
        action: 'click'
      },
      {
        id: 14,
        title: '步驟 14：選擇您的位置',
        instruction: '在位置清單中，選擇您發文的地點',
        targetElement: {
          component: 'CreatePostPage',
          selector: 'button[class*="locationButton"], div[class*="userDetails"] > button, div[class*="userInfo"] button',
          className: 'locationButton',
          fallbackSelector: 'button[aria-haspopup="listbox"], button[aria-label*="位置"]'
        },
        highlight: {
          type: 'rectangle',
          position: 'form'
        },
        action: 'none',
        nextCondition: 'manualNext'
      },
      {
        id: 15,
        title: '步驟 15：發布貼文',
        instruction: '點擊「發布」按鈕，發布您的貼文',
        targetElement: {
          component: 'PostPreviewPage',
          selector: 'button[class*="publishButton"], div[class*="actionButtons"] button:last-of-type, div[class*="actionButtons"] > button:nth-of-type(2)',
          className: 'publishButton',
          fallbackSelector: 'button:not([disabled])[class*="publishButton"], div[class*="actionButtons"] button:not([disabled]):last-of-type'
        },
        highlight: {
          type: 'rectangle',
          position: 'button'
        },
        action: 'click'
      },
      {
        id: 16,
        title: '完成！',
        instruction: '恭喜！您已成功發布一則貼文。貼文將會顯示在您的主頁。',
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
  calculate: {
  id: 'calculate',
  title: '如何使用營養計算機',
  description: '學習如何使用計算機計算寵物一天所需攝取之飼料量',
  steps: [
    {
      id: 1,
      title: '步驟 1：開啟營養計算機',
      instruction: '點擊底部導覽列的「計算機」按鈕',
      targetElement: {
        component: 'BottomNavbar',
        selector: 'img[alt*="calculator"], img[src*="Calculator"], [class*="calculate"]',
        className: 'calculate',
        fallbackSelector: '.icon'
      },
      highlight: {
        type: 'circle',
        position: 'bottom-center'
      },
      action: 'click',
      nextCondition: 'pageNavigateToCalculator',
      transition: {
        fadeIn: true,
        delay: 480,
        waitForPageLoad: true
      }
    },
    {
      id: 2,
      title: '步驟 2：選擇寵物',
      instruction: '點擊選擇想計算的寵物',
      targetElement: {
        component: 'Calculate',
        selector: '[class*="petSwitcher"] > [class*="petItem"]:first-of-type, [class*="petSwitcher"] [class*="petItem"]:first-of-type',
        className: 'petItem',
        fallbackSelector: '[class*="petSwitcher"] > div:first-of-type'
      },
      highlight: {
        type: 'rectangle',
        position: 'center'
      },
      nextCondition: 'manualNext',
      action: 'click'
    },
    {
      id: 3,
      title: '步驟 3：更改身體數據',
      instruction: '若身高及體重與當初輸入資料時有變化，可在此更改',
      targetElement: {
        component: 'Calculate',
        selector: '[class*="petInfoSection"]',
        className: 'petInfoSection',
        fallbackSelector: '[class*="petInfoSection"]'
      },
      highlight: {
        type: 'rectangle',
        position: 'image'
      },
      action: 'click',
      nextCondition: 'manualNext'
    },
    {
      id: 4,
      title: '步驟 4：切換頁面',
      instruction: '切換到「寵物狀況」頁面',
      targetElement: {
        component: 'Calculate',
        selector: 'button[class*="navButton"]:has(img[src*="CalculatorPetConditionIcon"])',
        className: 'navButton',
        fallbackSelector: 'img[src*="CalculatorPetConditionIcon"]'
      },
      highlight: {
        type: 'fullImage',
        position: 'center'
      },
      action: 'click',
      nextCondition: 'tabSwitchedToCondition',
    },
    {
      id: 5,
      title: '步驟 5：選擇狀況',
      instruction: '在以下的按鈕中選擇寵物有的身體狀況',
      targetElement: {
        component: 'Calculate',
        selector: '[class*="conditionPanel"], [class*="section"] [class*="conditionPanel"]',
        className: 'conditionPanel',
        fallbackSelector: 'div[class*="conditionPanel"]'
      },
      highlight: {
        type: 'rectangle',
        position: 'form'
      },
      nextCondition: 'manualNext'
    },
    {
      id: 6,
      title: '步驟 6：切換頁面',
      instruction: '切換到「選擇飼料」頁面',
      targetElement: {
        component: 'Calculate',
        selector: 'button[class*="navButton"]:has(img[src*="PetpageFeedButton"])',
        className: 'navButton',
        fallbackSelector: 'img[src*="PetpageFeedButton"]'
      },
      highlight: {
        type: 'rectangle',
        position: 'center'
      },
      action: 'click',
      showPointer: true
    },
    {
      id: 7,
      title: '步驟 7：新增飼料',
      instruction: '若已經新增過飼料，您可以直接點選「選擇飼料」，若需要新增飼料，就點選「新增飼料」，這邊教學新增飼料',
      targetElement: {
        component: 'Calculate',
        selector: '[class*="feedActions"] button[class*="feedActionBtn"]:nth-of-type(2)',
        className: 'feedActionBtn',
        fallbackSelector: '[class*="feedActions"] button:last-of-type'
      },
      highlight: {
        type: 'rectangle',
        position: 'button'
      },
      action: 'click',
      showPointer: true
    },
    {
      id: 8,
      title: '步驟 8：選擇寵物類型',
      instruction: '選擇這隻寵物是貓還是狗',
      targetElement: {
        component: 'CreateFeedModal',
        selector: 'select[class*="petTypeSelect"]:not([disabled]), [class*="selectSection"] select:not([disabled])',
        className: 'petTypeSelect',
        fallbackSelector: 'label[class*="selectLabel"] + select:not([disabled])'
      },
      highlight: {
        type: 'rectangle',
        position: 'form'
      },
      nextCondition: 'manualNext'
    },
    {
      id: 9,
      title: '步驟 9：輸入飼料名稱',
      instruction: '',
      targetElement: {
        component: 'CreateFeedModal',
        selector: '[data-step="feed-name"] input[class*="textInput"]:not([disabled])',
        className: 'textInput',
        fallbackSelector: '[class*="inputSection"]:first-of-type label + input[type="text"]:not([disabled])'
      },
      highlight: {
        type: 'rectangle',
        position: 'form'
      },
      nextCondition: 'manualNext',
      showPointer: true
    },
    {
      id: 10,
      title: '步驟 10：輸入飼料品牌',
      instruction: '',
      targetElement: {
        component: 'CreateFeedModal',
        selector: '[data-step="feed-brand"] input[class*="textInput"]:not([disabled])',
        className: 'textInput',
        fallbackSelector: 'label:contains("品牌") + input[type="text"]:not([disabled])'
      },
      highlight: {
        type: 'rectangle',
        position: 'form'
      },
      nextCondition: 'manualNext',
      showPointer: true
    },
    {
      id: 11,
      title: '步驟 11：輸入飼料價格',
      instruction: '',
      targetElement: {
        component: 'CreateFeedModal',
        selector: '[class*="inputSection"]:first-of-type + [class*="inputSection"] + [class*="inputSection"] input[type="number"]:not([disabled]), input[type="number"]:not([disabled])',
        className: 'textInput',
        fallbackSelector: '[class*="inputSection"]:first-of-type + [class*="inputSection"] + [class*="inputSection"] label + input[type="number"]:not([disabled])'
      },
      highlight: {
        type: 'rectangle',
        position: 'form'
      },
      nextCondition: 'manualNext',
      showPointer: true
    },
    {
      id: 12,
      title: '步驟 12：上傳飼料正面圖片',
      instruction: '',
      targetElement: {
        component: 'CreateFeedModal',
        selector: '[data-step="upload-front"] button[class*="uploadButton"]:not([disabled])',
        className: 'uploadButton',
        fallbackSelector: '[data-step="upload-front"] button:not([disabled])'
      },
      highlight: {
        type: 'rectangle',
        position: 'button'
      },
      nextCondition: 'manualNext',
      showPointer: true
    },
    {
      id: 13,
      title: '步驟 13：上傳飼料營養標示',
      instruction: '',
      targetElement: {
        component: 'CreateFeedModal',
        selector: '[data-step="upload-nutrition"] button[class*="uploadButton"]:not([disabled])',
        className: 'uploadButton',
        fallbackSelector: '[data-step="upload-nutrition"] button:not([disabled])'
      },
      highlight: {
        type: 'rectangle',
        position: 'button'
      },
      nextCondition: 'manualNext',
      showPointer: true
    },
    {
      id: 14,
      title: '步驟 14：完成「新增飼料」',
      instruction: '按下「確認新增」按鈕',
      targetElement: {
        component: 'CreateFeedModal',
        selector: '[class*="modalFooter"] button[class*="confirmButton"]:nth-of-type(2)', // 僅選中可點擊的按鈕
        className: 'confirmButton',
        fallbackSelector: '[class*="modalFooter"] button:last-of-type:not([disabled])'
      },
      highlight: {
        type: 'rectangle',
        position: 'button'
      },
      action: 'click',
      showPointer: true
    },
    {
      id: 15,
      title: '步驟 15：點選「開始計算」按鈕',
      instruction: '開始依數據計算結果',
      targetElement: {
        component: 'Calculate',
        selector: 'button[class*="navButton"]:has(img[src*="CalculatorCalculateIcon"])',
        className: 'navButton',
        fallbackSelector: 'img[src*="CalculatorCalculateIcon"]'
      },
      highlight: {
        type: 'fullImage',
        position: 'center'
      },
      action: 'click',
      showPointer: true
    },
    {
      id: 16,
      title: '完成！',
      instruction: '恭喜！您已成功獲得計算結果！',
      targetElement: null,
      highlight: {
        type: 'none',
        position: 'center'
      },
      action: 'complete'
    }
  ]},
  addAbnormalPost: {
  id: 'addAbnormalPost',
  title: '如何新增異常記錄',
  description: '學習如何新增一篇異常記錄',
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
      title: '步驟 2：選擇異常記錄',
      instruction: '在彈出的選單中，選擇「異常記錄」',
      targetElement: {
        component: 'PostMenu',
        selector: '[class*="menuItem"]:second-child, [class*="buttonElement"]:second-child, [class*="menu"] button:second-child, [class*="popup"] button:second-child',
        className: 'menuItem',
        fallbackSelector: 'button:second-child, div:second-child'
      },
      highlight: {
        type: 'rectangle',
        position: 'menu'
      },
      action: 'click',
      nextCondition: 'pageNavigate',
      expectedPath: '/create-abnormal-post',
      // 添加過渡配置來減少閃爍
      transition: {
        fadeOut: true,
        delay: 320
      }
    },
    {
      id: 3,
      title: '步驟 3：選擇寵物',
      instruction: '從這裡點選要建立紀錄的寵物',
      targetElement: {
        component: 'CreateAbnormalPostPage',
        selector: '[class*="petSwitcher"]',
        className: 'petSwitcher',
        fallbackSelector: 'div[class*="section"] [class*="petSwitcher"], [class*="petItem"]'
      },
      highlight: {
        type: 'rectangle',
        position: 'center'
      },
      action: 'click',
      nextCondition: 'petChosen'
    },
    {
      id: 4,
      title: '步驟 4：選擇日期',
      instruction: '選擇此異常狀況發生的日期',
      targetElement: {
        component: 'CreateAbnormalPostPage',
        selector: 'input[class*="dateInput"]:not([disabled])',
        className: 'dateInput',
        fallbackSelector: '[class*="dateInputWrapper"] input[type="date"]:not([disabled])'
      },
      highlight: {
        type: 'rectangle',
        position: 'form'
      },
      action: 'click',
      nextCondition: 'menuOpen'
    },
    {
      id: 5,
      title: '步驟 5：勾選是否為就醫記錄',
      instruction: '',
      targetElement: {
        component: 'CreateAbnormalPostPage',
        selector: 'label[for="emergency"], input#emergency',
        className: 'checkbox',
        fallbackSelector: '[class*="emergencyCheckbox"] input[type="checkbox"]'
      },
      highlight: {
        type: 'rectangle',
        position: 'button'
      },
      action: 'click',
      nextCondition: 'menuOpen'
    },
    {
      id: 7,
      title: '步驟 7：選擇症狀',
      instruction: '從下拉選單選擇一個症狀',
      targetElement: {
        component: 'CreateAbnormalPostPage',
        // 鎖定症狀區塊內的 select
        selector: '[class*="symptomSection"] [class*="symptomSelectContainer"] select[class*="symptomSelect"]:not([disabled])',
        className: 'symptomSelect',
        fallbackSelector: '[class*="symptomInputSection"] select:not([disabled])'
      },
      highlight: { type: 'rectangle', position: 'form' },
      action: 'select',
      nextCondition: 'menuOpen'
    },
    {
      id: 8,
      title: '步驟 8：新增症狀',
      instruction: '按「新增」把剛才選的症狀加入，若需要新增多個症狀請重複步驟7和8',
      targetElement: {
        component: 'CreateAbnormalPostPage',
        selector: '[class*="symptomSection"] [class*="symptomInputSection"] button[class*="addSymptomBtn"]:not([disabled])',
        className: 'addSymptomBtn',
        fallbackSelector: '[class*="symptomInputSection"] button:not([disabled])'
      },
      highlight: { type: 'rectangle', position: 'button' },
      action: 'click',
      nextCondition: 'menuOpen'
    },
    {
      id: 9,
      title: '步驟 9：填寫體重',
      instruction: '',
      targetElement: {
        component: 'CreateAbnormalPostPage',
        selector: '[class*="bodyStatsContainer"] [class*="statRow"]:first-of-type input[class*="statInput"]:not([disabled])',
        className: 'statInput',
        fallbackSelector: '[class*="bodyStatsContainer"] [class*="statRow"]:first-of-type input[type="number"]:not([disabled])'
      },
      highlight: { type: 'rectangle', position: 'form' },
      action: 'click',
      nextCondition: 'menuOpen'
    },
    {
      id: 10,
      title: '步驟 10：填寫喝水量',
      instruction: '',
      targetElement: {
        component: 'CreateAbnormalPostPage',
        selector: '[class*="bodyStatsContainer"] [class*="statRow"]:first-of-type + [class*="statRow"] input[class*="statInput"]:not([disabled])',
        className: 'statInput',
        fallbackSelector: '[class*="bodyStatsContainer"] [class*="statRow"]:first-of-type + [class*="statRow"] input[type="number"]:not([disabled])'
      },
      highlight: { type: 'rectangle', position: 'form' },
      action: 'click',
      nextCondition: 'menuOpen'
    },
    {
      id: 11,
      title: '步驟 11：填寫體溫',
      instruction: '',
      targetElement: {
        component: 'CreateAbnormalPostPage',
        selector: '[class*="bodyStatsContainer"] [class*="statRow"]:first-of-type + [class*="statRow"] + [class*="statRow"] input[class*="statInput"]:not([disabled])',
        className: 'statInput',
        fallbackSelector: '[class*="bodyStatsContainer"] [class*="statRow"]:first-of-type + [class*="statRow"] + [class*="statRow"] input[type="number"]:not([disabled])'
      },
      highlight: { type: 'rectangle', position: 'form' },
      action: 'click',
      nextCondition: 'menuOpen'
    },
    {
      id: 12,
      title: '步驟 12：新增圖片',
      instruction: '點選方框新增寵物需記錄之圖片',
      targetElement: {
        component: 'CreateAbnormalPostPage',
        selector: '[class*="imageControls"] button[class*="addImageBtn"]:not([disabled])',
        className: 'addImageBtn',
        fallbackSelector: '[class*="imageControls"] button:not([disabled])'
      },
      highlight: { type: 'rectangle', position: 'button' },
      action: 'click',
      nextCondition: 'menuOpen'
    },
    {
      id: 13,
      title: '步驟 13：新增補充描述',
      instruction: '將剛才沒記錄到的部分，如寵物精神狀況、醫生提醒、異常行為等填入空格',
       targetElement: {
        component: 'CreateAbnormalPostPage',
        selector: 'textarea[class*="descriptionInput"]:not([disabled])',
        className: 'descriptionInput',
        fallbackSelector: '[class*="descriptionSection"] textarea:not([disabled])'
      },
      highlight: { type: 'rectangle', position: 'form' },
      action: 'click',
      nextCondition: 'menuOpen'
    },
    {
      id: 14,
      title: '步驟 14：建立異常記錄',
      instruction: '點擊「建立」按鈕完成建立動作',
      targetElement: {
        component: 'CreateAbnormalPostPage',
        selector: '[class*="actionButtons"] button[class*="createButton"]:not([disabled])',
        className: 'createButton',
        fallbackSelector: '[class*="actionButtons"] button:last-of-type:not([disabled])'
      },
      highlight: { type: 'rectangle', position: 'button' },
      action: 'click',
      nextCondition: 'menuOpen'
    },
    {
        id: 15,
        title: '完成！',
        instruction: '恭喜！您已成功新增一篇異常記錄！',
        targetElement: null,
        highlight: {
          type: 'none',
          position: 'center'
        },
        action: 'complete'
    }
  ]},
  addPet: {
    id: 'addPet',
    title: '如何新增一隻寵物',
    description: '學習如何將您的寵物新增到系統裡',
    steps: [
      {
        id: 1,
        title: '步驟 1：開啟寵物頁面',
        instruction: '點擊底部導覽列的「寵物」按鈕',
        targetElement: {
          component: 'BottomNavbar',
          selector: 'img[alt*="pets"], img[src*="CreatePost"], [class*="createPost"]',
          className: 'calculate',
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
        title: '步驟 2：按下「新增寵物」按鈕',
        instruction: '',
        targetElement: {
          component: 'addPet',
          selector: 'button[class*="addFirstPetButton"]:not([disabled])',
          className: 'addFirstPetButton',
          fallbackSelector: 'button[class*="addFirstPetButton"], button[class*="addPetButton"]:not([disabled])'
        },
        highlight: {
          type: 'rectangle',
          position: 'button'
        },
        action: 'click',
        nextCondition: 'menuOpen'
      },
      {
        id: 3,
        title: '步驟 3：選擇您的寵物種類',
        instruction: '請在下方選擇「貓」或「狗」',
        targetElement: {
          component: 'AddPetPage',
          selector: '[class*="phaseOne"] [class*="petTypeButtons"]',
          className: 'petTypeButtons',
          fallbackSelector: '[class*="petTypeSection"] [class*="petTypeButtons"]'
        },
        highlight: {
          type: 'rectangle',
          position: 'center'
        },
        action: 'click',
        nextCondition: 'menuOpen'
      },
      {
        id: 4,
        title: '步驟 4：上傳頭貼',
        instruction: '請上傳您的寵物的照片',
        targetElement: {
          component: 'AddPetPage',
          selector: '[class*="phaseTwo"] [class*="avatarUpload"]',
          className: 'avatarUpload',
          fallbackSelector: '[class*="phaseTwoTopSection"] [class*="avatarUpload"]'
        },
        highlight: {
          type: 'rectangle',
          position: 'image'
        },
        action: 'click',
        nextCondition: 'menuOpen'
      },
      {
        id: 5,
        title: '步驟 5：填入寵物姓名',
        instruction: '',
        targetElement: {
          component: 'AddPetPage',
          selector: '[class*="phaseTwo"] input[name="name"]:not([disabled])',
          className: 'formInput',
          fallbackSelector: '[class*="formFields"] input[name="name"]:not([disabled])'
        },
        highlight: {
          type: 'rectangle',
          position: 'form'
        },
        action: 'click',
        nextCondition: 'menuOpen'
      },
      {
        id: 6,
        title: '步驟 6：選擇寵物品種',
        instruction: '',
        targetElement: {
          component: 'AddPetPage',
          selector: '[class*="phaseTwo"] select[name="breed"]:not([disabled])',
          className: 'formSelect',
          fallbackSelector: '[class*="formFields"] select[name="breed"]:not([disabled])'
        },
        highlight: {
          type: 'rectangle',
          position: 'form'

        },
        action: 'click',
        nextCondition: 'menuOpen'
      },
      {
        id: 7,
        title: '步驟 7：填入寵物年齡',
        instruction: '',
        targetElement: {
          component: 'AddPetPage',
          selector: '[class*="phaseTwo"] input[name="age"]:not([disabled])',
          className: 'formInput',
          fallbackSelector: '[class*="formFields"] input[name="age"]:not([disabled])'
        },
        highlight: {
          type: 'rectangle',
          position: 'form'
        },
        action: 'click',
        nextCondition: 'menuOpen'
      },
      {
        id: 8,
        title: '步驟 8：填入寵物體重',
        instruction: '',
        targetElement: {
          component: 'AddPetPage',
          selector: '[class*="phaseTwo"] input[name="weight"]:not([disabled])',
          className: 'formInput',
          fallbackSelector: '[class*="formFields"] input[name="weight"]:not([disabled])'
        },
        highlight: {
          type: 'rectangle',
          position: 'form'
        },
        action: 'click',
        nextCondition: 'menuOpen'
      },
      {
        id: 9,
        title: '步驟 9：填入寵物身高',
        instruction: '',
        targetElement: {
          component: 'AddPetPage',
          selector: '[class*="phaseTwo"] input[name="height"]:not([disabled])',
          className: 'formInput',
          fallbackSelector: '[class*="formFields"] input[name="height"]:not([disabled])'
        },
        highlight: {
          type: 'rectangle',
          position: 'form'
        },
        action: 'click',
        nextCondition: 'menuOpen'
      },
      {
        id: 10,
        title: '步驟 10：填入寵物介紹',
        instruction: '',
        targetElement: {
          component: 'AddPetPage',
          selector: '[class*="phaseTwo"] textarea[name="description"]:not([disabled])',
          className: 'formTextarea',
          fallbackSelector: '[class*="descriptionSection"] textarea[name="description"]:not([disabled])'
        },
        highlight: {
          type: 'rectangle',
          position: 'form'
        },
        action: 'click',
        nextCondition: 'menuOpen'
      },
      {
        id: 11,
        title: '步驟 11：完成填寫寵物資料',
        instruction: '按下「完成」按鈕',
        targetElement: {
          component: 'AddPetPage',
          selector: '[class*="actionButtons"] button[class*="submitButton"]:not([disabled])',
          className: 'submitButton',
          fallbackSelector: '[class*="actionButtons"] button:last-of-type:not([disabled])'
        },
        highlight: {
          type: 'rectangle',
          position: 'button'
        },
        action: 'click',
        nextCondition: 'menuOpen'
      },
      {
        id: 12,
        title: '完成！',
        instruction: '恭喜！您已成功新增一隻您的寵物！',
        targetElement: null,
        highlight: {
          type: 'none',
          position: 'center'
        },
        action: 'complete'
      }
    ]
  },
  
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