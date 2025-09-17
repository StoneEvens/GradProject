import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import TopNavbar from '../components/TopNavbar';
import BottomNavbar from '../components/BottomNavigationbar';
import Notification from '../components/Notification';
import Annotation from '../components/Annotation';
import { NotificationProvider } from '../context/NotificationContext';
import { getUserProfile } from '../services/userService';
import styles from '../styles/PostPreviewPage.module.css';

// 開發環境下載入測試工具
if (process.env.NODE_ENV === 'development') {
  import('../utils/testPostAPI').then(module => {
    console.log('🔧 貼文發布測試工具已載入');
    console.log('在控制台輸入以下命令進行測試：');
    console.log('- testBasicPost() // 測試基本貼文');
    console.log('- testPostAPI() // 測試完整貼文');
  });
}

const PostPreviewPage = () => {
  const { t } = useTranslation('posts');
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState(null);
  const [selectedLocation, setSelectedLocation] = useState('');
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [notification, setNotification] = useState('');
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showAnnotationDots, setShowAnnotationDots] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false); // 新增發布狀態
  const [postData, setPostData] = useState({
    images: [],
    description: '',
    hashtags: []
  });

  // 草稿緩存的鍵名
  const DRAFT_KEY = 'createPostDraft';
  const ANNOTATIONS_KEY = 'imageAnnotations';

  // 清除所有暫存資料
  const clearAllCachedData = () => {
    try {
      // 清除草稿資料
      localStorage.removeItem(DRAFT_KEY);
      console.log('✅ 已清除草稿資料');
      
      // 清除圖片標註資料
      localStorage.removeItem(ANNOTATIONS_KEY);
      console.log('✅ 已清除圖片標註資料');
      
      // 清除其他可能的暫存資料
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        // 清除與當前貼文相關的暫存資料
        if (key && (key.includes('postDraft') || key.includes('imageAnnotations') || key.includes('annotationTemp'))) {
          keysToRemove.push(key);
        }
      }
      
      keysToRemove.forEach(key => {
        localStorage.removeItem(key);
        console.log(`✅ 已清除暫存資料: ${key}`);
      });
      
      console.log('🧹 所有暫存資料清理完成');
      
    } catch (error) {
      console.error('❌ 清除暫存資料失敗:', error);
    }
  };

  // 保留舊的 clearDraft 函數作為兼容性
  const clearDraft = () => {
    clearAllCachedData();
  };

  // 從 state 獲取貼文資料
  useEffect(() => {
    if (location.state) {
      setPostData(location.state);
      setCurrentImageIndex(0); // 重置圖片索引
    } else {
      // 如果沒有資料，返回上一頁
      navigate(-1);
    }
  }, [location.state, navigate]);

  // 獲取用戶資料
  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        const userProfile = await getUserProfile();
        setUser(userProfile);
      } catch (error) {
        console.error('獲取用戶資料失敗:', error);
        showNotification(t('editPost.messages.loadUserDataFailed'));
      }
    };

    fetchUserProfile();
  }, []);

  // 鍵盤導航支援
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (postData.images && postData.images.length > 1) {
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          handlePrevImage();
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          handleNextImage();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [postData.images]);

  // 顯示通知
  const showNotification = (msg) => {
    setNotification(msg);
  };

  // 隱藏通知
  const hideNotification = () => {
    setNotification('');
  };

  // 處理位置選擇
  const handleLocationSelect = (location) => {
    setSelectedLocation(location);
    setShowLocationModal(false);
  };

  // 切換標註點顯示
  const toggleAnnotationDots = () => {
    setShowAnnotationDots(!showAnnotationDots);
  };

  // 處理圖片滑動
  const handlePrevImage = () => {
    setCurrentImageIndex(prev => 
      prev > 0 ? prev - 1 : postData.images.length - 1
    );
    setShowAnnotationDots(false); // 切換圖片時隱藏標註點
  };

  const handleNextImage = () => {
    setCurrentImageIndex(prev => 
      prev < postData.images.length - 1 ? prev + 1 : 0
    );
    setShowAnnotationDots(false); // 切換圖片時隱藏標註點
  };

  // 處理觸控滑動
  const handleTouchStart = (e) => {
    const touch = e.touches[0];
    e.currentTarget.startX = touch.clientX;
  };

  const handleTouchEnd = (e) => {
    const touch = e.changedTouches[0];
    const diffX = e.currentTarget.startX - touch.clientX;
    
    // 滑動距離超過 50px 才切換圖片
    if (Math.abs(diffX) > 50) {
      if (diffX > 0) {
        handleNextImage(); // 向左滑動，下一張
      } else {
        handlePrevImage(); // 向右滑動，上一張
      }
    }
  };

  const locationOptions = t('postPreview.locationOptions', { returnObjects: true });

  // 返回編輯
  const handleBack = () => {
    navigate(-1);
  };

  // 發布貼文
  const handlePublish = async () => {
    if (!selectedLocation) {
      showNotification(t('editPost.messages.selectLocation'));
      return;
    }
    
    if (isPublishing) {
      return; // 防止重複發布
    }
    
    try {
      setIsPublishing(true);
      showNotification(t('postPreview.messages.processingImages'));
      
      // 準備圖片檔案和標註資料
      const processedImages = [];
      const allAnnotations = [];
      
      // 處理圖片和標註
      if (postData.images && postData.images.length > 0) {
        for (let imageIndex = 0; imageIndex < postData.images.length; imageIndex++) {
          const image = postData.images[imageIndex];
          
          // 準備圖片檔案
          let imageFile = null;
          
          if (image.file) {
            // 如果有原始檔案，直接使用
            imageFile = image.file;
          } else if (image.dataUrl) {
            // 如果只有 dataUrl，需要轉換為檔案
            try {
              const response = await fetch(image.dataUrl);
              const blob = await response.blob();
              imageFile = new File([blob], `image_${imageIndex}.jpg`, { 
                type: blob.type || 'image/jpeg' 
              });
            } catch (error) {
              console.error('轉換圖片失敗:', error);
              throw new Error(t('postPreview.messages.imageProcessError', { index: imageIndex + 1 }));
            }
          }
          
          if (imageFile) {
            processedImages.push(imageFile);
            
            // 處理該圖片的標註
            if (image.annotations && image.annotations.length > 0) {
              image.annotations.forEach(annotation => {
                allAnnotations.push({
                  image_index: imageIndex, // 標記這個標註屬於哪張圖片
                  x_position: annotation.x_position || annotation.x,
                  y_position: annotation.y_position || annotation.y,
                  display_name: annotation.display_name,
                  target_type: annotation.target_type || 'user',
                  target_id: annotation.target_id
                });
              });
            }
          }
        }
      }
      
      // 準備發布數據
      const publishData = {
        content: postData.description || '',
        location: selectedLocation,
        hashtags: postData.hashtags ? postData.hashtags.map(tag => {
          // 支援不同的 hashtag 數據格式
          return tag.tag || tag.text || (typeof tag === 'string' ? tag : '');
        }).filter(Boolean).join(',') : '',
        images: processedImages,
        annotations: allAnnotations
      };
      
      // 調試日誌
      console.log('🔍 發布資料調試:');
      console.log('原始 hashtags:', postData.hashtags);
      console.log('處理後 hashtags 字串:', publishData.hashtags);
      console.log('所有標註資料:', allAnnotations);
      console.log('寵物標註資料:', allAnnotations.filter(a => a.target_type === 'pet'));
      console.log('完整發布資料:', publishData);
      
      // 顯示上傳狀態
      showNotification(t('postPreview.messages.uploading'));
      
      // 調用發布 API
      const { createPost } = await import('../services/socialService');
      const result = await createPost(publishData);
      
      if (result.success) {
        // 清除所有暫存資料
        clearAllCachedData();
        
        // 重置組件狀態
        setPostData({
          images: [],
          description: '',
          hashtags: []
        });
        setSelectedLocation('');
        setCurrentImageIndex(0);
        setShowAnnotationDots(false);
        
        console.log('🎉 貼文發布成功，已清理所有暫存資料');
        showNotification(t('postPreview.messages.publishSuccess'));
        
        // 延遲導航，讓用戶看到成功訊息
        setTimeout(() => {
          navigate('/social');
        }, 1500);
      } else {
        throw new Error(result.error || t('postPreview.messages.publishFailed'));
      }
      
    } catch (error) {
      console.error('發布貼文失敗:', error);
      let errorMsg = error.message;
      
      // 友善的錯誤訊息
      if (errorMsg.includes('network') || errorMsg.includes('Network')) {
        errorMsg = t('postPreview.messages.networkError');
      } else if (errorMsg.includes('timeout')) {
        errorMsg = t('postPreview.messages.timeoutError');
      } else if (errorMsg.includes('大小')) {
        errorMsg = t('postPreview.messages.fileSizeError');
      }
      
      showNotification(t('postPreview.messages.publishError', { error: errorMsg }));
    } finally {
      setIsPublishing(false);
    }
  };

  if (!user || !postData.images) {
    return (
      <NotificationProvider>
        <div className={styles.container}>
          <TopNavbar />
          <div className={styles.loading}>{t('common.loading')}</div>
          <BottomNavbar />
        </div>
      </NotificationProvider>
    );
  }

  return (
    <NotificationProvider>
      <div className={styles.container}>
        <TopNavbar />
        {notification && (
          <Notification message={notification} onClose={hideNotification} />
        )}
        
        <div className={styles.content}>
          <h2 className={styles.title}>{t('postPreview.title')}</h2>
          <div className={styles.divider}></div>
          
          {/* 貼文預覽卡片 */}
          <div className={styles.postCard}>
            {/* 用戶資訊區域 */}
            <div className={styles.userInfo}>
              <img 
                src={user.headshot_url || '/assets/icon/DefaultAvatar.jpg'} 
                alt="用戶頭像" 
                className={styles.userAvatar}
              />
              <div className={styles.userDetails}>
                <h3 className={styles.userName}>{user.user_account}</h3>
                <button 
                  className={styles.locationButton}
                  onClick={() => setShowLocationModal(true)}
                >
                  {selectedLocation || t('editPost.ui.selectLocation')}
                </button>
              </div>
            </div>

            {/* 圖片區域 */}
            {postData.images && postData.images.length > 0 && (
              <div className={styles.imageSection}>
                <div 
                  className={styles.imageCarousel}
                  onTouchStart={handleTouchStart}
                  onTouchEnd={handleTouchEnd}
                  onWheel={(e) => {
                    if (postData.images.length > 1) {
                      e.preventDefault();
                      if (e.deltaY > 0) {
                        handleNextImage();
                      } else {
                        handlePrevImage();
                      }
                    }
                  }}
                >
                  {/* 主要圖片顯示 */}
                  <div className={styles.mainImageContainer}>
                    <img 
                      src={postData.images[currentImageIndex].dataUrl} 
                      alt={`貼文圖片 ${currentImageIndex + 1}`}
                      className={styles.postImage}
                    />
                    
                    {/* 標註圖示 - 左下角 */}
                    {postData.images[currentImageIndex].annotations && 
                     postData.images[currentImageIndex].annotations.length > 0 && (
                      <div 
                        className={styles.annotationIcon}
                        onClick={toggleAnnotationDots}
                        title={t('postPreview.ui.annotationsCount', { count: postData.images[currentImageIndex].annotations.length })}
                      >
                        <img 
                          src="/assets/icon/PostAnnotation.png" 
                          alt="標註" 
                          className={styles.annotationIconImage}
                          onError={(e) => {
                            console.error('Failed to load annotation icon:', e.target.src);
                            e.target.style.display = 'none';
                            e.target.parentElement.innerHTML = '@';
                            e.target.parentElement.style.fontSize = '14px';
                            e.target.parentElement.style.fontWeight = 'bold';
                            e.target.parentElement.style.color = '#F08651';
                          }}
                          onLoad={() => console.log('Annotation icon loaded successfully')}
                        />
                      </div>
                    )}
                    
                    {/* 標註點顯示 */}
                    {showAnnotationDots &&
                     postData.images[currentImageIndex].annotations && 
                     postData.images[currentImageIndex].annotations.length > 0 && 
                     postData.images[currentImageIndex].annotations.map((annotation) => (
                      <Annotation
                        key={annotation.id}
                        annotation={annotation}
                        x={annotation.x_position || annotation.x}
                        y={annotation.y_position || annotation.y}
                        isVisible={true}
                        onClick={() => {}} // PostPreviewPage 中標註只用於顯示，不需要編輯功能
                      />
                    ))}
                    
                    {/* 圖片指示器（只在多張圖片時顯示） */}
                    {postData.images.length > 1 && (
                      <div className={styles.imageIndicator}>
                        {currentImageIndex + 1}/{postData.images.length}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* 互動按鈕 */}
            <div className={styles.interactionButtons}>
              <button className={styles.likeButton}>
                <img src="/assets/icon/PostHeart.png" alt={t('postPreview.ui.like')} className={styles.interactionIcon} />
                <span>0</span>
              </button>
              <button className={styles.commentButton}>
                <img src="/assets/icon/PostComment.png" alt={t('postPreview.ui.comment')} className={styles.interactionIcon} />
                <span>0</span>
              </button>
              <button className={styles.shareButton}>
                <img src="/assets/icon/PostSave.png" alt={t('postPreview.ui.save')} className={styles.interactionIcon} />
                <span>0</span>
              </button>
            </div>

            {/* 描述文字 */}
            {postData.description && (
              <div className={styles.description}>
                {postData.description}
              </div>
            )}

            {/* Hashtag 區域 */}
            {postData.hashtags && postData.hashtags.length > 0 && (
              <div className={styles.hashtagSection}>
                {postData.hashtags.map((tag, index) => (
                  <span key={tag.id || index} className={styles.hashtag}>
                    #{tag.tag || tag.text || (typeof tag === 'string' ? tag : '')}
                  </span>
                ))}
              </div>
            )}

            {/* 時間顯示 */}
            <div className={styles.timeInfo}>
              {t('postPreview.ui.justNow')}
            </div>
          </div>

          {/* 操作按鈕 */}
          <div className={styles.actionButtons}>
            <button 
              className={styles.backButton}
              onClick={handleBack}
            >
              {t('common.back')}
            </button>
            <button 
              className={`${styles.publishButton} ${isPublishing ? styles.publishing : ''}`}
              onClick={handlePublish}
              disabled={isPublishing}
            >
              {isPublishing ? t('postPreview.ui.publishing') : t('postPreview.ui.publish')}
            </button>
          </div>
        </div>

        {/* 位置選擇 Modal */}
        {showLocationModal && (
          <div className={styles.modalOverlay} onClick={() => setShowLocationModal(false)}>
            <div className={styles.locationModal} onClick={(e) => e.stopPropagation()}>
              <h3 className={styles.modalTitle}>{t('editPost.ui.selectLocation')}</h3>
              <div className={styles.locationList}>
                {locationOptions.map((location) => (
                  <button
                    key={location}
                    className={styles.locationOption}
                    onClick={() => handleLocationSelect(location)}
                  >
                    {location}
                  </button>
                ))}
              </div>
              <button 
                className={styles.modalCloseButton}
                onClick={() => setShowLocationModal(false)}
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
        )}
        
        <BottomNavbar />
      </div>
    </NotificationProvider>
  );
};

export default PostPreviewPage; 