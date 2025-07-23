import React, { useState, useEffect } from 'react';
import styles from '../styles/ImageViewer.module.css';

const ImageViewer = ({ isOpen, onClose, images, initialIndex = 0 }) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setCurrentIndex(initialIndex);
  }, [initialIndex]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // 點擊外部關閉檢視器
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (isOpen && !event.target.closest(`.${styles.imageContent}`) && 
          !event.target.closest(`.${styles.navButton}`) && 
          !event.target.closest(`.${styles.thumbnailContainer}`)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isOpen) return;
      
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft' && currentIndex > 0) {
        setCurrentIndex(currentIndex - 1);
      } else if (e.key === 'ArrowRight' && currentIndex < images.length - 1) {
        setCurrentIndex(currentIndex + 1);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentIndex, images.length, onClose]);

  if (!isOpen || !images || images.length === 0) {
    return null;
  }

  const currentImage = images[currentIndex];

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setIsLoading(true);
    }
  };

  const handleNext = () => {
    if (currentIndex < images.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setIsLoading(true);
    }
  };

  const handleImageLoad = () => {
    setIsLoading(false);
  };


  return (
    <div className={styles.overlay}>
      <div className={styles.viewer}>
        {/* 圖片計數器 */}
        {images.length > 1 && (
          <div className={styles.counter}>
            {currentIndex + 1} / {images.length}
          </div>
        )}

        {/* 主要圖片區域 */}
        <div className={styles.imageContainer}>
          {isLoading && (
            <div className={styles.loading}>
              載入中...
            </div>
          )}
          
          <div className={styles.imageContent}>
            <img
              src={currentImage.url || currentImage.firebase_url || currentImage.preview}
              alt={`圖片 ${currentIndex + 1}`}
              className={styles.image}
              onLoad={handleImageLoad}
              onError={() => setIsLoading(false)}
            />
            {/* 關閉按鈕 - 位於圖片右上角 */}
            <button className={styles.closeButton} onClick={onClose}>
              ✕
            </button>
          </div>
        </div>

        {/* 導航按鈕 */}
        {images.length > 1 && (
          <>
            <button
              className={`${styles.navButton} ${styles.prevButton}`}
              onClick={handlePrevious}
              disabled={currentIndex === 0}
            >
              ❮
            </button>
            <button
              className={`${styles.navButton} ${styles.nextButton}`}
              onClick={handleNext}
              disabled={currentIndex === images.length - 1}
            >
              ❯
            </button>
          </>
        )}

        {/* 縮略圖導航 (如果有多張圖片) */}
        {images.length > 1 && (
          <div className={styles.thumbnailContainer}>
            <div className={styles.thumbnailList}>
              {images.map((image, index) => (
                <button
                  key={index}
                  className={`${styles.thumbnail} ${
                    index === currentIndex ? styles.activeThumbnail : ''
                  }`}
                  onClick={() => {
                    setCurrentIndex(index);
                    setIsLoading(true);
                  }}
                >
                  <img
                    src={image.url || image.firebase_url || image.preview}
                    alt={`縮略圖 ${index + 1}`}
                  />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ImageViewer;