import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import TopNavbar from '../components/TopNavbar';
import BottomNavbar from '../components/BottomNavigationbar';
import { NotificationProvider } from '../context/NotificationContext';
import FeedReviewConfirmModal from '../components/FeedReviewConfirmModal';
import FeedReviewModal from '../components/FeedReviewModal';
import axios from '../utils/axios';
import styles from '../styles/MarkedFeedsPage.module.css';

const MarkedFeedsPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [markedFeeds, setMarkedFeeds] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [message, setMessage] = useState('');
  
  // Modal 狀態
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [selectedFeed, setSelectedFeed] = useState(null);

  useEffect(() => {
    loadMarkedFeeds();
  }, []);

  const loadMarkedFeeds = async () => {
    try {
      setLoading(true);
      
      // 使用高限制數量獲取所有精選飼料
      const response = await axios.get('/feeds/my-marked/preview/?limit=100');
      
      const markedData = response.data.data.map(item => ({
        id: item.feed.id,
        markId: item.id,
        name: item.feed.name || '',
        brand: item.feed.brand || '',
        price: item.feed.price,
        protein: item.feed.protein,
        fat: item.feed.fat,
        carbohydrate: item.feed.carbohydrate,
        calcium: item.feed.calcium,
        phosphorus: item.feed.phosphorus,
        magnesium: item.feed.magnesium,
        sodium: item.feed.sodium,
        frontImage: item.feed.front_image_url,
        isMarked: true,
        isVerified: item.feed.is_verified,
        reviewCount: item.feed.review_count,
        created_by: item.feed.created_by,
        created_at: item.feed.created_at,
        lastUsedAt: item.created_at
      }));
      
      setMarkedFeeds(markedData);
      setMessage(response.data.message);
      
    } catch (error) {
      console.error('載入精選飼料失敗:', error);
      setMarkedFeeds([]);
      setMessage('載入失敗');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (query) => {
    setSearchQuery(query);
  };

  const handleSearchChange = (query) => {
    setSearchQuery(query);
  };

  const handleToggleMark = async (feed) => {
    try {
      // 如果飼料未驗證且用戶想要標記，需要先檢查是否可以使用此飼料
      if (!feed.isVerified && !feed.isMarked) {
        // 檢查使用者是否已審核過此飼料或提交過錯誤回報
        const reviewCheckResponse = await axios.get(`/feeds/${feed.id}/check-review/`);
        
        if (reviewCheckResponse.data.can_use_feed) {
          // 如果可以使用（已審核過或已回報錯誤），直接標記而不顯示審核 modal
          const response = await axios.post('/feeds/mark/', {
            feed_id: feed.id
          });
          
          // 重新載入數據
          loadMarkedFeeds();
          return;
        } else {
          // 如果無法使用，顯示確認 modal
          setSelectedFeed(feed);
          setShowConfirmModal(true);
          return;
        }
      }
      
      // 直接切換標記狀態（已驗證的飼料或取消標記）
      const response = await axios.post('/feeds/mark/', {
        feed_id: feed.id
      });
      
      // 重新載入數據
      loadMarkedFeeds();
      
    } catch (error) {
      console.error('切換標記失敗:', error);
    }
  };

  // 處理確認 modal 的確定按鈕
  const handleConfirmModalConfirm = () => {
    setShowConfirmModal(false);
    setShowReviewModal(true);
  };

  // 處理確認 modal 的取消按鈕
  const handleConfirmModalClose = () => {
    setShowConfirmModal(false);
    setSelectedFeed(null);
  };

  // 處理審核 modal 的關閉
  const handleReviewModalClose = () => {
    setShowReviewModal(false);
    setSelectedFeed(null);
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
      
      // 重新載入數據
      loadMarkedFeeds();
      
    } catch (error) {
      console.error('審核失敗:', error);
      throw error; // 讓 modal 組件處理錯誤
    }
  };

  // 處理錯誤回報
  const handleReportError = async (errorData) => {
    try {
      // 調用錯誤回報 API
      const response = await axios.post('/feeds/error-report/', errorData);
      
    } catch (error) {
      console.error('錯誤回報失敗:', error);
      throw error; // 讓 modal 組件處理錯誤
    }
  };

  const handleFeedClick = (feed) => {
    // 導航到飼料詳情頁面
    navigate(`/feeds/${feed.id}`);
  };

  const handleBack = () => {
    navigate(-1);
  };

  const getFilteredFeeds = (feedList) => {
    if (!searchQuery) return feedList;
    const query = searchQuery.toLowerCase();
    return feedList.filter(feed => 
      feed.name.toLowerCase().includes(query) || 
      feed.brand.toLowerCase().includes(query)
    );
  };

  const renderFeedCard = (feed) => (
    <div key={feed.markId || feed.id} className={styles.feedCard}>
      <div className={styles.feedImageContainer} onClick={() => handleFeedClick(feed)}>
        {feed.frontImage ? (
          <img src={feed.frontImage} alt={feed.name} className={styles.feedImage} />
        ) : (
          <div className={styles.feedImagePlaceholder}>
            <span>無圖片</span>
          </div>
        )}
        <button 
          className={styles.markButton}
          onClick={(e) => {
            e.stopPropagation();
            handleToggleMark(feed);
          }}
        >
          <img 
            src={feed.isMarked ? "/assets/icon/IsmarkedIcon.png" : "/assets/icon/MarkIcon.png"} 
            alt={feed.isMarked ? "已標記" : "標記"} 
          />
        </button>
        {/* 審核中標示 - 顯示在左下角 */}
        {!feed.isVerified && (
          <div className={styles.verifyingBadge}>
            <img src="/assets/icon/Verifying.png" alt="審核中" />
          </div>
        )}
      </div>
    </div>
  );

  return (
    <NotificationProvider>
      <div className={styles.container}>
        <TopNavbar 
          onSearchSubmit={handleSearch}
          onSearchChange={handleSearchChange}
          initialSearchValue={searchQuery}
        />
        
        <div className={styles.content}>
          {/* 標題區域 */}
          <div className={styles.header}>
            <button className={styles.backButton} onClick={handleBack}>
              ❮
            </button>
            <h1 className={styles.title}>我的精選飼料</h1>
            <div className={styles.spacer}></div>
          </div>
          
          <div className={styles.divider}></div>

          {loading ? (
            <div className={styles.loadingContainer}>
              <span>載入中...</span>
            </div>
          ) : (
            <div className={styles.feedSection}>
              {getFilteredFeeds(markedFeeds).length > 0 ? (
                <div className={styles.feedGrid}>
                  {getFilteredFeeds(markedFeeds).map(feed => renderFeedCard(feed))}
                </div>
              ) : (
                <div className={styles.emptyState}>
                  <img src="/assets/icon/SearchNoResult.png" alt="無結果" className={styles.noResultImage} />
                  <p>{searchQuery ? '未找到相關的精選飼料' : message}</p>
                </div>
              )}
            </div>
          )}
        </div>
        
        <BottomNavbar />
        
        {/* Modal 組件 */}
        <FeedReviewConfirmModal
          isVisible={showConfirmModal}
          onClose={handleConfirmModalClose}
          onConfirm={handleConfirmModalConfirm}
        />
        
        <FeedReviewModal
          feed={selectedFeed}
          isOpen={showReviewModal}
          onClose={handleReviewModalClose}
          onConfirm={handleReviewConfirm}
          onReportError={handleReportError}
        />
      </div>
    </NotificationProvider>
  );
};

export default MarkedFeedsPage;