import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import TopNavbar from '../components/TopNavbar';
import BottomNavbar from '../components/BottomNavigationbar';
// SearchBar 現在整合在 TopNavbar 中
import { NotificationProvider } from '../context/NotificationContext';
import FeedReviewConfirmModal from '../components/FeedReviewConfirmModal';
import FeedReviewModal from '../components/FeedReviewModal';
import CreateFeedModal from '../components/CreateFeedModal';
import NotificationComponent from '../components/Notification';
import axios from '../utils/axios';
import styles from '../styles/FeedPage.module.css';
import { useUser } from '../context/UserContext';
// 圖片將使用 public 路徑引用

const FeedPage = () => {
  const { t } = useTranslation('feed');
  const navigate = useNavigate();
  const { userData } = useUser();
  const [loading, setLoading] = useState(true);
  const [markedFeeds, setMarkedFeeds] = useState([]);
  const [recentFeeds, setRecentFeeds] = useState([]);
  const [allFeeds, setAllFeeds] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [markedMessage, setMarkedMessage] = useState('');
  const [recentMessage, setRecentMessage] = useState('');
  const [allMessage, setAllMessage] = useState('');
  const [markedHasMore, setMarkedHasMore] = useState(false);
  const [allHasMore, setAllHasMore] = useState(false);
  
  // Modal 狀態
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [showCreateFeedModal, setShowCreateFeedModal] = useState(false);
  const [selectedFeed, setSelectedFeed] = useState(null);
  
  // Notification 狀態
  const [notification, setNotification] = useState('');
  // 待審核飼料狀態
  const [pendingFeedForReview, setPendingFeedForReview] = useState(null);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    loadAllSections();
  }, []);

  const loadInitialData = async () => {
    loadAllSections();
  };

  const loadAllSections = async () => {
    try {
      setLoading(true);
      
      // 並行載入三個區域的數據（使用 preview API）
      const [markedResponse, recentResponse, allResponse] = await Promise.all([
        axios.get('/feeds/my-marked/preview/'),
        axios.get('/feeds/recently-used/?limit=10'),
        axios.get('/feeds/all/preview/')
      ]);
      
      // 處理精選飼料
      const markedData = markedResponse.data.data.map(item => ({
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
        created_by_name: item.feed.created_by_name,
        created_at: item.feed.created_at,
        lastUsedAt: item.created_at
      }));
      setMarkedFeeds(markedData);
      setMarkedMessage(markedResponse.data.message);
      setMarkedHasMore(markedResponse.data.has_more || false);
      
      // 處理最近使用飼料
      const recentData = recentResponse.data.data.map(item => ({
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
        usageCount: item.usage_count,
        created_by: item.created_by,
        created_by_id: item.created_by_id,
        created_by_name: item.created_by_name,
        created_at: item.created_at,
        lastUsedAt: item.last_used_at,
        petName: item.pet_name
      }));
      setRecentFeeds(recentData);
      setRecentMessage(recentResponse.data.message);
      
      // 處理所有飼料
      const allData = allResponse.data.data.map(item => ({
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
        created_by_name: item.created_by_name,
        created_at: item.created_at,
        lastUsedAt: item.created_at
      }));
      setAllFeeds(allData);
      setAllMessage(allResponse.data.message);
      setAllHasMore(allResponse.data.has_more || false);
      
    } catch (error) {
      console.error('Failed to load feed data:', error);
      setMarkedFeeds([]);
      setRecentFeeds([]);
      setAllFeeds([]);
      setMarkedMessage(t('page.messages.loadFailed'));
      setRecentMessage(t('page.messages.loadFailed'));
      setAllMessage(t('page.messages.loadFailed'));
      setMarkedHasMore(false);
      setAllHasMore(false);
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
        // 檢查是否為飼料創建者本人
        const isCreator = userData && feed.created_by_id === userData.id;
        
        if (isCreator) {
          // 如果是創建者本人，直接標記而不需要審核
          const response = await axios.post('/feeds/mark/', {
            feed_id: feed.id
          });
          
          // 重新載入所有數據以确保一致性
          loadAllSections();
          setNotification(t('page.messages.feedMarked'));
          return;
        } else {
          // 如果不是創建者，檢查使用者是否已審核過此飼料或提交過錯誤回報
          const reviewCheckResponse = await axios.get(`/feeds/${feed.id}/check-review/`);
          
          if (reviewCheckResponse.data.can_use_feed) {
            // 如果可以使用（已審核過或已回報錯誤），直接標記而不顯示審核 modal
            const response = await axios.post('/feeds/mark/', {
              feed_id: feed.id
            });
            
            // 重新載入所有數據以确保一致性
            loadAllSections();
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
      
      // 重新載入所有數據以确保一致性
      loadAllSections();
      
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
    
    // 如果是新增飼料時的審核，也導向詳情頁
    if (pendingFeedForReview) {
      setNotification(t('page.messages.systemDetected'));
      setTimeout(() => {
        navigate(`/feeds/${pendingFeedForReview.id}`);
      }, 2000);
      setPendingFeedForReview(null);
    }
  };

  // 處理審核 modal 的關閉
  const handleReviewModalClose = () => {
    setShowReviewModal(false);
    setSelectedFeed(null);
    
    // 如果是新增飼料時的審核，也導向詳情頁
    if (pendingFeedForReview) {
      setNotification(t('page.messages.systemDetected'));
      setTimeout(() => {
        navigate(`/feeds/${pendingFeedForReview.id}`);
      }, 2000);
      setPendingFeedForReview(null);
    }
  };

  // 處理審核確認
  const handleReviewConfirm = async (feed) => {
    try {
      // 調用審核 API
      const response = await axios.post(`/feeds/${feed.id}/review/`);
      
      // 如果是新增飼料時的審核流程
      if (pendingFeedForReview && pendingFeedForReview.id === feed.id) {
        setNotification(t('page.messages.reviewCompleted'));
        setTimeout(() => {
          navigate(`/feeds/${feed.id}`);
        }, 2000);
        setPendingFeedForReview(null);
      } else {
        // 如果是一般的標記流程，審核完成後將飼料標記為精選
        await axios.post('/feeds/mark/', {
          feed_id: feed.id
        });
      }
      
      // 重新載入所有數據
      loadAllSections();
      
    } catch (error) {
      console.error('Review failed:', error);
      throw error; // 讓 modal 組件處理錯誤
    }
  };

  // 處理錯誤回報
  const handleReportError = async (errorData) => {
    try {
      // 調用錯誤回報 API - errorData 已經是正確的格式
      const response = await axios.post('/feeds/error-report/', errorData);
      
    } catch (error) {
      console.error('Error report failed:', error);
      throw error; // 讓 modal 組件處理錯誤
    }
  };

  const handleFeedClick = (feed) => {
    // 導航到飼料詳情頁面
    navigate(`/feeds/${feed.id}`);
  };

  const handleViewMoreMarked = () => {
    // 導航到完整的我的精選飼料頁面
    navigate('/feeds/my-marked');
  };

  const handleViewMoreAll = () => {
    // 導航到完整的所有飼料頁面
    navigate('/feeds/all');
  };

  // 處理新增飼料按鈕點擊
  const handleCreateFeedClick = () => {
    setShowCreateFeedModal(true);
  };

  // 處理新增飼料確認 (使用正確的 API)
  const handleCreateFeedConfirm = async (feedData) => {
    try {
      // Step 1: OCR 處理
      const ocrForm = new FormData();
      ocrForm.append('image', feedData.nutritionImage);
      const ocrRes = await axios.post('/feeds/ocr/', ocrForm, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      const nutrients = ocrRes.data.extracted_nutrients || {};
      console.log("OCR 結果：", nutrients);

      // 將圖片轉換為 base64
      const convertToBase64 = (file) => {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.readAsDataURL(file);
          reader.onload = () => resolve(reader.result);
          reader.onerror = error => reject(error);
        });
      };

      // 轉換圖片為 base64
      const frontImageBase64 = feedData.frontImage ? await convertToBase64(feedData.frontImage) : null;
      const nutritionImageBase64 = feedData.nutritionImage ? await convertToBase64(feedData.nutritionImage) : null;

      // Step 2: 建立 Feed (使用正確的 API 端點)
      const parseNumber = (val) => typeof val === 'number' ? val : 0;
      const createFeedPayload = {
        name: feedData.feedName || '自訂飼料',
        brand: feedData.feedBrand || '未知品牌',
        pet_type: feedData.petType,
        protein: parseNumber(nutrients.protein),
        fat: parseNumber(nutrients.fat),
        carbohydrate: parseNumber(nutrients.carbohydrate),
        calcium: parseNumber(nutrients.calcium),
        phosphorus: parseNumber(nutrients.phosphorus),
        magnesium: parseNumber(nutrients.magnesium),
        sodium: parseNumber(nutrients.sodium),
        price: feedData.feedPrice,
        front_image: frontImageBase64,
        nutrition_image: nutritionImageBase64
      };

      const createFeedRes = await axios.post('/feeds/create/', createFeedPayload);
      const responseData = createFeedRes.data;
      const feedId = responseData.feed_id;

      console.log('飼料新增/匹配成功:', responseData);
      
      // 關閉模態框
      setShowCreateFeedModal(false);
      
      // 檢查是否為現有飼料
      if (responseData.is_existing) {
        // 獲取飼料詳情以確認是否為審核中飼料
        const feedDetailRes = await axios.get(`/feeds/${feedId}/`);
        const feedDetail = feedDetailRes.data;
        
        if (!feedDetail.is_verified) {
          // 如果是審核中飼料，檢查是否可以使用
          try {
            const reviewCheckResponse = await axios.get(`/feeds/${feedId}/check-review/`);
            
            if (reviewCheckResponse.data.can_use_feed) {
              // 如果可以使用（已審核過或已回報錯誤），直接顯示通知並導向
              setNotification(t('page.messages.systemDetected'));
              setTimeout(() => {
                navigate(`/feeds/${feedId}`);
              }, 2000);
            } else {
              // 如果無法使用，設置待審核飼料並顯示確認 modal
              setPendingFeedForReview({
                id: feedDetail.id,
                name: feedDetail.name,
                brand: feedDetail.brand,
                frontImage: feedDetail.front_image_url,
                protein: feedDetail.protein,
                fat: feedDetail.fat,
                carbohydrate: feedDetail.carbohydrate,
                calcium: feedDetail.calcium,
                phosphorus: feedDetail.phosphorus,
                magnesium: feedDetail.magnesium,
                sodium: feedDetail.sodium,
                price: feedDetail.price,
                isVerified: feedDetail.is_verified,
                reviewCount: feedDetail.review_count,
                created_by_name: feedDetail.created_by_name,
                created_at: feedDetail.created_at
              });
              setShowConfirmModal(true);
              return; // 等待用戶審核決定
            }
          } catch (reviewCheckError) {
            console.error('檢查審核狀態失敗:', reviewCheckError);
            // 如果檢查失敗，預設為直接導向
            setNotification(t('page.messages.systemDetected'));
            setTimeout(() => {
              navigate(`/feeds/${feedId}`);
            }, 2000);
          }
        } else {
          // 已驗證飼料，直接顯示通知並導向
          setNotification(t('page.messages.systemDetected'));
          setTimeout(() => {
            navigate(`/feeds/${feedId}`);
          }, 2000);
        }
      } else {
        // 如果是新飼料，顯示成功通知並導向詳情頁面
        setNotification(t('page.messages.newFeedCreated'));
        setTimeout(() => {
          navigate(`/feeds/${feedId}`);
        }, 2000);
      }
      
      // 重新載入所有區域的數據（在背景執行）
      loadAllSections();
      
    } catch (error) {
      console.error('Failed to add feed:', error);
      
      // 詳細錯誤診斷
      if (error.response) {
        console.error('錯誤狀態碼:', error.response.status);
        console.error('錯誤訊息:', error.response.data);
        
        if (error.response.status === 413) {
          setNotification(t('page.messages.imageTooLarge'));
        } else if (error.response.status === 400) {
          setNotification(error.response.data?.message || t('page.messages.dataFormatError'));
        } else {
          setNotification(t('page.messages.addFeedFailed'));
        }
      } else if (error.request) {
        console.error('無回應:', error.request);
        setNotification(t('page.messages.noResponse'));
      } else {
        console.error('錯誤:', error.message);
        setNotification(t('page.messages.unknownError'));
      }
      
      throw error; // 讓 modal 組件處理錯誤
    }
  };

  // 處理新增飼料取消
  const handleCreateFeedClose = () => {
    setShowCreateFeedModal(false);
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
            <span>{t('page.feedCard.noImage')}</span>
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
            alt={feed.isMarked ? t('page.feedCard.marked') : t('page.feedCard.mark')} 
          />
        </button>
        {/* 審核中標示 - 顯示在左下角 */}
        {!feed.isVerified && (
          <div className={styles.verifyingBadge}>
            <img src="/assets/icon/Verifying.png" alt={t('page.feedCard.verifying')} />
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
          <div className={styles.titleSection}>
            <h2 className={styles.title}>{t('page.title')}</h2>
            <button 
              className={styles.addFeedButton} 
              onClick={handleCreateFeedClick}
            >
              {t('page.buttons.addFeed')}
            </button>
          </div>
          
          <div className={styles.divider}></div>

          {loading ? (
            <div className={styles.loadingContainer}>
              <span>{t('page.loading')}</span>
            </div>
          ) : (
            <>
              {/* 精選飼料區域 */}
              <div className={styles.section}>
                <div className={styles.sectionHeader}>
                  <label className={styles.sectionLabel}>{t('page.sections.marked')}</label>
                  {!searchQuery && (
                    <button className={styles.viewMoreLink} onClick={handleViewMoreMarked}>
                      {t('page.buttons.viewMore')}
                    </button>
                  )}
                </div>
                <div className={styles.sectionContent}>
                  {getFilteredFeeds(markedFeeds).length > 0 ? (
                    <div className={styles.feedGrid}>
                      {getFilteredFeeds(markedFeeds).map(feed => renderFeedCard(feed))}
                    </div>
                  ) : (
                    <div className={styles.emptyState}>
                      <img src="/assets/icon/SearchNoResult.png" alt={t('page.emptyState.noResult')} className={styles.noResultImage} />
                      <p>{searchQuery ? t('page.messages.noMarkedFeeds') : t('page.messages.noMarkedFeeds')}</p>
                    </div>
                  )}
                </div>
              </div>
              
              {/* 最近使用區域 */}
              <div className={styles.section}>
                <label className={styles.sectionLabel}>{t('page.sections.recent')}</label>
                <div className={styles.sectionContent}>
                  {getFilteredFeeds(recentFeeds).length > 0 ? (
                    <div className={styles.feedGrid}>
                      {getFilteredFeeds(recentFeeds).map(feed => renderFeedCard(feed))}
                    </div>
                  ) : (
                    <div className={styles.emptyState}>
                      <img src="/assets/icon/SearchNoResult.png" alt={t('page.emptyState.noResult')} className={styles.noResultImage} />
                      <p>{searchQuery ? t('page.messages.noRecentFeeds') : t('page.messages.noRecentFeeds')}</p>
                    </div>
                  )}
                </div>
              </div>
              
              {/* 所有飼料區域 */}
              <div className={styles.section}>
                <div className={styles.sectionHeader}>
                  <label className={styles.sectionLabel}>{t('page.sections.all')}</label>
                  {!searchQuery && (
                    <button className={styles.viewMoreLink} onClick={handleViewMoreAll}>
                      {t('page.buttons.viewMore')}
                    </button>
                  )}
                </div>
                <div className={styles.sectionContent}>
                  {getFilteredFeeds(allFeeds).length > 0 ? (
                    <div className={styles.feedGrid}>
                      {getFilteredFeeds(allFeeds).map(feed => renderFeedCard(feed))}
                    </div>
                  ) : (
                    <div className={styles.emptyState}>
                      <img src="/assets/icon/SearchNoResult.png" alt={t('page.emptyState.noResult')} className={styles.noResultImage} />
                      <p>{searchQuery ? t('page.messages.noAllFeeds') : t('page.messages.noAllFeeds')}</p>
                    </div>
                  )}
                </div>
              </div>
            </>
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
          feed={pendingFeedForReview || selectedFeed}
          isOpen={showReviewModal}
          onClose={handleReviewModalClose}
          onConfirm={handleReviewConfirm}
          onReportError={handleReportError}
        />
        
        <CreateFeedModal
          isOpen={showCreateFeedModal}
          onClose={handleCreateFeedClose}
          onConfirm={handleCreateFeedConfirm}
          defaultPetType="cat"
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

export default FeedPage;