import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import TopNavbar from '../components/TopNavbar';
import BottomNavbar from '../components/BottomNavigationbar';
import { NotificationProvider } from '../context/NotificationContext';
import FeedReviewConfirmModal from '../components/FeedReviewConfirmModal';
import FeedReviewModal from '../components/FeedReviewModal';
import NotificationComponent from '../components/Notification';
import axios from '../utils/axios';
import styles from '../styles/FeedSearchResultPage.module.css';
import { useUser } from '../context/UserContext';

const FeedSearchResultPage = () => {
  const { t } = useTranslation('posts');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { userData } = useUser();
  const [loading, setLoading] = useState(true);
  const [searchResults, setSearchResults] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [message, setMessage] = useState('');
  const [totalCount, setTotalCount] = useState(0);
  const [notification, setNotification] = useState('');
  
  // Modal 狀態
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [selectedFeed, setSelectedFeed] = useState(null);

  useEffect(() => {
    // 從 URL 參數獲取搜尋關鍵字
    const query = searchParams.get('q') || '';
    setSearchQuery(query);
    if (query) {
      performSearch(query);
    } else {
      setLoading(false);
      setMessage(t('feedSearchResultPage.messages.enterSearchKeyword'));
    }
  }, [searchParams]);

  const performSearch = async (query) => {
    try {
      setLoading(true);
      
      const response = await axios.get(`/feeds/search/?q=${encodeURIComponent(query)}`);
      
      const searchData = response.data.data.map(item => ({
        id: item.id,
        name: item.name || '',
        brand: item.brand || '',
        price: item.price,
        protein: item.protein,
        fat: item.fat,
        carbohydrate: item.carbohydrate,
        calcium: item.calcium,
        phosphorus: item.phosphorus,
        magnesium: item.magnesium,
        sodium: item.sodium,
        frontImage: item.front_image_url,
        isMarked: item.is_marked,
        isVerified: item.is_verified,
        reviewCount: item.review_count,
        created_by: item.created_by,
        created_by_id: item.created_by_id,
        created_at: item.created_at,
        lastUsedAt: item.created_at
      }));
      
      setSearchResults(searchData);
      setMessage(response.data.message);
      setTotalCount(response.data.total_count);
      
    } catch (error) {
      console.error(t('feedSearchResultPage.messages.searchFailed'), error);
      setSearchResults([]);
      setMessage(t('feedSearchResultPage.messages.searchFailed'));
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (query) => {
    // 更新 URL 參數並觸發新的搜尋
    navigate(`/feeds/search?q=${encodeURIComponent(query)}`);
  };

  const handleSearchChange = (query) => {
    setSearchQuery(query);
  };

  const handleToggleMark = async (feed) => {
    try {
      // 如果飼料未驗證且用戶想要標記，需要先檢查是否可以使用此飼料
      if (!feed.isVerified && !feed.isMarked) {
        // 檢查是否為飼料創建者本人
        const isCreator = userData && feed.created_by_id === userData.id;
        
        if (isCreator) {
          // 如果是創建者本人，直接標記而不需要審核
          const response = await axios.post('/feeds/mark/', {
            feed_id: feed.id
          });
          
          // 重新執行搜尋以更新結果
          const currentQuery = searchParams.get('q') || '';
          if (currentQuery) {
            performSearch(currentQuery);
          }
          setNotification(t('feedSearchResultPage.messages.feedMarked'));
          return;
        } else {
          // 如果不是創建者，檢查使用者是否已審核過此飼料或提交過錯誤回報
          const reviewCheckResponse = await axios.get(`/feeds/${feed.id}/check-review/`);
          
          if (reviewCheckResponse.data.can_use_feed) {
            // 如果可以使用（已審核過或已回報錯誤），直接標記而不顯示審核 modal
            const response = await axios.post('/feeds/mark/', {
              feed_id: feed.id
            });
            
            // 重新執行搜尋以更新結果
            const currentQuery = searchParams.get('q') || '';
            if (currentQuery) {
              performSearch(currentQuery);
            }
            return;
          } else {
            // 如果無法使用，顯示確認 modal
            setSelectedFeed(feed);
            setShowConfirmModal(true);
            return;
          }
        }
      }
      
      // 直接切換標記狀態（已驗證的飼料或取消標記）
      const response = await axios.post('/feeds/mark/', {
        feed_id: feed.id
      });
      
      // 重新執行搜尋以更新結果
      const currentQuery = searchParams.get('q') || '';
      if (currentQuery) {
        performSearch(currentQuery);
      }
      
    } catch (error) {
      console.error(t('feedSearchResultPage.messages.toggleMarkFailed'), error);
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
      
      // 重新執行搜尋以更新結果
      const currentQuery = searchParams.get('q') || '';
      if (currentQuery) {
        performSearch(currentQuery);
      }
      
    } catch (error) {
      console.error(t('feedSearchResultPage.messages.reviewFailed'), error);
      throw error; // 讓 modal 組件處理錯誤
    }
  };

  // 處理錯誤回報
  const handleReportError = async (errorData) => {
    try {
      // 調用錯誤回報 API
      const response = await axios.post('/feeds/error-report/', errorData);
      
    } catch (error) {
      console.error(t('feedSearchResultPage.messages.reportErrorFailed'), error);
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

  const renderFeedCard = (feed) => (
    <div key={feed.id} className={styles.feedCard}>
      <div className={styles.feedImageContainer} onClick={() => handleFeedClick(feed)}>
        {feed.frontImage ? (
          <img src={feed.frontImage} alt={feed.name} className={styles.feedImage} />
        ) : (
          <div className={styles.feedImagePlaceholder}>
            <span>{t('feedSearchResultPage.noImage')}</span>
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
            alt={feed.isMarked ? t('feedSearchResultPage.marked') : t('feedSearchResultPage.mark')} 
          />
        </button>
        {/* 審核中標示 - 顯示在左下角 */}
        {!feed.isVerified && (
          <div className={styles.verifyingBadge}>
            <img src="/assets/icon/Verifying.png" alt={t('feedSearchResultPage.verifying')} />
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
            <h1 className={styles.title}>{t('feedSearchResultPage.title')}</h1>
            <div className={styles.spacer}></div>
          </div>
          
          <div className={styles.divider}></div>

          {/* 搜尋資訊 */}
          {searchQuery && (
            <div className={styles.searchInfo}>
              <p>{totalCount > 0 ? t('feedSearchResultPage.searchInfoWithCount', { searchQuery, totalCount }) : t('feedSearchResultPage.searchInfo', { searchQuery })}</p>
            </div>
          )}

          {loading ? (
            <div className={styles.loadingContainer}>
              <span>{t('feedSearchResultPage.loading')}</span>
            </div>
          ) : (
            <div className={styles.feedSection}>
              {searchResults.length > 0 ? (
                <div className={styles.feedGrid}>
                  {searchResults.map(feed => renderFeedCard(feed))}
                </div>
              ) : (
                <div className={styles.emptyState}>
                  <img src="/assets/icon/SearchNoResult.png" alt={t('feedSearchResultPage.noResultAlt')} className={styles.noResultImage} />
                  <p>{searchQuery ? t('feedSearchResultPage.noResultsFound', { searchQuery }) : t('feedSearchResultPage.messages.enterSearchKeyword')}</p>
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

export default FeedSearchResultPage;