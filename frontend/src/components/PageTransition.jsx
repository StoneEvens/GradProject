import React, { useState, useEffect } from 'react';
import styles from '../styles/PageTransition.module.css';

const PageTransition = ({ 
  isLoading, 
  children, 
  showOverlay = true,
  overlayColor = '#FFF2D9',
  fadeDuration = 300 
}) => {
  const [isVisible, setIsVisible] = useState(!isLoading);
  const [showChildren, setShowChildren] = useState(!isLoading);

  useEffect(() => {
    if (isLoading) {
      // 開始載入：隱藏內容
      setIsVisible(false);
      setShowChildren(false);
    } else {
      // 載入完成：顯示內容
      const timer = setTimeout(() => {
        setShowChildren(true);
        setIsVisible(true);
      }, 50); // 小延遲確保狀態更新
      
      return () => clearTimeout(timer);
    }
  }, [isLoading]);

  return (
    <div className={styles.transitionContainer}>
      {/* Loading 遮罩 */}
      {showOverlay && isLoading && (
        <div 
          className={styles.loadingOverlay}
          style={{ 
            backgroundColor: overlayColor,
            animationDuration: `${fadeDuration}ms`
          }}
        />
      )}
      
      {/* 頁面內容 */}
      <div 
        className={`${styles.content} ${isVisible ? styles.visible : styles.hidden}`}
        style={{ 
          animationDuration: `${fadeDuration}ms`,
          transitionDuration: `${fadeDuration}ms`
        }}
      >
        {showChildren && children}
      </div>
    </div>
  );
};

export default PageTransition;