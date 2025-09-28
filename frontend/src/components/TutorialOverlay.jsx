import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { tutorialUtils } from '../data/tutorialData';
import styles from '../styles/TutorialOverlay.module.css';

// 處理包含 :contains() 的選擇器
const findElementWithSelector = (selector) => {
  // 如果選擇器包含 :contains()，需要特別處理
  if (selector.includes(':contains(')) {
    const parts = selector.split(',').map(s => s.trim());

    for (const part of parts) {
      if (part.includes(':contains(')) {
        // 解析 :contains() 語法
        const containsMatch = part.match(/button:contains\(["'](.+?)["']\)/);
        if (containsMatch) {
          const text = containsMatch[1];
          const buttons = document.querySelectorAll('button');
          for (const button of buttons) {
            if (button.textContent.trim().includes(text)) {
              return button;
            }
          }
        }
      } else {
        // 普通選擇器
        try {
          const element = document.querySelector(part);
          if (element) return element;
        } catch (e) {
          console.warn('無效的選擇器:', part);
        }
      }
    }
    return null;
  } else {
    // 沒有 :contains()，直接使用 querySelector
    try {
      return document.querySelector(selector);
    } catch (e) {
      console.warn('無效的選擇器:', selector);
      return null;
    }
  }
};

const TutorialOverlay = ({ tutorialType, onComplete, onSkip }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [currentStep, setCurrentStep] = useState(1);
  const [tutorial, setTutorial] = useState(null);
  const [stepData, setStepData] = useState(null);
  const [highlightPosition, setHighlightPosition] = useState(null);
  const [chatPosition, setChatPosition] = useState(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const overlayRef = useRef(null);
  const spotlightRef = useRef(null);
  const targetElementRef = useRef(null);
  const chatBubbleRef = useRef(null);
  const currentObserverRef = useRef(null);
  const currentTimeoutRef = useRef(null);
  const elementCacheRef = useRef({});
  const lastChatPosRef = useRef(null);
  const lastHighlightPosRef = useRef(null);
  const chatFreezeUntilRef = useRef(0);
  const chatBubbleHeightRef = useRef(200);

  // 穩定更新：避免小幅度抖動與頻繁重繪
  const setHighlightPositionStable = useCallback((rect) => {
    if (!rect) {
      lastHighlightPosRef.current = null;
      setHighlightPositionStable(null);
      return;
    }
    const rounded = {
      top: Math.round(rect.top),
      left: Math.round(rect.left),
      width: Math.round(rect.width),
      height: Math.round(rect.height)
    };
    const last = lastHighlightPosRef.current;
    const isSignificantChange = !last ||
      Math.abs(rounded.top - last.top) >= 2 ||
      Math.abs(rounded.left - last.left) >= 2 ||
      Math.abs(rounded.width - last.width) >= 2 ||
      Math.abs(rounded.height - last.height) >= 2;
    if (isSignificantChange) {
      lastHighlightPosRef.current = rounded;
      setHighlightPosition(rounded);
    }
  }, []);

  const setChatPositionStable = useCallback((pos) => {
    if (!pos) {
      lastChatPosRef.current = null;
      setChatPosition(null);
      return;
    }
    const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    if (now < chatFreezeUntilRef.current) {
      return;
    }
    const rounded = {
      top: Math.round(pos.top),
      left: Math.round(pos.left),
      width: Math.round(pos.width),
      placement: pos.placement,
      description: pos.description
    };
    const last = lastChatPosRef.current;
    const smallMove = last && rounded.placement === last.placement &&
      Math.abs(rounded.top - last.top) < 4 &&
      Math.abs(rounded.left - last.left) < 4 &&
      Math.abs(rounded.width - last.width) < 4;
    if (smallMove) {
      return;
    }
    lastChatPosRef.current = rounded;
    setChatPosition(rounded);
    chatFreezeUntilRef.current = now + 120; // 120ms 冷卻時間
  }, []);

  // 載入教學資料
  useEffect(() => {
    const tutorialData = tutorialUtils.getTutorial(tutorialType);
    if (tutorialData) {
      setTutorial(tutorialData);
      const firstStep = tutorialData.steps[0];
      setStepData(firstStep);
      setCurrentStep(firstStep.id);

      // 確保關閉任何打開的 PostMenu
      console.log('教學開始：關閉 PostMenu');
      window.dispatchEvent(new CustomEvent('closeTutorialConflicts'));

      // 儲存進度
      tutorialUtils.saveTutorialProgress(tutorialType, firstStep.id, 'in_progress');
    }
  }, [tutorialType]);

  // 組件清理 - 確保清理所有監聽器
  useEffect(() => {
    return () => {
      // 清理 MutationObserver
      if (currentObserverRef.current) {
        console.log('組件清理：停止 MutationObserver');
        currentObserverRef.current.disconnect();
        currentObserverRef.current = null;
      }

      // 清理超時器
      if (currentTimeoutRef.current) {
        console.log('組件清理：清除超時器');
        clearTimeout(currentTimeoutRef.current);
        currentTimeoutRef.current = null;
      }
    };
  }, []);

  // 計算聊天泡泡位置，根據目標元素位置智能選擇高度
  const calculateChatPosition = useCallback((targetRect) => {
    // 取得應用程式容器的實際尺寸
    const appContainer = document.getElementById('root');
    const containerRect = appContainer ? appContainer.getBoundingClientRect() : null;

    const containerWidth = containerRect ? containerRect.width : Math.min(window.innerWidth, 430);
    const containerHeight = containerRect ? containerRect.height : window.innerHeight;
    const containerLeft = containerRect ? containerRect.left : (window.innerWidth - containerWidth) / 2;
    const containerTop = containerRect ? containerRect.top : 0;

    const margin = 20;
    const chatBubbleHeight = chatBubbleHeightRef.current || 200; // 動態量測後的聊天泡泡高度

    // 步驟 5：固定在畫面下方 35% 位置（覆蓋其他定位邏輯）
    if (stepData?.id === 5) {
      const topCandidate = containerHeight * 0.55; // 下方 35%
      const finalTop = Math.max(
        margin,
        Math.min(topCandidate, containerHeight - chatBubbleHeight - margin)
      );
      return {
        top: finalTop,
        left: margin,
        width: containerWidth - (margin * 2),
        placement: 'bottom-35-fixed',
        description: '步驟5：固定在下方35%'
      };
    }

    // 特殊處理：對於 fullImage 類型的高亮，根據高光區域動態定位
    if (stepData?.highlight?.type === 'fullImage') {
      if (highlightPosition) {
        const gap = stepData?.id === 5 ? 56 : 20; // 第 5 步進一步加大間距
        const highlightTop = highlightPosition.top;
        const highlightBottom = highlightPosition.top + highlightPosition.height;
        const highlightRatio = highlightPosition.height / containerHeight;

        // 第 5 步：若高光占比過大或靠近容器下半部，直接固定在底部，避免遮擋
        if (stepData?.id === 5 && (highlightRatio > 0.5 || highlightBottom > containerHeight * 0.55)) {
          const bottomGap = Math.max(24, margin);
          return {
            top: Math.max(margin, containerHeight - chatBubbleHeight - bottomGap),
            left: margin,
            width: containerWidth - (margin * 2),
            placement: 'bottom-fixed-avoid-highlight',
            description: '步驟5：高光占比大，固定底部'
          };
        }

        // 優先放在高光區塊下方，若空間不足則改放上方
        const belowTop = highlightBottom + gap;
        const fitsBelow = belowTop + chatBubbleHeight + margin <= containerHeight;
        if (fitsBelow) {
          return {
            top: belowTop,
            left: margin,
            width: containerWidth - (margin * 2),
            placement: 'below-highlight',
            description: '全圖高亮 - 高光區塊下方'
          };
        }

        // 放在上方（留間距），並確保不超出頂部
        const aboveTop = Math.max(margin, highlightTop - gap - chatBubbleHeight);
        const fitsAbove = aboveTop >= margin;
        if (fitsAbove) {
          return {
            top: aboveTop,
            left: margin,
            width: containerWidth - (margin * 2),
            placement: 'above-highlight',
            description: '全圖高亮 - 高光區塊上方'
          };
        }

        // 仍然放不下，退回中央或底部固定位置
        const fallbackTop = Math.min(
          (containerHeight - chatBubbleHeight) / 2,
          containerHeight - chatBubbleHeight - margin
        );
        return {
          top: Math.max(margin, fallbackTop),
          left: margin,
          width: containerWidth - (margin * 2),
          placement: 'center',
          description: '全圖高亮 - 空間不足（置中）'
        };
      }
      // 若尚未取得高光位置，退回原本邏輯（置於容器下半部）
      const fallbackTop = containerHeight - 250;
      return {
        top: Math.max(margin, Math.min(fallbackTop, containerHeight - chatBubbleHeight - margin)),
        left: margin,
        width: containerWidth - (margin * 2),
        placement: 'bottom-fixed',
        description: '全圖高亮 - 尚無高光位置（備用）'
      };
    }

    if (!targetRect) {
      // 沒有目標元素時（如完成步驟），放在容器中央
      return {
        top: (containerHeight - chatBubbleHeight) / 2,
        left: margin,
        width: containerWidth - (margin * 2),
        placement: 'center-default',
        description: '沒有目標元素 - 中央位置'
      };
    }

    // 計算相對於容器的位置
    const targetCenterY = targetRect.top + targetRect.height / 2;
    const targetBottom = targetRect.bottom;
    const targetTop = targetRect.top;

    // 計算相對於容器的相對位置
    const relativeTargetTop = targetTop - containerTop;
    const relativeTargetBottom = targetBottom - containerTop;
    const relativeTargetCenterY = targetCenterY - containerTop;

    // 定義不同的位置選項（按優先順序）
    const positions = [
      // 1. 在目標元素下方（如果目標在容器上半部且有足夠空間）
      {
        condition: relativeTargetBottom < containerHeight * 0.5 &&
                   (containerHeight - relativeTargetBottom) > (chatBubbleHeight + 60),
        top: relativeTargetBottom + 30,
        placement: 'below-target',
        description: '目標元素下方'
      },
      // 2. 在目標元素上方（如果目標在容器下半部且有足夠空間）
      {
        condition: relativeTargetTop > containerHeight * 0.5 &&
                   relativeTargetTop > (chatBubbleHeight + 60),
        top: relativeTargetTop - chatBubbleHeight - 30,
        placement: 'above-target',
        description: '目標元素上方'
      },
      // 3. 容器上方（如果目標在容器下方）
      {
        condition: relativeTargetTop > containerHeight * 0.75,
        top: 50,
        placement: 'top-fixed',
        description: '容器上方'
      },
      // 4. 容器中央（如果目標在容器中央區域）
      {
        condition: relativeTargetCenterY > containerHeight * 0.25 &&
                   relativeTargetCenterY < containerHeight * 0.75,
        top: (containerHeight - chatBubbleHeight) / 2,
        placement: 'center',
        description: '容器中央'
      },
      // 5. 容器下方（預設位置）
      {
        condition: true,
        top: containerHeight - 250,
        placement: 'bottom-fixed',
        description: '容器下方'
      }
    ];

    // 找到第一個符合條件的位置
    for (const pos of positions) {
      if (pos.condition) {
        // 確保不會超出容器範圍（相對於 overlay）
        const finalTop = Math.max(
          margin,
          Math.min(pos.top, containerHeight - chatBubbleHeight - margin)
        );

        return {
          top: finalTop,
          left: margin,
          width: containerWidth - (margin * 2),
          placement: pos.placement,
          description: pos.description
        };
      }
    }

    // 備用方案
    return {
      top: containerHeight - 250,
      left: margin,
      width: containerWidth - (margin * 2),
      placement: 'bottom-fixed',
      description: '容器下方（備用）'
    };
  }, [stepData, highlightPosition]);

  // 量測聊天泡泡實際高度並在高度變更時重新計算定位
  useEffect(() => {
    if (!chatBubbleRef.current) return;
    const rect = chatBubbleRef.current.getBoundingClientRect();
    const measured = Math.max(140, Math.min(300, Math.round(rect.height || 0)));
    if (!measured || isNaN(measured)) return;
    if (Math.abs((chatBubbleHeightRef.current || 0) - measured) > 4) {
      chatBubbleHeightRef.current = measured;
      // 重新計算一次位置（特別是 fullImage/步驟5）
      const targetEl = targetElementRef.current;
      const targetRect = targetEl ? targetEl.getBoundingClientRect() : null;
      const newPos = calculateChatPosition(targetRect);
      setChatPositionStable(newPos);
    }
  }, [stepData?.id, highlightPosition]);

  // 清理函數引用
  const cleanupRef = useRef(null);
  const conditionCleanupRef = useRef(null);

  // 找到目標元素並設置 spotlight 和聊天位置
  const findAndHighlightElement = useCallback(() => {
    console.log('findAndHighlightElement 被調用:', {
      stepId: stepData?.id,
      targetElement: stepData?.targetElement,
      currentStep
    });

    // 先清理之前的事件監聽器
    if (cleanupRef.current) {
      console.log('清理之前的事件監聽器');
      cleanupRef.current();
      cleanupRef.current = null;
    }

    if (!stepData || !stepData.targetElement) {
      console.log('沒有目標元素，使用預設位置');
      setHighlightPosition(null);
      // 目標元素不存在時，聊天泡泡使用預設位置
      const chatPos = calculateChatPosition(null);
      setChatPositionStable(chatPos);
      return;
    }

    const { className, selector } = stepData.targetElement;
    console.log('尋找目標元素:', { className, selector });

    // 供快取與一般流程共用：設定目標元素互動（事件/條件監聽）
    const setupTargetInteraction = (targetElement) => {
      // 監聽元素點擊 - 加強事件綁定和防止重複觸發
      const handleElementClick = (e) => {
        // 確保只處理直接點擊目標元素的事件
        if (e.target !== targetElement && !targetElement.contains(e.target)) {
          console.log('忽略非目標元素的點擊:', e.target);
          return;
        }

        // 記錄是否應該阻止事件傳播
        let shouldStopPropagation = true;

        console.log('目標元素被點擊:', targetElement);
        console.log('實際點擊元素:', e.target);
        console.log('當前教學狀態:', {
          tutorial: !!tutorial,
          isTransitioning,
          currentStep,
          stepData: stepData?.id,
          tutorialType,
          nextCondition: stepData?.nextCondition
        });

        // 確保當前步驟與點擊時的步驟一致
        if (stepData?.id !== currentStep) {
          console.log('步驟不一致，忽略點擊:', { stepDataId: stepData?.id, currentStep });
          return;
        }

        // 檢查是否有 nextCondition（需要等待條件滿足）
        if (stepData && stepData.nextCondition) {
          console.log('需要等待條件:', stepData.nextCondition);
          // 允許原始事件繼續執行，不阻止事件冒泡
          // 開始監聽條件變化
          startConditionMonitoring(stepData.nextCondition);

          // 對於 menuOpen 和 pageNavigate 條件，需要讓點擊事件正常執行
          if (stepData.nextCondition === 'menuOpen' || stepData.nextCondition === 'pageNavigate') {
            // 移除事件阻止，讓原始點擊功能執行
            console.log('允許原始點擊事件執行以觸發:', stepData.nextCondition);
            shouldStopPropagation = false;
            if (stepData.nextCondition === 'pageNavigate') {
              // 立即移除高光並置中聊天泡泡，避免導航瞬間閃爍
              if (cleanupRef.current) {
                cleanupRef.current();
                cleanupRef.current = null;
              }
              targetElementRef.current = null;
              setHighlightPositionStable(null);
              const chatPos = calculateChatPosition(null);
              setChatPositionStable(chatPos);
            }
          }
        } else if (stepData && stepData.action === 'click') {
          console.log('需要執行原始點擊功能');
          // 對於需要原始點擊功能的步驟，不阻止事件傳播
          shouldStopPropagation = false;

          // 如果有 nextCondition，表示需要等待條件滿足，不直接進入下一步
          if (!stepData.nextCondition) {
            // 延遲執行教學進度
            setTimeout(() => {
              // 再次確認步驟沒有改變
              if (stepData?.id === currentStep) {
                handleNextStep();
              }
            }, 200);
          }
        } else {
          console.log('只處理教學進度');
          handleNextStep();
        }

        // 根據條件決定是否阻止事件傳播
        if (shouldStopPropagation) {
          e.stopPropagation();
          e.stopImmediatePropagation();
        }
      };

      // 對於文件輸入相關的元素，完全不添加事件監聽器，讓原始功能自由執行
      const isFileInput = targetElement.tagName === 'INPUT' && targetElement.type === 'file';
      const needsProgrammaticClick = stepData?.waitFor === 'fileInput' ||
                                   stepData?.nextCondition === 'imageAdded' ||
                                   stepData?.nextCondition === 'editorOpen' ||
                                   stepData?.nextCondition === 'annotationPointAdded' ||
                                   stepData?.nextCondition === 'petSelected' ||
                                   stepData?.nextCondition === 'annotationAdded' ||
                                   stepData?.nextCondition === 'editorClosed' ||
                                   stepData?.action === 'select' ||
                                   targetElement.className?.includes('addImageBtn') ||
                                   targetElement.className?.includes('clickableImage') ||
                                   targetElement.className?.includes('editImage') ||
                                   targetElement.className?.includes('confirmButton') ||
                                   targetElement.className?.includes('saveButton') ||
                                   targetElement.tagName === 'SELECT';

      console.log('事件監聽設置(快取/一般共用):', {
        isFileInput,
        needsProgrammaticClick,
        className: targetElement.className,
        stepId: stepData?.id,
        nextCondition: stepData?.nextCondition
      });

      // 記錄是否添加了事件監聽器
      let hasEventListener = false;

      // 對於需要程序化點擊的元素，不添加事件監聽器，直接開始條件監聽
      if (needsProgrammaticClick || isFileInput) {
        console.log('跳過事件監聽器添加，直接開始條件監聽');
        if (stepData?.nextCondition) {
          // 延遲一下確保用戶有時間點擊
          setTimeout(() => {
            startConditionMonitoring(stepData.nextCondition);
          }, 100);
        }
      } else {
        targetElement.addEventListener('click', handleElementClick, true);
        hasEventListener = true;
      }

      // 儲存清理函數
      const cleanup = () => {
        if (targetElement) {
          if (hasEventListener) {
            targetElement.removeEventListener('click', handleElementClick, true);
          }
          targetElement.classList.remove('tutorial-target');
          targetElement.style.position = '';
          targetElement.style.zIndex = '';
          targetElement.style.pointerEvents = '';
          targetElement.style.userSelect = '';
          targetElement.style.touchAction = '';
        }
      };
      cleanupRef.current = cleanup;
      return cleanup;
    };

    // 先嘗試使用快取的元素以減少搜尋時間
    const cachedEl = elementCacheRef.current[stepData.id];
    if (cachedEl && cachedEl.isConnected) {
      const rect = cachedEl.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        targetElementRef.current = cachedEl;

        const appContainer = document.getElementById('root');
        const containerRect = appContainer ? appContainer.getBoundingClientRect() : null;
        const containerLeft = containerRect ? containerRect.left : 0;
        const containerTop = containerRect ? containerRect.top : 0;

        const spotlightRect = {
          top: rect.top - containerTop - 10,
          left: rect.left - containerLeft - 10,
          width: rect.width + 20,
          height: rect.height + 20
        };

        window.requestAnimationFrame(() => {
          setHighlightPositionStable(spotlightRect);
          const chatPos = calculateChatPosition(rect);
          setChatPositionStable(chatPos);
        });

        // 確保目標元素可互動
        cachedEl.classList.add('tutorial-target');
        cachedEl.style.position = 'relative';
        cachedEl.style.zIndex = '10010';
        cachedEl.style.pointerEvents = 'auto';
        cachedEl.style.userSelect = 'auto';
        cachedEl.style.touchAction = 'auto';
        // 啟用互動邏輯與條件監聽（避免快取路徑漏掉監聽）
        setupTargetInteraction(cachedEl);
        return;
      }
    }

    // 延遲查找，確保頁面已經載入（根據步驟調整較短延遲）
    const delay = stepData?.expectedPath ? 300 : 120;
    setTimeout(() => {
      // 清理舊的目標元素
      if (targetElementRef.current) {
        console.log('清理舊的目標元素:', targetElementRef.current);
        targetElementRef.current.classList.remove('tutorial-target');
        targetElementRef.current.style.position = '';
        targetElementRef.current.style.zIndex = '';
        targetElementRef.current.style.pointerEvents = '';
        targetElementRef.current.style.userSelect = '';
        targetElementRef.current.style.touchAction = '';
        targetElementRef.current = null;
      }

      // 使用多種方式查找元素
      let targetElement = null;

      // 優先使用 selector（使用自定義函數處理 :contains() 語法）
      if (selector) {
        console.log('嘗試 selector:', selector);
        targetElement = findElementWithSelector(selector);
        console.log('selector 結果:', targetElement);
      }

      // 如果還是找不到，嘗試通過 className 查找（CSS Modules 會產生唯一的類名）
      if (!targetElement && className) {
        console.log('嘗試 className:', className);
        // 查找包含該類名的元素（適用於 CSS Modules）
        const elements = document.querySelectorAll(`[class*="${className}"]`);
        console.log('className 查找結果:', elements);
        targetElement = elements[0];
      }

      // 最後嘗試直接使用 className
      if (!targetElement && className) {
        console.log('嘗試直接 className:', className);
        targetElement = document.getElementsByClassName(className)[0];
        console.log('直接 className 結果:', targetElement);
      }

      // 如果還是找不到，嘗試其他選擇器
      if (!targetElement && stepData.targetElement.fallbackSelector) {
        console.log('嘗試 fallbackSelector:', stepData.targetElement.fallbackSelector);
        targetElement = findElementWithSelector(stepData.targetElement.fallbackSelector);
        console.log('fallbackSelector 結果:', targetElement);
      }

      // 最後嘗試：根據步驟ID進行智能查找
      if (!targetElement && stepData.id === 2) {
        console.log('步驟 2 最後嘗試：查找任何可見的選單項目');
        const allButtons = document.querySelectorAll('button, div[role="button"], [onclick]');
        // 查找包含「日常」或「記錄」的元素
        for (const btn of allButtons) {
          if (btn.textContent && (btn.textContent.includes('日常') || btn.textContent.includes('記錄'))) {
            targetElement = btn;
            console.log('找到包含「日常記錄」的元素:', targetElement);
            break;
          }
        }

        // 如果還是找不到，取第一個可見的按鈕
        if (!targetElement) {
          const visibleButtons = Array.from(allButtons).filter(btn => {
            const rect = btn.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0 && rect.top >= 0;
          });
          targetElement = visibleButtons[0];
          console.log('使用第一個可見按鈕:', targetElement);
        }
      }

      // 步驟 3：查找新增圖片相關元素
      if (!targetElement && stepData.id === 3) {
        console.log('步驟 3 最後嘗試：查找新增圖片相關元素');
        const allElements = document.querySelectorAll('button, input, div[role="button"], [onclick]');

        // 查找包含「新增」、「上傳」、「圖片」、「照片」的元素
        for (const elem of allElements) {
          const text = elem.textContent || elem.alt || elem.title || '';
          if (text && (text.includes('新增') || text.includes('上傳') || text.includes('圖片') || text.includes('照片') || text.includes('添加'))) {
            targetElement = elem;
            console.log('找到包含圖片相關文字的元素:', targetElement);
            break;
          }
        }

        // 查找文件輸入元素
        if (!targetElement) {
          targetElement = document.querySelector('input[type="file"]');
          console.log('找到文件輸入元素:', targetElement);
        }

        // 如果還是找不到，取第一個可見的按鈕
        if (!targetElement) {
          const visibleButtons = Array.from(allElements).filter(elem => {
            const rect = elem.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0 && rect.top >= 0;
          });
          targetElement = visibleButtons[0];
          console.log('使用第一個可見元素:', targetElement);
        }
      }

      if (targetElement) {
        targetElementRef.current = targetElement;
        elementCacheRef.current[stepData.id] = targetElement;
        const rect = targetElement.getBoundingClientRect();

        // 設置 spotlight 位置（相對於容器）
        const appContainer = document.getElementById('root');
        const containerRect = appContainer ? appContainer.getBoundingClientRect() : null;
        const containerLeft = containerRect ? containerRect.left : 0;
        const containerTop = containerRect ? containerRect.top : 0;

        const spotlightRect = {
          top: rect.top - containerTop - 10,
          left: rect.left - containerLeft - 10,
          width: rect.width + 20,
          height: rect.height + 20
        };
        window.requestAnimationFrame(() => {
          setHighlightPositionStable(spotlightRect);
          // 計算聊天泡泡位置（根據目標元素位置）
          const chatPos = calculateChatPosition(rect);
          setChatPositionStable(chatPos);
        });

        // 為目標元素添加特殊類，確保它可以被點擊
        targetElement.classList.add('tutorial-target');
        targetElement.style.position = 'relative';
        targetElement.style.zIndex = '10010';
        targetElement.style.pointerEvents = 'auto';
        targetElement.style.userSelect = 'auto';
        targetElement.style.touchAction = 'auto';


        // 設定互動/監聽並返回清理函式
        return setupTargetInteraction(targetElement);
      } else {
        console.warn(`找不到教學目標元素: ${className || selector}`);
        setHighlightPositionStable(null);
        // 目標元素不存在時，聊天泡泡使用預設位置
        const chatPos = calculateChatPosition(null);
        setChatPositionStable(chatPos);
      }
    }, delay);
  }, [stepData, calculateChatPosition, currentStep]);

  // 預先快取下一步的目標元素，降低下一步切換的搜尋時間
  useEffect(() => {
    if (!tutorial || !stepData) return;
    const nextStep = tutorialUtils.getNextStep(tutorialType, stepData.id);
    if (!nextStep || !nextStep.targetElement) return;

    const { className, selector } = nextStep.targetElement;
    // 使用 rAF 推遲到瀏覽器空閒時嘗試快取
    const rafId = window.requestAnimationFrame(() => {
      let el = null;
      if (selector) {
        try { el = findElementWithSelector(selector); } catch (_) {}
      }
      if (!el && className) {
        const elements = document.querySelectorAll(`[class*="${className}"]`);
        el = elements && elements[0];
      }
      if (el) {
        elementCacheRef.current[nextStep.id] = el;
      }
    });
    return () => cancelAnimationFrame(rafId);
  }, [tutorial, tutorialType, stepData]);

  // 監測頁面變化和步驟變化
  useEffect(() => {
    console.log('頁面變化監測:', {
      stepId: stepData?.id,
      expectedPath: stepData?.expectedPath,
      currentPath: location.pathname,
      pathMatch: stepData?.expectedPath === location.pathname,
      nextCondition: stepData?.nextCondition
    });

    if (stepData) {
      // 對於步驟 2，目標元素在當前頁面的選單中，不需要等待導航
      if (stepData.id === 2 && stepData.targetElement?.component === 'PostMenu') {
        console.log('步驟 2：在當前頁面查找選單元素');
        const cleanup = findAndHighlightElement();
        return cleanup;
      }
      // 如果需要導航到特定頁面但當前路徑不符
      else if (stepData.expectedPath && location.pathname !== stepData.expectedPath) {
        console.log('需要導航，等待路徑變化...');
        // 在等待導航期間，隱藏 spotlight 並將聊天泡泡置中，避免高光亂跑
        if (cleanupRef.current) {
          cleanupRef.current();
          cleanupRef.current = null;
        }
        targetElementRef.current = null;
        setHighlightPositionStable(null);
        const chatPos = calculateChatPosition(null);
        setChatPositionStable(chatPos);
        // 等待用戶操作導航
        return;
      } else {
        // 路徑正確或不需要特定路徑，找到並高亮元素
        console.log('路徑正確，查找目標元素');
        const cleanup = findAndHighlightElement();
        return cleanup;
      }
    }
  }, [stepData, location.pathname, findAndHighlightElement]);

  // 獨立處理 pageNavigate 條件 - 防止重複觸發
  const pageNavigateProcessedRef = useRef(new Set());

  useEffect(() => {
    console.log('PageNavigate useEffect 觸發:', {
      stepData: stepData?.id,
      nextCondition: stepData?.nextCondition,
      expectedPath: stepData?.expectedPath,
      currentPath: location.pathname,
      pathMatch: location.pathname === stepData?.expectedPath,
      currentStep,
      isTransitioning
    });

    // 只有步驟2需要處理 pageNavigate 到 /create-post
    if (stepData &&
        stepData.nextCondition === 'pageNavigate' &&
        stepData.expectedPath &&
        location.pathname === stepData.expectedPath &&
        stepData.id === currentStep &&
        stepData.id === 2) {  // 明確只處理步驟2的 pageNavigate

      // 檢查是否已經處理過這個導航
      const processKey = `${stepData.id}-${location.pathname}`;
      if (pageNavigateProcessedRef.current.has(processKey)) {
        console.log('PageNavigate 已處理過，跳過:', processKey);
        return;
      }

      console.log('PageNavigate 條件滿足，進入下一步');
      pageNavigateProcessedRef.current.add(processKey);

      // 增加延遲確保頁面完全載入
      setTimeout(() => {
        // 再次檢查條件，確保沒有狀態變化且仍是當前步驟
        if (stepData?.nextCondition === 'pageNavigate' &&
            location.pathname === stepData?.expectedPath &&
            stepData?.id === currentStep &&
            stepData?.id === 2 &&  // 確保仍是步驟2
            !isTransitioning) {  // 確保不在轉換中
          const nextStep = tutorialUtils.getNextStep(tutorialType, currentStep);
          if (nextStep && nextStep.id > currentStep) {  // 確保是前進，不是回退
            console.log('PageNavigate: 切換到下一步:', nextStep.id);
            setStepData(nextStep);
            setCurrentStep(nextStep.id);
            tutorialUtils.saveTutorialProgress(tutorialType, nextStep.id, 'in_progress');
          }
        } else {
          console.log('PageNavigate: 二次檢查條件不滿足');
        }
      }, 500);
    }
  }, [stepData, location.pathname, tutorialType, currentStep]);

  // 處理完成
  const handleComplete = useCallback(() => {
    tutorialUtils.markTutorialComplete(tutorialType);
    tutorialUtils.clearTutorialProgress(tutorialType);
    onComplete && onComplete();
  }, [tutorialType, onComplete]);

  // 處理下一步
  const handleNextStep = useCallback(() => {
    console.log('handleNextStep 被調用:', {
      tutorial: !!tutorial,
      isTransitioning,
      currentStep,
      tutorialType
    });

    if (!tutorial || isTransitioning) {
      console.log('handleNextStep 提早返回:', { tutorial: !!tutorial, isTransitioning });
      return;
    }

    setIsTransitioning(true);

    const nextStep = tutorialUtils.getNextStep(tutorialType, currentStep);
    console.log('下一步驟:', nextStep, '當前步驟:', currentStep);

    if (nextStep && nextStep.id > currentStep) {  // 確保是前進，不是回退
      const isNextLastStep = tutorialUtils.isLastStep(tutorialType, nextStep.id);
      // 執行步驟動作
      if (stepData && stepData.action === 'click' && stepData.expectedPath) {
        // 如果需要導航，讓導航先發生
        setTimeout(() => {
          setStepData(nextStep);
          setCurrentStep(nextStep.id);
          // 若為最後一步，避免將第 10 步同步到 localStorage，改為維持上一階段狀態
          if (isNextLastStep) {
            tutorialUtils.saveTutorialProgress(tutorialType, currentStep, 'awaiting_confirm');
          } else {
            tutorialUtils.saveTutorialProgress(tutorialType, nextStep.id, 'in_progress');
          }
          setIsTransitioning(false);
        }, 100);
      } else {
        setStepData(nextStep);
        setCurrentStep(nextStep.id);
        // 若為最後一步，避免將第 10 步同步到 localStorage，改為維持上一階段狀態
        if (isNextLastStep) {
          tutorialUtils.saveTutorialProgress(tutorialType, currentStep, 'awaiting_confirm');
        } else {
          tutorialUtils.saveTutorialProgress(tutorialType, nextStep.id, 'in_progress');
        }
        setIsTransitioning(false);
      }
    } else {
      // 到達最後一步，保持 overlay 顯示，等待用戶主動關閉
      console.log('到達教學最後一步，等待用戶關閉');
      setIsTransitioning(false);
    }
  }, [tutorial, tutorialType, currentStep, stepData, isTransitioning, handleComplete]);

  // 條件監聽
  const startConditionMonitoring = useCallback((condition) => {
    console.log('開始監聽條件:', condition, '當前步驟:', currentStep);

    // 防止在轉換期間啟動新的監聽
    if (isTransitioning) {
      console.log('跳過條件監聽：正在轉換中');
      return;
    }

    // 清理之前的監聽器
    if (currentObserverRef.current) {
      console.log('清理之前的 MutationObserver');
      currentObserverRef.current.disconnect();
      currentObserverRef.current = null;
    }

    // 清理之前的超時器
    if (currentTimeoutRef.current) {
      console.log('清理之前的超時器');
      clearTimeout(currentTimeoutRef.current);
      currentTimeoutRef.current = null;
    }

    // 清理之前的條件監聽器
    if (conditionCleanupRef.current) {
      conditionCleanupRef.current();
    }

    // 跳過由其他機制處理的條件
    if (condition === 'pageNavigate') {
      console.log('pageNavigate 條件由 useEffect 處理，跳過 MutationObserver');
      return;
    }

    // 使用 MutationObserver 監聽 DOM 變化
    const observer = new MutationObserver((mutations) => {
      let conditionMet = false;

      switch (condition) {
        case 'menuOpen':
          // 檢查是否有選單元素出現
          const menuElements = document.querySelectorAll('[class*="menu"], [class*="popup"], [class*="modal"]');
          conditionMet = menuElements.length > 0;
          break;
        case 'pageNavigate':
          // 這個條件通過路由變化處理，在這裡不需要特別檢查
          conditionMet = false;
          break;
        case 'imageAdded':
          // 檢查是否有圖片預覽元素出現
          const imagePreviewElements = document.querySelectorAll('[class*="imagePreview"], [class*="clickableImage"], img[src*="blob:"]');
          console.log('imageAdded 條件檢查:', {
            imagePreviewCount: imagePreviewElements.length,
            foundElements: Array.from(imagePreviewElements).map(el => ({
              tagName: el.tagName,
              className: el.className,
              src: el.src || 'no src'
            }))
          });

          // 如果沒找到，嘗試更廣泛的搜索
          if (imagePreviewElements.length === 0) {
            const allImages = document.querySelectorAll('img');
            const fileInputs = document.querySelectorAll('input[type="file"]');
            console.log('imageAdded 備用檢查:', {
              allImagesCount: allImages.length,
              fileInputsCount: fileInputs.length,
              recentImages: Array.from(allImages).slice(-3).map(img => ({
                src: img.src,
                className: img.className
              }))
            });
          }

          // 多種方式檢查圖片是否已添加
          let hasImages = imagePreviewElements.length > 0;

          // 備用檢查：尋找圖片容器
          if (!hasImages) {
            const imageContainers = document.querySelectorAll('[class*="imagePreviewContainer"], [class*="imageContainer"]');
            hasImages = Array.from(imageContainers).some(container => {
              const imagesInContainer = container.querySelectorAll('img');
              return imagesInContainer.length > 0;
            });
            console.log('imageAdded 容器檢查:', hasImages);
          }

          // 最終備用檢查：檢查是否有新的圖片元素（非默認圖標）
          if (!hasImages) {
            const allImages = document.querySelectorAll('img');
            hasImages = Array.from(allImages).some(img => {
              const src = img.src || '';
              const isUserImage = src.includes('blob:') ||
                                 src.includes('data:image') ||
                                 (!src.includes('/assets/') && !src.includes('/icon/') && src.length > 0);
              return isUserImage;
            });
            console.log('imageAdded 最終檢查:', hasImages);
          }

          conditionMet = hasImages;
          break;
        case 'editorOpen':
          // 檢查是否有圖片編輯器打開
          const editorElements = document.querySelectorAll('[class*="imageEditor"], [class*="editor"], [class*="modal"][class*="open"], [class*="editImage"], [class*="modalOverlay"], [class*="modalContainer"]');
          console.log('editorOpen 條件檢查:', {
            editorElementsCount: editorElements.length,
            foundElements: Array.from(editorElements).map(el => ({
              tagName: el.tagName,
              className: el.className
            }))
          });
          conditionMet = editorElements.length > 0;
          break;
        case 'annotationModeOn':
          // 檢查是否標註模式已啟用
          const annotationModeElements = document.querySelectorAll('[class*="annotation"][class*="active"], [class*="toolButton"][class*="active"], button[class*="selected"]');
          conditionMet = annotationModeElements.length > 0;
          break;
        case 'annotationPointAdded':
          // 檢查是否已添加標註點（包括新建的和編輯面板的出現）
          const annotationPointElements = document.querySelectorAll('[class*="annotationPoint"], [class*="annotationDot"], [class*="newDot"], [class*="editPanel"]');
          console.log('annotationPointAdded 條件檢查:', {
            annotationPointCount: annotationPointElements.length,
            foundElements: Array.from(annotationPointElements).map(el => ({
              tagName: el.tagName,
              className: el.className
            }))
          });

          // 也檢查 newAnnotation 或 editingAnnotation 狀態
          const hasEditPanel = document.querySelectorAll('[class*="editPanel"]').length > 0;
          const hasAnnotationDot = document.querySelectorAll('[class*="annotationDot"]').length > 0;

          conditionMet = annotationPointElements.length > 0 || hasEditPanel || hasAnnotationDot;
          break;
        case 'typeSelected':
          // 檢查是否已選擇標註類型
          const selectedTypeElements = document.querySelectorAll('select[value="pet"], option[value="pet"]:checked, [class*="typeSelect"] [class*="selected"]');
          conditionMet = selectedTypeElements.length > 0;
          break;
        case 'petSelected':
          // 檢查是否已選擇寵物 - 增強檢測邏輯
          console.log('開始檢查 petSelected 條件');

          let petSelected = false;

          // 1. 直接檢查 editPanel 內的寵物選擇器
          const editPanelSelects = document.querySelectorAll('[class*="editPanel"] select[class*="searchInput"]');
          console.log('發現 editPanel 內的寵物選擇器:', editPanelSelects.length);

          Array.from(editPanelSelects).forEach((select, index) => {
            // 取得父元素來判斷是否為寵物類型選擇器
            const parentDiv = select.closest('[class*="inputGroup"]');
            const typeSelect = document.querySelector('[class*="editPanel"] select[class*="typeSelect"]');
            const isCurrentlyPetType = typeSelect?.value === 'pet';

            console.log(`檢查選擇器 ${index + 1}:`, {
              tagName: select.tagName,
              className: select.className,
              value: select.value,
              selectedIndex: select.selectedIndex,
              isCurrentlyPetType,
              typeSelectValue: typeSelect?.value,
              isVisible: select.offsetParent !== null,
              optionCount: select.options?.length,
              selectedText: select.options?.[select.selectedIndex]?.text || 'None'
            });

            // 只有在類型選擇為"pet"且選擇器可見時才檢查寵物選擇
            if (isCurrentlyPetType && select.offsetParent !== null) {
              const hasValidValue = select.value &&
                                  select.value !== '' &&
                                  select.value !== 'undefined' &&
                                  select.selectedIndex > 0;

              console.log('寵物選擇檢查結果:', {
                hasValue: !!select.value,
                valueNotEmpty: select.value !== '',
                selectedIndexValid: select.selectedIndex > 0,
                finalResult: hasValidValue
              });

              if (hasValidValue) {
                console.log('✅ 發現有效的寵物選擇:', {
                  value: select.value,
                  selectedText: select.options[select.selectedIndex]?.text,
                  index: select.selectedIndex
                });
                petSelected = true;
              }
            }
          });

          // 2. 備用檢查：所有包含數字值的 select（可能是 pet_id）
          if (!petSelected) {
            console.log('執行備用檢查：尋找任何有數字值的選擇器');
            const allEditorSelects = document.querySelectorAll('[class*="modalContainer"] select, [class*="editPanel"] select');

            Array.from(allEditorSelects).forEach(select => {
              // 檢查是否選擇了數字值（pet_id 通常是數字）
              const valueIsNumber = !isNaN(parseInt(select.value)) && select.value !== '';
              const hasOptions = select.options && select.options.length > 1;
              const notFirstOption = select.selectedIndex > 0;

              if (valueIsNumber && hasOptions && notFirstOption) {
                console.log('✅ 備用檢查發現寵物選擇:', {
                  value: select.value,
                  className: select.className,
                  selectedText: select.options[select.selectedIndex]?.text
                });
                petSelected = true;
              }
            });
          }

          conditionMet = petSelected;
          break;
        case 'annotationAdded':
          // 檢查是否標註已添加完成（編輯面板消失且有標註點存在）
          const editPanels = document.querySelectorAll('[class*="editPanel"]');
          const existingAnnotations = document.querySelectorAll('[class*="annotationPoint"], [class*="annotationDot"]');
          console.log('annotationAdded 條件檢查:', {
            editPanelsCount: editPanels.length,
            existingAnnotationsCount: existingAnnotations.length,
            editPanelsHidden: editPanels.length === 0,
            hasAnnotations: existingAnnotations.length > 0
          });

          // 當編輯面板消失且存在標註點時，表示標註已成功添加
          conditionMet = editPanels.length === 0 && existingAnnotations.length > 0;

          // 如果檢測失敗，嘗試其他方式檢測
          if (!conditionMet) {
            // 檢查 annotations 數組是否有新增項目（通過檢查 ImageEditor 狀態）
            const allAnnotationElements = document.querySelectorAll('[class*="annotation"]');
            console.log('備用檢查 - 所有標註元素:', allAnnotationElements.length);

            // 如果沒有編輯面板但有標註相關元素，可能標註已完成
            if (editPanels.length === 0 && allAnnotationElements.length > 0) {
              console.log('✅ 備用檢查發現標註完成');
              conditionMet = true;
            }
          }
          break;
        case 'editorClosed':
          // 檢查編輯器是否已關閉（通過檢查編輯器元素不存在）
          const modalOverlays = document.querySelectorAll('[class*="modalOverlay"]');
          const modalContainers = document.querySelectorAll('[class*="modalContainer"]');
          const imageEditors = document.querySelectorAll('[class*="imageEditor"]');
          const openEditorElements = document.querySelectorAll('[class*="editor"][class*="open"], [class*="modal"][class*="open"]');

          console.log('editorClosed 條件檢查:', {
            modalOverlaysCount: modalOverlays.length,
            modalContainersCount: modalContainers.length,
            imageEditorsCount: imageEditors.length,
            openEditorElementsCount: openEditorElements.length
          });

          // 檢查各種可能的編輯器容器
          conditionMet = modalOverlays.length === 0 &&
                        modalContainers.length === 0 &&
                        imageEditors.length === 0 &&
                        openEditorElements.length === 0;

          // 備用檢查：如果主要檢測失敗，檢查是否回到了 CreatePostPage
          if (!conditionMet) {
            const currentPath = window.location.pathname;
            const isBackToCreatePost = currentPath === '/create-post';
            console.log('備用檢查 - 是否回到創建貼文頁面:', isBackToCreatePost);

            if (isBackToCreatePost && modalOverlays.length === 0) {
              console.log('✅ 備用檢查發現編輯器已關閉');
              conditionMet = true;
            }
          }
          break;
        default:
          console.warn('未知的條件:', condition);
          break;
      }

      if (conditionMet) {
        console.log('條件已滿足:', condition);
        observer.disconnect();
        currentObserverRef.current = null;
        // 清理超時器
        if (currentTimeoutRef.current) {
          clearTimeout(currentTimeoutRef.current);
          currentTimeoutRef.current = null;
        }
        // 延遲一下確保 UI 完全載入
        setTimeout(() => {
          handleNextStep();
        }, 300);
      }
    });

    // 保存當前觀察器的引用
    currentObserverRef.current = observer;

    // 開始觀察整個文檔的變化
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style']
    });

    // 對於部分條件，添加定期檢查，避免漏檢
    let intervalId = null;
    if (condition === 'petSelected' || condition === 'typeSelected' || condition === 'annotationPointAdded') {
      console.log(`為 ${condition} 條件設置定期檢查`);
      intervalId = setInterval(() => {
        console.log(`定期檢查 ${condition} 條件`);

        // 重複執行條件檢查邏輯
        let conditionMet = false;
        if (condition === 'petSelected') {
          const editPanelSelects = document.querySelectorAll('[class*="editPanel"] select[class*="searchInput"]');
          Array.from(editPanelSelects).forEach(select => {
            const typeSelect = document.querySelector('[class*="editPanel"] select[class*="typeSelect"]');
            const isCurrentlyPetType = typeSelect?.value === 'pet';

            if (isCurrentlyPetType && select.offsetParent !== null) {
              const hasValidValue = select.value &&
                                  select.value !== '' &&
                                  select.selectedIndex > 0;
              if (hasValidValue) {
                console.log('✅ 定期檢查發現寵物選擇:', select.value);
                conditionMet = true;
              }
            }
          });
        } else if (condition === 'annotationPointAdded') {
          const annotationPointElements = document.querySelectorAll('[class*="annotationPoint"], [class*="annotationDot"], [class*="newDot"], [class*="editPanel"]');
          const hasEditPanel = document.querySelectorAll('[class*="editPanel"]').length > 0;
          const hasAnnotationDot = document.querySelectorAll('[class*="annotationDot"]').length > 0;
          conditionMet = annotationPointElements.length > 0 || hasEditPanel || hasAnnotationDot;
          if (conditionMet) {
            console.log('✅ 定期檢查發現 annotationPointAdded 條件滿足');
          }
        }

        if (conditionMet) {
          console.log(`定期檢查發現 ${condition} 條件滿足`);
          clearInterval(intervalId);
          if (currentObserverRef.current) {
            currentObserverRef.current.disconnect();
            currentObserverRef.current = null;
          }
          if (currentTimeoutRef.current) {
            clearTimeout(currentTimeoutRef.current);
            currentTimeoutRef.current = null;
          }
          setTimeout(() => {
            handleNextStep();
          }, 300);
        }
      }, 600); // 每 600ms 檢查一次
    }

    // 設置超時，避免無限等待
    const timeoutMs = (
      condition === 'annotationPointAdded' ? 25000 :
      condition === 'imageAdded' ? 20000 :
      condition === 'editorOpen' ? 20000 :
      condition === 'editorClosed' ? 20000 :
      12000
    );
    currentTimeoutRef.current = setTimeout(() => {
      if (intervalId) {
        clearInterval(intervalId);
      }
      if (currentObserverRef.current) {
        currentObserverRef.current.disconnect();
        currentObserverRef.current = null;
      }
      currentTimeoutRef.current = null;
      console.warn('條件監聽超時:', condition);
    }, timeoutMs); // 依條件調整超時時間

    // 保存清理函數
    conditionCleanupRef.current = () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
      if (currentObserverRef.current) {
        currentObserverRef.current.disconnect();
        currentObserverRef.current = null;
      }
      if (currentTimeoutRef.current) {
        clearTimeout(currentTimeoutRef.current);
        currentTimeoutRef.current = null;
      }
    };
  }, [handleNextStep]);

  // 處理上一步
  // 已移除 handlePreviousStep 函數，因為不再需要上一步功能
  // const handlePreviousStep = () => {
  //   if (!tutorial || currentStep === 1) return;
  //   const previousStep = tutorialUtils.getPreviousStep(tutorialType, currentStep);
  //   if (previousStep) {
  //     setStepData(previousStep);
  //     setCurrentStep(previousStep.id);
  //     tutorialUtils.saveTutorialProgress(tutorialType, previousStep.id, 'in_progress');
  //   }
  // };

  // 處理跳過
  const handleSkip = () => {
    if (tutorial && tutorial.options.allowSkip) {
      tutorialUtils.saveTutorialProgress(tutorialType, currentStep, 'skipped');
      onSkip && onSkip();
    }
  };

  // 計算進度
  const progress = tutorial ? tutorialUtils.getProgress(tutorialType, currentStep) : 0;

  // 清理效果 - 當組件卸載或教學結束時
  useEffect(() => {
    return () => {
      // 清理所有事件監聽器
      if (cleanupRef.current) {
        cleanupRef.current();
      }
      // 清理條件監聽器
      if (conditionCleanupRef.current) {
        conditionCleanupRef.current();
      }
      // 重置處理記錄
      pageNavigateProcessedRef.current.clear();
    };
  }, []);

  // 當教學結束或步驟重置時清理
  useEffect(() => {
    if (!tutorial) {
      pageNavigateProcessedRef.current.clear();
    }
  }, [tutorial]);

  // 全域攔截：阻擋與非目標元素的互動（使用捕獲階段）
  useEffect(() => {
    if (!tutorial) return;

    const hasClassKeyword = (el, keywords) => {
      try {
        const className = (el.className || '').toString();
        return keywords.some(k => className.includes(k));
      } catch (e) {
        return false;
      }
    };

    const textIncludes = (el, keywords) => {
      try {
        const text = (el.textContent || '').toString();
        return keywords.some(k => text.includes(k));
      } catch (e) {
        return false;
      }
    };

    const isUploadRelated = (node) => {
      if (!node || !(node instanceof Element)) return false;

      // 直接命中：檔案輸入
      if (node.tagName === 'INPUT' && node.type === 'file') return true;

      // label[for] 指向檔案輸入
      if (node.tagName === 'LABEL' && node.getAttribute('for')) {
        const forId = node.getAttribute('for');
        const input = document.getElementById(forId);
        if (input && input.tagName === 'INPUT' && input.type === 'file') return true;
      }

      // 類名或文字關鍵字
      const classKeywords = ['upload', 'addImage', 'image', 'photo', 'clickableImage', 'editImage'];
      const textKeywords = ['新增', '上傳', '圖片', '照片', '添加'];
      if (hasClassKeyword(node, classKeywords) || textIncludes(node, textKeywords)) return true;

      // 向上追溯父層尋找可上傳的線索
      let current = node.parentElement;
      while (current) {
        if (current.tagName === 'INPUT' && current.type === 'file') return true;
        if (hasClassKeyword(current, classKeywords) || textIncludes(current, textKeywords)) return true;
        if (current.tagName === 'LABEL' && current.getAttribute('for')) {
          const forIdParent = current.getAttribute('for');
          const inputParent = document.getElementById(forIdParent);
          if (inputParent && inputParent.tagName === 'INPUT' && inputParent.type === 'file') return true;
        }
        current = current.parentElement;
      }
      return false;
    };

    const isAllowedTarget = (node) => {
      const targetEl = targetElementRef.current;
      const chatEl = chatBubbleRef.current;
      if ((targetEl && (node === targetEl || targetEl.contains(node))) ||
          (chatEl && chatEl.contains(node))) {
        return true;
      }

      // 第 3 步：允許與上傳/新增圖片相關的互動
      if (stepData?.id === 3) {
        if (isUploadRelated(node)) return true;
      }
      return false;
    };

    const stopIfBackground = (e) => {
      if (isAllowedTarget(e.target)) return;
      e.preventDefault();
      e.stopPropagation();
      if (typeof e.stopImmediatePropagation === 'function') {
        e.stopImmediatePropagation();
      }
      console.log('教學模式：已攔截背景互動事件', { type: e.type, target: e.target });
    };

    const events = ['pointerdown', 'pointerup', 'click', 'mousedown', 'mouseup', 'touchstart', 'touchend', 'contextmenu', 'keydown', 'keyup'];
    events.forEach(evt => document.addEventListener(evt, stopIfBackground, true));

    // 焦點陷阱：避免 Tab/焦點落到非允許區域
    const handleFocus = (e) => {
      if (!isAllowedTarget(e.target)) {
        e.preventDefault();
        e.stopPropagation();
        if (chatBubbleRef.current && typeof chatBubbleRef.current.focus === 'function') {
          chatBubbleRef.current.focus();
        } else if (targetElementRef.current && typeof targetElementRef.current.focus === 'function') {
          targetElementRef.current.focus();
        }
      }
    };
    document.addEventListener('focus', handleFocus, true);

    return () => {
      events.forEach(evt => document.removeEventListener(evt, stopIfBackground, true));
      document.removeEventListener('focus', handleFocus, true);
    };
  }, [tutorial, stepData]);

  // 防止頁面滾動和背景交互
  useEffect(() => {
    if (tutorial) {
      // 保存原始的 overflow 和 touch-action 設置
      const originalOverflow = document.body.style.overflow;
      const originalTouchAction = document.body.style.touchAction;
      const originalUserSelect = document.body.style.userSelect;

      // 阻止頁面滾動和觸摸交互
      document.body.style.overflow = 'hidden';
      document.body.style.touchAction = 'none';
      document.body.style.userSelect = 'none';

      console.log('教學模式：已阻止頁面滾動和背景交互');

      // 清理函數：恢復原始設置
      return () => {
        document.body.style.overflow = originalOverflow;
        document.body.style.touchAction = originalTouchAction;
        document.body.style.userSelect = originalUserSelect;
        console.log('教學模式結束：已恢復頁面滾動和交互');
      };
    }
  }, [tutorial]);

  if (!tutorial || !stepData) {
    return null;
  }

  // 處理背景點擊 - 阻止與非目標元素的交互
  const handleBackgroundClick = (e) => {
    // 檢查點擊的是否為目標元素或其子元素
    const targetElement = targetElementRef.current;
    const clickedElement = e.target;

    // 如果點擊的是目標元素或聊天泡泡，允許事件通過
    if (targetElement && (targetElement === clickedElement || targetElement.contains(clickedElement))) {
      console.log('教學模式：允許目標元素點擊');
      return; // 不阻止事件
    }

    // 檢查是否點擊了聊天泡泡區域
    if (chatBubbleRef.current && chatBubbleRef.current.contains(clickedElement)) {
      console.log('教學模式：允許聊天泡泡點擊');
      return; // 不阻止事件
    }

    // 否則阻止事件
    e.preventDefault();
    e.stopPropagation();
    console.log('教學模式：阻止背景點擊');
  };

  // 處理背景滾動 - 阻止滾動事件
  const handleBackgroundScroll = (e) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('教學模式：阻止背景滾動');
  };

  return (
    <div
      className={styles.tutorialOverlay}
      ref={overlayRef}
      onMouseDownCapture={handleBackgroundClick}
      onClickCapture={handleBackgroundClick}
      onPointerDownCapture={handleBackgroundClick}
      onTouchStartCapture={handleBackgroundClick}
      onScrollCapture={handleBackgroundScroll}
      onWheelCapture={handleBackgroundScroll}
    >
      {/* 暗背景區塊 - 分為四個區域來突出目標元素 */}
      {highlightPosition && (
        <>
          {/* 上方暗背景 */}
          <div
            className={styles.darkBackground}
            style={{
              top: 0,
              left: 0,
              right: 0,
              height: `${highlightPosition.top}px`
            }}
          />
          {/* 左方暗背景 */}
          <div
            className={styles.darkBackground}
            style={{
              top: `${highlightPosition.top}px`,
              left: 0,
              width: `${highlightPosition.left}px`,
              height: `${highlightPosition.height}px`
            }}
          />
          {/* 右方暗背景 */}
          <div
            className={styles.darkBackground}
            style={{
              top: `${highlightPosition.top}px`,
              left: `${highlightPosition.left + highlightPosition.width}px`,
              right: 0,
              height: `${highlightPosition.height}px`
            }}
          />
          {/* 下方暗背景 */}
          <div
            className={styles.darkBackground}
            style={{
              top: `${highlightPosition.top + highlightPosition.height}px`,
              left: 0,
              right: 0,
              bottom: 0
            }}
          />
        </>
      )}


      {/* 聊天式教學內容 */}
      {chatPosition && (
        <div
          className={styles.chatBubbleContainer}
          ref={chatBubbleRef}
          data-placement={chatPosition.placement}
          tabIndex={-1}
          style={{
            top: `${chatPosition.top}px`,
            left: `${chatPosition.left}px`,
            width: `${chatPosition.width}px`
          }}
        >
          {/* AI 頭像和訊息泡泡 */}
          <div className={styles.aiMessageWrapper}>
            <img
              src="/assets/icon/PeterAiChatIcon.png"
              alt="Peter AI"
              className={styles.aiAvatar}
            />
            <div className={styles.aiMessageContent}>
              <div className={styles.aiMessageBubble}>
                <div className={styles.stepTitle}>
                  {stepData.title}
                </div>
                <div className={styles.stepInstruction}>
                  {stepData.instruction}
                </div>

                {/* 進度指示器 */}
                {tutorial.options.showProgress && (
                  <div className={styles.progressIndicator}>
                    <div className={styles.progressDots}>
                      {Array.from({ length: tutorial.steps.length }, (_, index) => (
                        <div
                          key={index}
                          className={`${styles.progressDot} ${
                            index < currentStep ? styles.completed :
                            index === currentStep - 1 ? styles.current : ''
                          }`}
                        />
                      ))}
                    </div>
                    <div className={styles.stepCounter}>
                      {currentStep} / {tutorial.steps.length}
                    </div>
                  </div>
                )}
              </div>

              {/* 控制按鈕 */}
              <div className={styles.chatControls}>
                {/* 關閉教學按鈕 */}
                <button
                  className={styles.closeButton}
                  onClick={stepData.action === 'complete' ? handleComplete : handleSkip}
                  title={stepData.action === 'complete' ? "完成教學" : "關閉教學"}
                >
                  {stepData.action === 'complete' ? '✓ 完成教學' : '✕ 關閉教學'}
                </button>

              </div>
            </div>
          </div>

        </div>
      )}


      {/* 完成動畫 */}
      {stepData.showConfetti && (
        <div className={styles.confetti}>
          🎉 🎊 🎉
        </div>
      )}
    </div>
  );
};

export default TutorialOverlay;