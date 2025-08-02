import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import TopNavbar from '../components/TopNavbar';
import BottomNavbar from '../components/BottomNavigationbar';
import { NotificationProvider } from '../context/NotificationContext';
import FeedReviewConfirmModal from '../components/FeedReviewConfirmModal';
import FeedReviewModal from '../components/FeedReviewModal';
import NotificationComponent from '../components/Notification';
import axios from '../utils/axios';
import styles from '../styles/FeedDetailPage.module.css';

const FeedDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [feed, setFeed] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isMarked, setIsMarked] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [notification, setNotification] = useState('');

  useEffect(() => {
    loadFeedDetail();
  }, [id]);

  const loadFeedDetail = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await axios.get(`/feeds/${id}/`);
      setFeed(response.data);
      setIsMarked(response.data.is_marked || false);
      
    } catch (error) {
      console.error('載入飼料詳情失敗:', error);
      setError('載入飼料詳情失敗');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleMark = async () => {
    try {
      // 如果飼料未驗證且用戶想要標記，需要先檢查是否可以使用此飼料
      if (!feed.is_verified && !isMarked) {
        // 檢查使用者是否已審核過此飼料或提交過錯誤回報
        const reviewCheckResponse = await axios.get(`/feeds/${feed.id}/check-review/`);
        
        if (reviewCheckResponse.data.can_use_feed) {
          // 如果可以使用（已審核過或已回報錯誤），直接標記而不顯示審核 modal
          const response = await axios.post('/feeds/mark/', {
            feed_id: feed.id
          });
          setIsMarked(!isMarked);
          setNotification('飼料已加入精選');
          return;
        } else {
          // 如果無法使用，顯示確認 modal
          setShowConfirmModal(true);
          return;
        }
      }
      
      // 直接切換標記狀態（已驗證的飼料或取消標記）
      const response = await axios.post('/feeds/mark/', {
        feed_id: feed.id
      });
      
      setIsMarked(!isMarked);
      setNotification(isMarked ? '已取消標記' : '飼料已加入精選');
      
    } catch (error) {
      console.error('切換標記失敗:', error);
      setNotification('操作失敗，請稍後再試');
    }
  };

  // 處理審核確認 modal 的確定按鈕
  const handleConfirmModalConfirm = () => {
    setShowConfirmModal(false);
    setShowReviewModal(true);
  };

  // 處理審核確認 modal 的取消按鈕
  const handleConfirmModalClose = () => {
    setShowConfirmModal(false);
  };

  // 處理審核 modal 的關閉
  const handleReviewModalClose = () => {
    setShowReviewModal(false);
  };

  // 處理審核確認
  const handleReviewConfirm = async (feed) => {
    try {
      // 調用審核 API
      const response = await axios.post(`/feeds/${feed.id}/review/`);
      
      // 審核完成後，將飼料標記為精選
      await axios.post('/feeds/mark/', {
        feed_id: feed.id
      });
      
      // 更新本地狀態
      setIsMarked(true);
      setFeed(prev => ({
        ...prev,
        review_count: (prev.review_count || 0) + 1,
        is_verified: response.data.is_verified
      }));
      
      setNotification('審核完成，飼料已加入精選');
      
    } catch (error) {
      console.error('審核失敗:', error);
      setNotification('審核失敗，請稍後再試');
      throw error; // 讓 modal 組件處理錯誤
    }
  };

  // 處理錯誤回報
  const handleReportError = async (errorData) => {
    try {
      // 調用錯誤回報 API
      const response = await axios.post('/feeds/error-report/', errorData);
      setNotification('已回報錯誤，感謝您的反饋');
      
    } catch (error) {
      console.error('錯誤回報失敗:', error);
      setNotification('回報失敗，請稍後再試');
      throw error; // 讓 modal 組件處理錯誤
    }
  };

  const handleBack = () => {
    navigate(-1);
  };

  // 獲取飼料圖片陣列
  const getFeedImages = () => {
    const images = [];
    if (feed?.front_image_url) {
      images.push({
        url: feed.front_image_url,
        alt: `${feed.name || '飼料'} - 正面圖片`,
        type: 'front'
      });
    }
    if (feed?.nutrition_image_url) {
      images.push({
        url: feed.nutrition_image_url,
        alt: `${feed.name || '飼料'} - 營養成分表`,
        type: 'nutrition'
      });
    }
    return images;
  };

  // 處理圖片載入錯誤
  const handleImageError = (e) => {
    console.error('圖片載入失敗:', e.target.src);
    e.target.style.display = 'none';
  };

  // 處理圖片切換
  const handlePrevImage = () => {
    const images = getFeedImages();
    if (images.length > 1) {
      setCurrentImageIndex(prev => prev > 0 ? prev - 1 : images.length - 1);
    }
  };

  const handleNextImage = () => {
    const images = getFeedImages();
    if (images.length > 1) {
      setCurrentImageIndex(prev => prev < images.length - 1 ? prev + 1 : 0);
    }
  };

  // 處理觸控滑動
  const handleTouchStart = (e) => {
    const touch = e.touches[0];
    e.currentTarget.startX = touch.clientX;
  };

  const handleTouchEnd = (e) => {
    const touch = e.changedTouches[0];
    const diffX = e.currentTarget.startX - touch.clientX;
    
    if (Math.abs(diffX) > 50) {
      if (diffX > 0) {
        handleNextImage();
      } else {
        handlePrevImage();
      }
    }
  };

  // 處理滾輪切換圖片
  const handleImageWheel = (e) => {
    const images = getFeedImages();
    if (images.length > 1) {
      e.preventDefault();
      if (e.deltaY > 0) {
        handleNextImage();
      } else {
        handlePrevImage();
      }
    }
  };

  if (loading) {
    return (
      <NotificationProvider>
        <div className={styles.container}>
          <TopNavbar />
          <div className={styles.loadingContainer}>
            載入中...
          </div>
          <BottomNavbar />
        </div>
      </NotificationProvider>
    );
  }

  if (error || !feed) {
    return (
      <NotificationProvider>
        <div className={styles.container}>
          <TopNavbar />
          <div className={styles.errorContainer}>
            {error || '飼料不存在'}
          </div>
          <BottomNavbar />
        </div>
      </NotificationProvider>
    );
  }

  return (
    <NotificationProvider>
      <div className={styles.container}>
        <TopNavbar />
        
        <div className={styles.content}>
          {/* 標題區域 */}
          <div className={styles.header}>
            <button className={styles.backButton} onClick={handleBack}>
              ❮
            </button>
            <h2 className={styles.title}>飼料詳情</h2>
            <div className={styles.menuContainer}>
              <button 
                className={styles.menuButton}
                onClick={handleToggleMark}
              >
                <img 
                  src={isMarked ? "/assets/icon/IsmarkedIcon.png" : "/assets/icon/MarkIcon.png"} 
                  alt={isMarked ? "已標記" : "標記"} 
                />
              </button>
            </div>
          </div>
          
          <div className={styles.divider}></div>

          {/* 審核狀態資訊 - 僅在未驗證時顯示 */}
          {!feed.is_verified && (
            <div className={styles.section}>
              <div className={styles.warningContent}>
                <div className={styles.warningHeader}>
                  <img src="/assets/icon/Verifying.png" alt="審核中" className={styles.warningIcon} />
                  <span className={styles.warningTitle}>此飼料資訊尚未通過審核</span>
                </div>
                <div className={styles.warningText}>
                  <p>審核進度: {feed.review_count || 0}/5 人已確認</p>
                  <p className={styles.warningNote}>需要5位使用者確認資訊正確才能通過審核</p>
                </div>
              </div>
            </div>
          )}

          {/* 飼料圖片區域 */}
          <div className={styles.section}>
            <div 
              className={styles.imageCarousel}
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
              onWheel={handleImageWheel}
            >
              <div className={styles.mainImageContainer}>
                {getFeedImages().length > 0 ? (
                  <img 
                    src={getFeedImages()[currentImageIndex].url} 
                    alt={getFeedImages()[currentImageIndex].alt}
                    className={styles.feedImage}
                    onError={handleImageError}
                  />
                ) : (
                  <div className={styles.imagePlaceholder}>
                    無圖片
                  </div>
                )}
                
                {/* 圖片指示器 */}
                {getFeedImages().length > 1 && (
                  <div className={styles.imageIndicator}>
                    {currentImageIndex + 1}/{getFeedImages().length}
                  </div>
                )}
                
                {/* 圖片導航按鈕 */}
                {getFeedImages().length > 1 && (
                  <>
                    <button 
                      className={`${styles.imageNavButton} ${styles.prevButton}`}
                      onClick={handlePrevImage}
                    >
                      ❮
                    </button>
                    <button 
                      className={`${styles.imageNavButton} ${styles.nextButton}`}
                      onClick={handleNextImage}
                    >
                      ❯
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* 飼料基本資訊 */}
          <div className={styles.section}>
            <div className={styles.infoRow}>
              <label className={styles.sectionLabel}>飼料名稱:</label>
              <div className={styles.infoContent}>
                {feed.name || '未知飼料'}
              </div>
            </div>
            <div className={styles.infoRow}>
              <label className={styles.sectionLabel}>品牌:</label>
              <div className={styles.infoContent}>
                {feed.brand || '未知品牌'}
              </div>
            </div>
            <div className={styles.infoRow}>
              <label className={styles.sectionLabel}>價格:</label>
              <div className={styles.infoContent}>
                NT$ {feed.price || '未提供'}
              </div>
            </div>
          </div>

          {/* 營養成分區域 */}
          <div className={styles.section}>
            <label className={styles.sectionLabel}>營養成分:</label>
            <div className={styles.nutritionContainer}>
              <div className={styles.nutritionRow}>
                <span className={styles.nutritionLabel}>蛋白質</span>
                <div className={styles.nutritionInputWrapper}>
                  <input 
                    type="text"
                    value={feed.protein || 0}
                    readOnly
                    className={styles.nutritionInput}
                  />
                  <span className={styles.nutritionUnit}>%</span>
                </div>
              </div>
              <div className={styles.nutritionRow}>
                <span className={styles.nutritionLabel}>脂肪</span>
                <div className={styles.nutritionInputWrapper}>
                  <input 
                    type="text"
                    value={feed.fat || 0}
                    readOnly
                    className={styles.nutritionInput}
                  />
                  <span className={styles.nutritionUnit}>%</span>
                </div>
              </div>
              <div className={styles.nutritionRow}>
                <span className={styles.nutritionLabel}>碳水化合物</span>
                <div className={styles.nutritionInputWrapper}>
                  <input 
                    type="text"
                    value={feed.carbohydrate || 0}
                    readOnly
                    className={styles.nutritionInput}
                  />
                  <span className={styles.nutritionUnit}>%</span>
                </div>
              </div>
              <div className={styles.nutritionRow}>
                <span className={styles.nutritionLabel}>鈣</span>
                <div className={styles.nutritionInputWrapper}>
                  <input 
                    type="text"
                    value={feed.calcium || 0}
                    readOnly
                    className={styles.nutritionInput}
                  />
                  <span className={styles.nutritionUnit}>%</span>
                </div>
              </div>
              <div className={styles.nutritionRow}>
                <span className={styles.nutritionLabel}>磷</span>
                <div className={styles.nutritionInputWrapper}>
                  <input 
                    type="text"
                    value={feed.phosphorus || 0}
                    readOnly
                    className={styles.nutritionInput}
                  />
                  <span className={styles.nutritionUnit}>%</span>
                </div>
              </div>
              <div className={styles.nutritionRow}>
                <span className={styles.nutritionLabel}>鎂</span>
                <div className={styles.nutritionInputWrapper}>
                  <input 
                    type="text"
                    value={feed.magnesium || 0}
                    readOnly
                    className={styles.nutritionInput}
                  />
                  <span className={styles.nutritionUnit}>%</span>
                </div>
              </div>
              <div className={styles.nutritionRow}>
                <span className={styles.nutritionLabel}>鈉</span>
                <div className={styles.nutritionInputWrapper}>
                  <input 
                    type="text"
                    value={feed.sodium || 0}
                    readOnly
                    className={styles.nutritionInput}
                  />
                  <span className={styles.nutritionUnit}>%</span>
                </div>
              </div>
            </div>
          </div>

        </div>
        
        <BottomNavbar />
        
        {/* 審核相關 Modal */}
        <FeedReviewConfirmModal
          isVisible={showConfirmModal}
          onClose={handleConfirmModalClose}
          onConfirm={handleConfirmModalConfirm}
        />
        
        <FeedReviewModal
          feed={feed ? {
            ...feed,
            frontImage: feed.front_image_url
          } : null}
          isOpen={showReviewModal}
          onClose={handleReviewModalClose}
          onConfirm={handleReviewConfirm}
          onReportError={handleReportError}
        />
        
        {/* Notification 組件 */}
        {notification && (
          <NotificationComponent 
            message={notification} 
            onClose={() => setNotification('')} 
          />
        )}
      </div>
    </NotificationProvider>
  );
};

export default FeedDetailPage;