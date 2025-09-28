import React, { useState, useEffect, useRef } from 'react';
import styles from '../styles/FloatingAIAvatar.module.css';

const FloatingAIAvatar = ({
  isVisible,
  onAvatarClick,
  onDismiss
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isLongPress, setIsLongPress] = useState(false);
  const [showDismissZone, setShowDismissZone] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const avatarRef = useRef(null);
  const longPressTimer = useRef(null);
  const initialPosition = useRef({ x: 0, y: 0 });

  // 計算頭像位置的函數
  const calculatePosition = () => {
    const rootElement = document.getElementById('root');
    if (rootElement) {
      const rootRect = rootElement.getBoundingClientRect();
      const rootWidth = rootRect.width;
      const rootOffsetX = rootRect.left; // #root 在視窗中的 X 偏移

      // X 軸：相對於 #root 容器的右邊界，確保在手機框架內
      const newX = rootOffsetX + rootWidth - 80 - 20; // 80px 頭像寬度 + 20px 邊距

      // Y 軸：固定在視窗的底部，像導航欄一樣不受內容長度影響
      const newY = window.innerHeight - 120 - 20; // 120px 底部導航欄高度 + 20px 間距

      return { x: newX, y: newY };
    } else {
      // fallback 到原始邏輯
      const newX = Math.min(430, window.innerWidth) - 80 - 20;
      const newY = window.innerHeight - 120 - 20;
      return { x: newX, y: newY };
    }
  };

  // 設置初始位置並監聽變化
  useEffect(() => {
    if (isVisible && avatarRef.current) {
      const newPosition = calculatePosition();
      initialPosition.current = newPosition;
      setPosition(newPosition); // 直接設置到最終位置

      // 監聽視窗大小變化和滾動
      const handleResize = () => {
        const updatedPosition = calculatePosition();
        initialPosition.current = updatedPosition;
        setPosition(updatedPosition);
      };
      const handleScroll = () => {
        const updatedPosition = calculatePosition();
        initialPosition.current = updatedPosition;
        setPosition(updatedPosition);
      };

      window.addEventListener('resize', handleResize);
      window.addEventListener('scroll', handleScroll);

      return () => {
        window.removeEventListener('resize', handleResize);
        window.removeEventListener('scroll', handleScroll);
      };
    }
  }, [isVisible]);

  // 防止上下文選單
  const handleContextMenu = (e) => {
    e.preventDefault();
    e.stopPropagation();
    return false;
  };

  // 處理觸摸開始
  const handleTouchStart = (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    setDragStart({ x: touch.clientX - position.x, y: touch.clientY - position.y });

    // 開始長按檢測
    longPressTimer.current = setTimeout(() => {
      setIsLongPress(true);
      setShowDismissZone(true);
      // 觸發震動反饋（如果支援）
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
    }, 800); // 800ms 長按
  };

  // 處理滑鼠按下
  const handleMouseDown = (e) => {
    e.preventDefault();
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });

    // 開始長按檢測
    longPressTimer.current = setTimeout(() => {
      setIsLongPress(true);
      setShowDismissZone(true);
    }, 800); // 800ms 長按
  };

  // 處理移動
  const handleMove = (clientX, clientY) => {
    if (longPressTimer.current || isLongPress) {
      setIsDragging(true);
      const newX = clientX - dragStart.x;
      const newY = clientY - dragStart.y;

      // 限制移動範圍
      const rootElement = document.getElementById('root');
      let minX = 0;
      let minY = 0;
      let maxX = window.innerWidth - 80;
      let maxY = window.innerHeight - 80;

      if (rootElement) {
        const rootRect = rootElement.getBoundingClientRect();
        // X 軸限制在 #root 容器內（手機框架內）
        minX = rootRect.left;
        maxX = rootRect.left + rootRect.width - 80;
        // Y 軸限制在整個視窗內
        minY = 0;
        maxY = window.innerHeight - 80;
      }

      setPosition({
        x: Math.max(minX, Math.min(newX, maxX)),
        y: Math.max(minY, Math.min(newY, maxY))
      });
    }
  };

  // 處理觸摸移動
  const handleTouchMove = (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    handleMove(touch.clientX, touch.clientY);
  };

  // 處理滑鼠移動
  const handleMouseMove = (e) => {
    handleMove(e.clientX, e.clientY);
  };

  // 處理結束
  const handleEnd = () => {
    // 清除長按計時器
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }

    // 檢查是否在遣散區域
    if (isLongPress && isDragging) {
      const dismissZone = document.querySelector(`.${styles.dismissZone}`);
      if (dismissZone) {
        const rect = dismissZone.getBoundingClientRect();
        const avatarCenterX = position.x + 40; // 頭像中心點
        const avatarCenterY = position.y + 40;

        const dismissCenterX = rect.left + rect.width / 2;
        const dismissCenterY = rect.top + rect.height / 2;

        const distance = Math.sqrt(
          Math.pow(avatarCenterX - dismissCenterX, 2) +
          Math.pow(avatarCenterY - dismissCenterY, 2)
        );

        if (distance < 60) { // 60px 範圍內算作遣散
          onDismiss();
          return;
        }
      }
    }

    // 如果不是長按或拖拽，則視為點擊
    if (!isLongPress && !isDragging) {
      onAvatarClick();
    }

    // 重置狀態
    if (isLongPress || isDragging) {
      // 回到初始位置
      setPosition(initialPosition.current);
    }

    setIsDragging(false);
    setIsLongPress(false);
    setShowDismissZone(false);
  };

  // 處理觸摸結束
  const handleTouchEnd = (e) => {
    e.preventDefault();
    handleEnd();
  };

  // 處理滑鼠釋放
  const handleMouseUp = (e) => {
    handleEnd();
  };

  // 防止頁面滾動的函數（但不影響頭像拖動）
  const preventScroll = (e) => {
    // 如果事件來自頭像容器，則不阻止
    if (avatarRef.current && avatarRef.current.contains(e.target)) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    return false;
  };

  // 添加全局事件監聽
  useEffect(() => {
    if (isDragging || isLongPress) {
      const handleGlobalMouseMove = (e) => handleMouseMove(e);
      const handleGlobalMouseUp = (e) => handleMouseUp(e);
      const handleGlobalTouchMove = (e) => handleTouchMove(e);
      const handleGlobalTouchEnd = (e) => handleTouchEnd(e);

      // 防止頁面滾動和其他交互
      document.addEventListener('mousemove', handleGlobalMouseMove);
      document.addEventListener('mouseup', handleGlobalMouseUp);
      document.addEventListener('touchmove', handleGlobalTouchMove, { passive: false });
      document.addEventListener('touchend', handleGlobalTouchEnd);

      // 防止滾動（只針對非頭像區域）
      document.addEventListener('wheel', preventScroll, { passive: false });
      document.addEventListener('touchstart', preventScroll, { passive: false, capture: true });

      // 禁用 body 滾動
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';

      return () => {
        document.removeEventListener('mousemove', handleGlobalMouseMove);
        document.removeEventListener('mouseup', handleGlobalMouseUp);
        document.removeEventListener('touchmove', handleGlobalTouchMove);
        document.removeEventListener('touchend', handleGlobalTouchEnd);

        // 移除防止滾動的事件監聽
        document.removeEventListener('wheel', preventScroll);
        document.removeEventListener('touchstart', preventScroll);

        // 恢復 body 滾動
        document.body.style.overflow = '';
        document.body.style.position = '';
        document.body.style.width = '';
      };
    }
  }, [isDragging, isLongPress, position, dragStart]);

  if (!isVisible) return null;

  return (
    <>
      {/* 遣散區域覆蓋層 */}
      {showDismissZone && (
        <div
          className={styles.dismissOverlay}
          onTouchStart={preventScroll}
          onTouchMove={preventScroll}
          onTouchEnd={preventScroll}
          onScroll={preventScroll}
          onWheel={preventScroll}
          onContextMenu={handleContextMenu}
        >
          <div className={styles.dismissZone}>
            <div className={styles.dismissCircle}>
              {/* 移除圖示和文字，只保留空的圓環 */}
            </div>
          </div>
        </div>
      )}

      {/* 浮動 AI 頭像 */}
      <div
        ref={avatarRef}
        className={`${styles.floatingAvatar} ${isDragging ? styles.dragging : ''} ${isLongPress ? styles.longPress : ''}`}
        style={{
          transform: `translate(${position.x}px, ${position.y}px)`,
          zIndex: showDismissZone ? 9999999 : 999999
        }}
        onTouchStart={handleTouchStart}
        onMouseDown={handleMouseDown}
        onTouchEnd={handleTouchEnd}
        onMouseUp={handleMouseUp}
        onContextMenu={handleContextMenu}
      >
        <div className={styles.avatarContainer}>
          <img
            src="/assets/icon/PeterAiChatIcon.png"
            alt="Peter AI"
            className={styles.avatarImage}
            draggable={false}
            onContextMenu={handleContextMenu}
          />


          {/* 新訊息提示點（可選） */}
          {/* <div className={styles.notificationDot}></div> */}
        </div>

        {/* 拖拽提示文字 */}
        {isLongPress && (
          <div className={styles.dragHint}>
            拖拽到下方圓環來遣散
          </div>
        )}
      </div>
    </>
  );
};

export default FloatingAIAvatar;