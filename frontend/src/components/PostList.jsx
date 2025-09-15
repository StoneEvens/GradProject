import React, { useState, useEffect, useCallback, useRef } from 'react';
import ReactDOM from 'react-dom';
import { useLocation } from 'react-router-dom';
import Post from './Post';
import Notification from './Notification';
import { getUserPosts } from '../services/socialService';
import { getUserProfile } from '../services/userService';
import styles from '../styles/PostList.module.css';
import PostComments from './PostComments';

const PostList = ({ 
  posts = [],
  loading = false,
  error = null,
  hasMore = false,
  onLoadMore = null,
  onLike = null,
  onComment = null,
  onSave = null,
  onDelete = null, // 新增刪除回調
  onUserClick = null,
  onHashtagClick = null,
  emptyMessage = '目前沒有貼文',
  className = '',
  style = {},
  // 新增 user 相關 props
  userId = null,
  targetPostId = null,
  targetPostIndex = null,
  fetchUserPosts = false,
  ...props
}) => {
  const location = useLocation();
  const [notification, setNotification] = useState('');
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [openComments, setIsOpen] = useState(false);
  const [postID, setPostID] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  
  // 用戶貼文相關狀態
  const [userPosts, setUserPosts] = useState([]);
  const [userLoading, setUserLoading] = useState(false);
  const [userError, setUserError] = useState(null);
  const [userHasMore, setUserHasMore] = useState(true);
  const [page, setPage] = useState(0);

  // 貼文元素的引用
  const postRefs = useRef({});
  const containerRef = useRef(null);
  
  // 標記是否已經滾動到目標貼文
  const hasScrolledToTarget = useRef(false);
  
  // 當組件卸載時重置滾動標記
  useEffect(() => {
    return () => {
      hasScrolledToTarget.current = false;
    };
  }, []);

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

  // 載入用戶貼文
  const loadUserPosts = useCallback(async (pageNum = 0, isLoadMore = false) => {
    try {
      if (!isLoadMore) {
        setUserLoading(true);
        setUserError(null);
      }
      
      const result = await getUserPosts(userId, {
        offset: pageNum * 10,
        limit: 10
      });
      
      if (result.success) {
        // 處理用戶貼文的數據格式 - 檢查不同的數據格式
        let rawPosts = [];
        
        if (result.data && result.data.posts) {
          // 新格式：data.posts
          rawPosts = result.data.posts;
        } else if (result.data && result.data.results) {
          // 舊的分頁格式：data.results
          rawPosts = result.data.results;
        } else if (Array.isArray(result.data)) {
          // 直接陣列格式
          rawPosts = result.data;
        }
        
        // 確保rawPosts是陣列
        if (!Array.isArray(rawPosts)) {
          console.warn('API回傳的貼文資料不是陣列格式:', rawPosts);
          rawPosts = [];
        }
        
        // 統一ID字段
        const newPosts = rawPosts.map(post => ({
            ...post,
            id: post.post_id || post.id, // 統一使用id字段
            content: {
              content_text: post.content_text || post.content?.content_text || '',
              location: post.location || post.content?.location || ''
            },
            // 保留所有其他欄位，包括 annotations
            annotations: post.annotations || [],
            images: post.images || [],
            hashtags: post.hashtags || [],
            user_info: post.user_info || post.user || {}
        }));
        
        if (isLoadMore) {
          setUserPosts(prevPosts => [...prevPosts, ...newPosts]);
        } else {
          setUserPosts(newPosts);
        }
        
        // 檢查是否還有更多資料
        if (result.data && typeof result.data === 'object' && 'has_more' in result.data) {
          setUserHasMore(result.data.has_more);
        } else {
          // 用戶貼文API可能沒有has_more字段，根據數量判斷
          setUserHasMore(newPosts.length === 10);
        }
        setPage(pageNum);
      } else {
        throw new Error(result.error || '載入用戶貼文失敗');
      }
    } catch (error) {
      console.error('載入用戶貼文失敗:', error);
      if (!isLoadMore) {
        setUserError(error.message);
        setUserPosts([]);
      }
    } finally {
      if (!isLoadMore) {
        setUserLoading(false);
      }
    }
  }, [userId]);

  // 初始載入用戶貼文
  useEffect(() => {
    if (fetchUserPosts && userId) {
      loadUserPosts(0, false);
    }
  }, [fetchUserPosts, userId, loadUserPosts]);

  // 監聽貼文更新
  useEffect(() => {
    if (location.state?.postUpdated && fetchUserPosts && userId) {
      console.log('PostList 檢測到貼文更新，重新載入用戶貼文');
      // 重新載入用戶貼文
      loadUserPosts(0, false);
    }
  }, [location.state, fetchUserPosts, userId, loadUserPosts]);

  // 滾動到指定貼文 - 只在第一次找到目標貼文時執行
  useEffect(() => {
    // 如果已經滾動過，或者沒有指定目標貼文，就不執行
    if (hasScrolledToTarget.current || (!targetPostId && targetPostIndex === null)) {
      return;
    }
    
    const currentPosts = fetchUserPosts ? userPosts : posts;
    console.log('PostList - 檢查是否需要滾動到指定貼文:', {
      targetPostId,
      targetPostIndex,
      fetchUserPosts,
      currentPostsLength: currentPosts.length,
      hasScrolled: hasScrolledToTarget.current
    });
    
    // 優先使用 targetPostIndex，如果沒有則使用 targetPostId
    if (currentPosts.length > 0) {
      let targetIndex = -1;
      
      if (targetPostIndex !== null && targetPostIndex >= 0 && targetPostIndex < currentPosts.length) {
        targetIndex = targetPostIndex;
      } else if (targetPostId) {
        targetIndex = currentPosts.findIndex(post => 
          (post.id || post.post_id) === targetPostId
        );
      }
      
      if (targetIndex >= 0) {
        // 標記已經找到並準備滾動
        hasScrolledToTarget.current = true;
        
        // 延遲執行，確保DOM已更新
        setTimeout(() => {
          const postElement = postRefs.current[targetIndex] || 
                            document.querySelector(`[data-post-id="${currentPosts[targetIndex].id || currentPosts[targetIndex].post_id}"]`);
          
          console.log('PostList - 執行滾動到貼文:', {
            targetIndex,
            targetPostId: currentPosts[targetIndex]?.id || currentPosts[targetIndex]?.post_id,
            postElement
          });
        
          if (postElement) {
            postElement.scrollIntoView({ 
              behavior: 'smooth', 
              block: 'center' 
            });
            // 高亮顯示該貼文
            postElement.style.animation = 'highlight 2s ease-in-out';
            console.log('PostList - 滾動和高亮完成');
          }
        }, 500);
      }
    }
  }, [targetPostId, targetPostIndex, userPosts, posts, fetchUserPosts]);

  // 處理無限滾動
  const handleScroll = useCallback(() => {
    const currentHasMore = fetchUserPosts ? userHasMore : hasMore;
    const currentLoading = fetchUserPosts ? userLoading : loading;
    
    if (!currentHasMore || isLoadingMore || currentLoading) return;

    // 檢查是否滾動到底部
    const scrollHeight = document.documentElement.scrollHeight;
    const scrollTop = document.documentElement.scrollTop;
    const clientHeight = document.documentElement.clientHeight;

    if (scrollTop + clientHeight >= scrollHeight - 100) {
      setIsLoadingMore(true);
      if (fetchUserPosts) {
        loadUserPosts(page + 1, true).finally(() => {
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
  }, [fetchUserPosts, userHasMore, hasMore, isLoadingMore, userLoading, loading, page, loadUserPosts, onLoadMore]);

  // 註冊滾動事件
  useEffect(() => {
    const currentHasMore = fetchUserPosts ? userHasMore : hasMore;
    const shouldListen = fetchUserPosts ? userHasMore : (hasMore && onLoadMore);
    
    if (shouldListen) {
      window.addEventListener('scroll', handleScroll);
      return () => window.removeEventListener('scroll', handleScroll);
    }
  }, [handleScroll, fetchUserPosts, userHasMore, hasMore, onLoadMore]);

  // 處理按讚 - 可選的通知回調
  const handleLike = (postId, isLiked) => {
    console.log('PostList 收到按讚通知:', { postId, isLiked });
    // Post 組件已經處理了所有邏輯，這裡只做可選的處理
    if (onLike) {
      onLike(postId, isLiked);
    }
  };

  // 處理留言
  const handleComment = (postID) => {
    setIsOpen(true);
    setPostID(postID);
  }

  const handleClose = () => {
    setIsOpen(false);
    setPostID(null);
  };

  // 處理留言數變化
  const handleCommentCountChange = (increment) => {
    if (!postID) return;
    
    // 更新對應貼文的留言數
    if (fetchUserPosts) {
      // 更新本地用戶貼文狀態
      setUserPosts(prevPosts => 
        prevPosts.map(post => {
          const currentPostId = post.id || post.post_id;
          if (currentPostId === postID) {
            return {
              ...post,
              interaction_stats: {
                ...post.interaction_stats,
                comments: (post.interaction_stats?.comments || 0) + increment
              }
            };
          }
          return post;
        })
      );
    } else {
      // 對於外部傳入的 posts，通過 onComment 回調通知父組件
      if (onComment) {
        onComment(postID, increment);
      }
    }
  };


  // 處理刪除 - 從列表移除已刪除的貼文
  const handleDelete = (postId) => {
    console.log('PostList 收到刪除通知:', { postId });
    
    if (fetchUserPosts) {
      // 從本地用戶貼文狀態中移除
      setUserPosts(prevPosts => prevPosts.filter(post => {
        const currentPostId = post.id || post.post_id;
        return currentPostId !== postId;
      }));
      showNotification('貼文已成功刪除');
    } else {
      // 通知父組件處理刪除
      if (onDelete) {
        onDelete(postId);
      }
    }
  };

  // 處理收藏 - 可選的通知回調
  const handleSave = (postId, isSaved) => {
    console.log('PostList 收到收藏通知:', { postId, isSaved });
    // Post 組件已經處理了所有邏輯，這裡只做可選的處理
    if (onSave) {
      onSave(postId, isSaved);
    }
  };

  // 處理用戶點擊
  const handleUserClick = (user) => {
    if (onUserClick) {
      onUserClick(user);
    }
  };

  // 決定使用哪組狀態
  const currentPosts = fetchUserPosts ? userPosts : posts;
  const currentLoading = fetchUserPosts ? userLoading : loading;
  const currentError = fetchUserPosts ? userError : error;
  const currentHasMore = fetchUserPosts ? userHasMore : hasMore;

  // 載入狀態
  if (currentLoading && currentPosts.length === 0) {
    return (
      <div className={`${styles.container} ${className}`} style={style}>
        <div className={styles.loading}>
          <div className={styles.spinner}></div>
          <p>載入貼文中...</p>
        </div>
      </div>
    );
  }

  // 錯誤狀態
  if (currentError && currentPosts.length === 0) {
    return (
      <div className={`${styles.container} ${className}`} style={style}>
        {notification && (
          <Notification message={notification} onClose={hideNotification} />
        )}
        <div className={styles.error}>
          <p>載入失敗: {currentError}</p>
          <button 
            className={styles.retryButton}
            onClick={() => {
              if (fetchUserPosts) {
                loadUserPosts(0, false);
              } else {
                window.location.reload();
              }
            }}
          >
            重試
          </button>
        </div>
      </div>
    );
  }

  // 空狀態
  if (!currentLoading && currentPosts.length === 0) {
    return (
      <div className={`${styles.container} ${className}`} style={style}>
        {notification && (
          <Notification message={notification} onClose={hideNotification} />
        )}
        <div className={styles.empty}>
          <img 
            src="/assets/icon/SearchNoResult.png" 
            alt="空狀態" 
            className={styles.emptyIcon}
          />
          <p>{fetchUserPosts ? '該用戶尚未發布任何貼文' : emptyMessage}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`${styles.container} ${className}`} style={style}>
      {notification && (
        <Notification message={notification} onClose={hideNotification} />
      )}
      
      <div className={styles.postList} ref={containerRef}>
        {currentPosts
          .filter(post => {
            // 簡單方法：只顯示有圖片的貼文
            const hasImages = post.images && Array.isArray(post.images) && post.images.length > 0;

            // 簡化調試輸出
            if (!hasImages) {
              console.log(`🚫 PostList 過濾掉沒有圖片的項目 (ID: ${post.id || post.post_id})`);
            }

            return hasImages;
          })
          .map((post, index) => (
            <div
              key={post.id || post.post_id || index}
              data-post-id={post.id || post.post_id}
              ref={el => postRefs.current[index] = el}
            >
              <Post
                postData={post}
                onLike={handleLike}
                onComment={() => handleComment(post.id || post.post_id)}
                onSave={handleSave}
                onDelete={handleDelete}
                onUserClick={handleUserClick}
                onHashtagClick={onHashtagClick}
                isInteractive={true}
                showFullDescription={true}
              />
            </div>
          ))}
      </div>

      {/* 載入更多指示器 */}
      {(isLoadingMore || (currentLoading && currentPosts.length > 0)) && (
        <div className={styles.loadingMore}>
          <div className={styles.spinner}></div>
          <p>載入更多...</p>
        </div>
      )}

      {/* 沒有更多內容提示 */}
      {!currentHasMore && currentPosts.length > 0 && (
        <div className={styles.noMore}>
          <p>- 沒有更多貼文了 -</p>
        </div>
      )}

      {openComments ? <PostComments
        user={currentUser}
        postID={postID}
        handleClose={handleClose}
        onCommentCountChange={handleCommentCountChange}
      /> : null}

    </div>
  );
};

export default PostList; 