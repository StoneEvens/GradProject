import React, { useState, useEffect, useCallback } from 'react';
import Post from './Post';
import Notification from './Notification';
import { getUserPosts } from '../services/socialService';
import styles from '../styles/PostList.module.css';

const PostList = ({ 
  posts = [],
  loading = false,
  error = null,
  hasMore = false,
  onLoadMore = null,
  onLike = null,
  onComment = null,
  onSave = null,
  onUserClick = null,
  onHashtagClick = null,
  emptyMessage = '目前沒有貼文',
  className = '',
  style = {},
  // 新增 user 相關 props
  userId = null,
  targetPostId = null,
  fetchUserPosts = false,
  ...props
}) => {
  const [notification, setNotification] = useState('');
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  
  // 用戶貼文相關狀態
  const [userPosts, setUserPosts] = useState([]);
  const [userLoading, setUserLoading] = useState(false);
  const [userError, setUserError] = useState(null);
  const [userHasMore, setUserHasMore] = useState(true);
  const [page, setPage] = useState(0);

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
        // 處理用戶貼文的數據格式 - 檢查是否為分頁格式
        let rawPosts = result.data || [];
        
        // 如果是分頁格式（包含results字段），取出results
        if (rawPosts && typeof rawPosts === 'object' && rawPosts.results) {
          rawPosts = rawPosts.results;
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

  // 滾動到指定貼文
  useEffect(() => {
    const currentPosts = fetchUserPosts ? userPosts : posts;
    console.log('PostList - 滾動到指定貼文:', {
      targetPostId,
      fetchUserPosts,
      currentPostsLength: currentPosts.length,
      currentPosts: currentPosts.map(p => p.id || p.post_id)
    });
    
    if (targetPostId && currentPosts.length > 0) {
      // 延遲執行，確保DOM已更新
      setTimeout(() => {
        const postElement = document.querySelector(`[data-post-id="${targetPostId}"]`);
        console.log('PostList - 查找貼文元素:', {
          targetPostId,
          postElement,
          allDataPostIds: Array.from(document.querySelectorAll('[data-post-id]')).map(el => el.getAttribute('data-post-id'))
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
  }, [targetPostId, userPosts, posts, fetchUserPosts]);

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

  // 處理按讚
  const handleLike = async (postId, isLiked) => {
    try {
      if (onLike) {
        await onLike(postId, isLiked);
      } else if (fetchUserPosts) {
        // 更新用戶貼文的本地狀態
        setUserPosts(prevPosts => 
          prevPosts.map(post => 
            post.id === postId 
              ? { 
                  ...post, 
                  is_liked: isLiked,
                  like_count: isLiked ? (post.like_count || 0) + 1 : Math.max(0, (post.like_count || 0) - 1)
                }
              : post
          )
        );
      }
      // 可以在這裡添加成功的回饋
    } catch (error) {
      console.error('按讚失敗:', error);
      showNotification('按讚失敗，請稍後再試');
    }
  };

  // 處理留言
  const handleComment = (postId) => {
    if (onComment) {
      onComment(postId);
    }
  };

  // 處理收藏
  const handleSave = async (postId, isSaved) => {
    try {
      if (onSave) {
        await onSave(postId, isSaved);
      } else if (fetchUserPosts) {
        // 更新用戶貼文的本地狀態
        setUserPosts(prevPosts => 
          prevPosts.map(post => 
            post.id === postId 
              ? { ...post, is_saved: isSaved }
              : post
          )
        );
      }
      showNotification(isSaved ? '已收藏' : '已取消收藏');
    } catch (error) {
      console.error('收藏操作失敗:', error);
      showNotification('操作失敗，請稍後再試');
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
      
      <div className={styles.postList}>
        {currentPosts.map((post, index) => (
          <div key={post.id || post.post_id || index} data-post-id={post.id || post.post_id}>
            <Post
              postData={post}
              onLike={handleLike}
              onComment={handleComment}
              onSave={handleSave}
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
    </div>
  );
};

export default PostList; 