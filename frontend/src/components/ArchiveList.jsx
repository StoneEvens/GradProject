import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import ArchivePreviewForPublic from './ArchivePreviewForPublic';
import Notification from './Notification';
import PostComments from './PostComments';
import { getUserProfile } from '../services/userService';
import { getPublicDiseaseArchivesPreview, getUserPublicDiseaseArchivesPreview, getDiseaseArchiveDetail } from '../services/petService';
import styles from '../styles/ArchiveList.module.css';

const ArchiveList = ({ 
  archives = [],
  loading = false,
  error = null,
  hasMore = false,
  onLoadMore = null,
  onLike = null,
  onComment = null,
  onSave = null,
  onUserClick = null,
  onMenuClick = null,
  onArchiveDelete = null,  // 新增：檔案刪除回調
  emptyMessage = '目前沒有疾病檔案',
  className = '',
  style = {},
  // 新增 user 相關 props
  userId = null,
  targetArchiveId = null,
  targetArchiveIndex = null,
  fetchUserArchives = false,
  ...props
}) => {
  const { t } = useTranslation('profile');
  const location = useLocation();
  const [notification, setNotification] = useState('');
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [showComments, setShowComments] = useState(false);
  const [selectedArchiveId, setSelectedArchiveId] = useState(null);
  const [selectedPostFrameId, setSelectedPostFrameId] = useState(null);
  
  // 用戶檔案相關狀態
  const [userArchives, setUserArchives] = useState([]);
  const [userLoading, setUserLoading] = useState(false);
  const [userError, setUserError] = useState(null);
  const [userHasMore, setUserHasMore] = useState(true);
  const [page, setPage] = useState(0);

  // 檔案元素的引用
  const archiveRefs = useRef({});
  const containerRef = useRef(null);

  // 獲取當前用戶資訊
  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const userProfile = await getUserProfile();
        setCurrentUser(userProfile);
      } catch (error) {
        console.error('獲取用戶資料失敗:', error);
      }
    };
    
    fetchCurrentUser();
  }, []);

  // 顯示通知
  const showNotification = (message) => {
    setNotification(message);
  };

  // 隱藏通知
  const hideNotification = () => {
    setNotification('');
  };

  // 載入用戶檔案
  const loadUserArchives = useCallback(async (pageNum = 0, isLoadMore = false) => {
    try {
      if (!isLoadMore) {
        setUserLoading(true);
        setUserError(null);
      }
      
      // 呼叫用戶檔案API
      const result = await getUserPublicDiseaseArchivesPreview(userId, {
        offset: pageNum * 10,
        limit: 10
      });
      
      if (result.success) {
        const newArchives = result.data?.archives || [];
        
        if (isLoadMore) {
          setUserArchives(prevArchives => [...prevArchives, ...newArchives]);
        } else {
          setUserArchives(newArchives);
        }
        
        setUserHasMore(result.data?.has_more || false);
        setPage(pageNum);
      } else {
        throw new Error(result.error || '載入用戶檔案失敗');
      }
    } catch (error) {
      console.error('載入用戶檔案失敗:', error);
      if (!isLoadMore) {
        setUserError(error.message);
        setUserArchives([]);
      }
    } finally {
      if (!isLoadMore) {
        setUserLoading(false);
      }
    }
  }, [userId]);

  // 初始載入用戶檔案
  useEffect(() => {
    if (fetchUserArchives && userId) {
      loadUserArchives(0, false);
    }
  }, [fetchUserArchives, userId, loadUserArchives]);

  // 監聽檔案更新
  useEffect(() => {
    if (location.state?.archiveUpdated && fetchUserArchives && userId) {
      console.log('ArchiveList 檢測到檔案更新，重新載入用戶檔案');
      loadUserArchives(0, false);
    }
  }, [location.state, fetchUserArchives, userId, loadUserArchives]);

  // 滾動到指定檔案
  useEffect(() => {
    const currentArchives = fetchUserArchives ? userArchives : archives;
    console.log('ArchiveList - 滾動到指定檔案:', {
      targetArchiveId,
      targetArchiveIndex,
      fetchUserArchives,
      currentArchivesLength: currentArchives.length,
      currentArchives: currentArchives.map(a => a.id)
    });
    
    if (currentArchives.length > 0) {
      let targetIndex = -1;
      
      if (targetArchiveIndex !== null && targetArchiveIndex >= 0 && targetArchiveIndex < currentArchives.length) {
        targetIndex = targetArchiveIndex;
      } else if (targetArchiveId) {
        targetIndex = currentArchives.findIndex(archive => archive.id === targetArchiveId);
      }
      
      if (targetIndex >= 0) {
        setTimeout(() => {
          const archiveElement = archiveRefs.current[targetIndex] || 
                                document.querySelector(`[data-archive-id="${currentArchives[targetIndex].id}"]`);
          
          if (archiveElement) {
            archiveElement.scrollIntoView({ 
              behavior: 'smooth', 
              block: 'center' 
            });
            archiveElement.style.animation = 'highlight 2s ease-in-out';
          }
        }, 500);
      }
    }
  }, [targetArchiveId, targetArchiveIndex, userArchives, archives, fetchUserArchives]);

  // 處理無限滾動
  const handleScroll = useCallback(() => {
    const currentHasMore = fetchUserArchives ? userHasMore : hasMore;
    const currentLoading = fetchUserArchives ? userLoading : loading;
    
    if (!currentHasMore || isLoadingMore || currentLoading) return;

    const scrollHeight = document.documentElement.scrollHeight;
    const scrollTop = document.documentElement.scrollTop;
    const clientHeight = document.documentElement.clientHeight;

    if (scrollTop + clientHeight >= scrollHeight - 100) {
      setIsLoadingMore(true);
      if (fetchUserArchives) {
        loadUserArchives(page + 1, true).finally(() => {
          setIsLoadingMore(false);
        });
      } else if (onLoadMore) {
        onLoadMore().finally(() => {
          setIsLoadingMore(false);
        });
      } else {
        setIsLoadingMore(false);
      }
    }
  }, [fetchUserArchives, userHasMore, hasMore, isLoadingMore, userLoading, loading, page, loadUserArchives, onLoadMore]);

  // 註冊滾動事件
  useEffect(() => {
    const shouldListen = fetchUserArchives ? userHasMore : (hasMore && onLoadMore);
    
    if (shouldListen) {
      window.addEventListener('scroll', handleScroll);
      return () => window.removeEventListener('scroll', handleScroll);
    }
  }, [handleScroll, fetchUserArchives, userHasMore, hasMore, onLoadMore]);

  // 處理按讚（暫未實作）
  const handleLike = (archiveId, isLiked) => {
    console.log('疾病檔案按讚功能暫未實作');
    // 暫時不調用父組件的 onLike
  };

  // 處理留言
  const handleComment = (archiveId) => {
    console.log('ArchiveList 收到留言通知:', { archiveId });
    
    // 找到對應的檔案資料
    const archive = currentArchives.find(a => a.id === archiveId) || 
                   userArchives?.find(a => a.id === archiveId);
    
    if (archive?.postFrame) {
      setSelectedArchiveId(archiveId);
      setSelectedPostFrameId(archive.postFrame);
      setShowComments(true);
    } else {
      console.error('找不到檔案的 postFrame:', archiveId);
    }
  };

  // 處理留言彈窗關閉
  const handleCommentsClose = () => {
    setShowComments(false);
    setSelectedArchiveId(null);
    setSelectedPostFrameId(null);
    
    // 不在這裡重新載入資料，因為 handleCommentCountChange 已經更新了本地狀態
    console.log('Comments closed, local state should already be updated');
  };

  // 處理留言數變化
  const handleCommentCountChange = (increment) => {
    if (!selectedArchiveId) return;
    
    console.log('handleCommentCountChange called:', { selectedArchiveId, increment, fetchUserArchives });
    
    if (fetchUserArchives) {
      // 更新用戶檔案狀態
      setUserArchives(prevArchives => 
        prevArchives.map(archive => {
          if (archive.id === selectedArchiveId) {
            const oldCount = archive.interaction_stats?.comments || 0;
            const newCount = oldCount + increment;
            console.log('Updating user archive comment count:', { 
              archiveId: archive.id, 
              oldCount, 
              increment, 
              newCount 
            });
            return {
              ...archive,
              interaction_stats: {
                ...archive.interaction_stats,
                comments: newCount
              }
            };
          }
          return archive;
        })
      );
    } else {
      // 對於外部傳入的 archives，通知父組件
      if (onComment) {
        console.log('Notifying parent component of comment change:', { selectedArchiveId, increment });
        onComment(selectedArchiveId, increment);
      }
    }
  };

  // 處理收藏（暫未實作）
  const handleSave = (archiveId, isSaved) => {
    console.log('疾病檔案收藏功能暫未實作');
    // 暫時不調用父組件的 onSave
  };

  // 處理菜單點擊
  const handleMenuClick = (archiveId) => {
    console.log('ArchiveList 收到菜單點擊:', { archiveId });
    if (onMenuClick) {
      onMenuClick(archiveId);
    }
  };

  // 處理檔案刪除或轉為私人
  const handleArchiveDelete = (archiveId) => {
    console.log('ArchiveList 收到檔案刪除通知:', { archiveId, fetchUserArchives });
    
    if (fetchUserArchives) {
      // 從用戶檔案列表中移除
      setUserArchives(prevArchives => 
        prevArchives.filter(archive => archive.id !== archiveId)
      );
    } else {
      // 對於外部傳入的 archives，通知父組件
      if (onArchiveDelete) {
        onArchiveDelete(archiveId);
      }
    }
  };

  // 處理用戶點擊
  const handleUserClick = (user) => {
    if (onUserClick) {
      onUserClick(user);
    }
  };

  // 決定使用哪組狀態
  const currentArchives = fetchUserArchives ? userArchives : archives;
  const currentLoading = fetchUserArchives ? userLoading : loading;
  const currentError = fetchUserArchives ? userError : error;
  const currentHasMore = fetchUserArchives ? userHasMore : hasMore;

  // 載入狀態
  if (currentLoading && currentArchives.length === 0) {
    return (
      <div className={`${styles.container} ${className}`} style={style}>
        <div className={styles.loading}>
          <div className={styles.spinner}></div>
          <p>{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  // 錯誤狀態
  if (currentError && currentArchives.length === 0) {
    return (
      <div className={`${styles.container} ${className}`} style={style}>
        {notification && (
          <Notification message={notification} onClose={hideNotification} />
        )}
        <div className={styles.error}>
          <p>{t('archiveList.loadFailed')}: {currentError}</p>
          <button
            className={styles.retryButton}
            onClick={() => {
              if (fetchUserArchives) {
                loadUserArchives(0, false);
              } else {
                window.location.reload();
              }
            }}
          >
            {t('archiveList.retry')}
          </button>
        </div>
      </div>
    );
  }

  // 空狀態
  if (!currentLoading && currentArchives.length === 0) {
    return (
      <div className={`${styles.container} ${className}`} style={style}>
        {notification && (
          <Notification message={notification} onClose={hideNotification} />
        )}
        <div className={styles.empty}>
          <img
            src="/assets/icon/SearchNoResult.png"
            alt={t('archiveList.emptyStateAlt')}
            className={styles.emptyIcon}
          />
          <p>{fetchUserArchives ? t('archiveList.noUserArchives') : emptyMessage}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`${styles.container} ${className}`} style={style}>
      {notification && (
        <Notification message={notification} onClose={hideNotification} />
      )}
      
      <div className={styles.archiveList} ref={containerRef}>
        {currentArchives.map((archive, index) => (
          <div 
            key={archive.id || index} 
            data-archive-id={archive.id}
            ref={el => archiveRefs.current[index] = el}
          >
            <ArchivePreviewForPublic
              archiveData={archive}
              user={archive.user_info}  // 檔案擁有者資訊
              pet={archive.pet_info}
              currentUser={currentUser}  // 當前登入用戶
              onLike={(isLiked) => handleLike(archive.id, isLiked)}
              onComment={() => handleComment(archive.id)}
              onSave={(isSaved) => handleSave(archive.id, isSaved)}
              onMenuClick={() => handleMenuClick(archive.id)}
              onDelete={(archiveId) => handleArchiveDelete(archiveId)}
              onShowNotification={showNotification}
            />
          </div>
        ))}
      </div>

      {/* 載入更多指示器 */}
      {(isLoadingMore || (currentLoading && currentArchives.length > 0)) && (
        <div className={styles.loadingMore}>
          <div className={styles.spinner}></div>
          <p>{t('archiveList.loadingMore')}</p>
        </div>
      )}

      {/* 沒有更多內容提示 */}
      {!currentHasMore && currentArchives.length > 0 && (
        <div className={styles.noMore}>
          <p>- {t('archiveList.noMoreArchives')} -</p>
        </div>
      )}

      {/* 留言彈窗 */}
      {showComments && selectedPostFrameId && (
        <PostComments
          postID={selectedPostFrameId}
          user={currentUser}
          handleClose={handleCommentsClose}
          onCommentCountChange={handleCommentCountChange}
        />
      )}
    </div>
  );
};

export default ArchiveList;