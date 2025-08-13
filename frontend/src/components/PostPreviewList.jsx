import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from '../styles/PostPreviewList.module.css';

const PostPreviewList = ({ 
  posts = [], 
  loading = false, 
  error = null, 
  emptyMessage = '尚未發布任何貼文',
  userId = null,
  userAccount = null,
  isSearchResult = false,
  isLikedPosts = false,
  isSavedPosts = false,
  isPetRelatedPosts = false,
  petId = null,
  style = {},
  // 新增分頁相關 props
  hasMore = false,
  onLoadMore = null,
  enableProgressiveLoading = false
}) => {
  const navigate = useNavigate();
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // 處理無限滾動
  const handleScroll = useCallback(() => {
    if (!enableProgressiveLoading || !hasMore || isLoadingMore || loading || !onLoadMore) return;

    // 檢查是否滾動到底部
    const scrollHeight = document.documentElement.scrollHeight;
    const scrollTop = document.documentElement.scrollTop;
    const clientHeight = document.documentElement.clientHeight;

    if (scrollTop + clientHeight >= scrollHeight - 200) { // 提前200px觸發載入
      setIsLoadingMore(true);
      onLoadMore().finally(() => {
        setIsLoadingMore(false);
      });
    }
  }, [enableProgressiveLoading, hasMore, isLoadingMore, loading, onLoadMore]);

  // 註冊滾動事件
  useEffect(() => {
    if (enableProgressiveLoading && hasMore && onLoadMore) {
      window.addEventListener('scroll', handleScroll);
      return () => window.removeEventListener('scroll', handleScroll);
    }
  }, [handleScroll, enableProgressiveLoading, hasMore, onLoadMore]);

  // 處理點擊貼文預覽
  const handlePostClick = (post) => {
    const postId = post.id || post.post_id;
    
    if (isSearchResult) {
      // 如果是搜尋結果，導航到搜尋結果PostList頁面
      navigate(`/search-posts`, { 
        state: { 
          searchPosts: posts,
          targetPostId: postId
        } 
      });
    } else if (isLikedPosts) {
      // 如果是按讚貼文，導航到按讚貼文列表頁面
      navigate(`/liked-posts-list`, { 
        state: { 
          likedPosts: posts,
          targetPostId: postId
        } 
      });
    } else if (isSavedPosts) {
      // 如果是收藏貼文，導航到收藏貼文列表頁面
      navigate(`/saved-posts-list`, { 
        state: { 
          savedPosts: posts,
          targetPostId: postId
        } 
      });
    } else if (isPetRelatedPosts) {
      // 如果是寵物相關貼文，導航到寵物相關貼文列表頁面
      navigate(`/pet/${petId}/posts-list`, { 
        state: { 
          relatedPosts: posts,
          targetPostId: postId
        } 
      });
    } else {
      // 如果有 userAccount，導航到該用戶的貼文頁面
      if (userAccount) {
        navigate(`/user/${userAccount}/posts`, { 
          state: { 
            targetPostId: postId,
            userId: userId
          } 
        });
      } else {
        // 沒有 userAccount，導航到當前用戶的貼文頁面
        navigate(`/user-posts`, { 
          state: { 
            targetPostId: postId,
            userId: userId
          } 
        });
      }
    }
  };

  // 載入狀態
  if (loading) {
    return (
      <div className={styles.container} style={style}>
        <div className={styles.loading}>
          <div className={styles.spinner}></div>
          <p>載入貼文預覽中...</p>
        </div>
      </div>
    );
  }

  // 錯誤狀態
  if (error) {
    return (
      <div className={styles.container} style={style}>
        <div className={styles.error}>
          <p>載入失敗: {error}</p>
          <button 
            className={styles.retryButton}
            onClick={() => window.location.reload()}
          >
            重試
          </button>
        </div>
      </div>
    );
  }

  // 空狀態
  if (!posts || posts.length === 0) {
    return (
      <div className={styles.container} style={style}>
        <div className={styles.empty}>
          <img 
            src="/assets/icon/SearchNoResult.png" 
            alt="空狀態" 
            className={styles.emptyIcon}
          />
          <p>{emptyMessage}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container} style={style}>
      <div className={styles.photoGrid}>
        {posts.map((post, index) => (
          <div 
            key={post.id || post.post_id || `post-${index}`} 
            className={styles.photoCell}
            onClick={() => handlePostClick(post)}
          >
            {(post.first_image_url || 
              post.images?.length > 0 || 
              post.firebase_url) ? (
              <img 
                src={post.first_image_url || 
                     post.images?.[0]?.firebase_url || 
                     post.images?.[0]?.url || 
                     post.firebase_url} 
                alt={`貼文-${index + 1}`} 
                className={styles.postImage}
                loading="lazy"
              />
            ) : (
              <div className={styles.noImagePlaceholder}>
                <div className={styles.textContent}>
                  {post.content?.content_text || 
                   post.content_text || 
                   post.content || 
                   post.description || 
                   post.caption ||
                   post.text ||
                   '無內容'}
                </div>
              </div>
            )}
            
            {/* 貼文指示器 */}
            <div className={styles.postIndicator}>
              <div className={styles.postInfo}>
                <span className={styles.postDate}>
                  {new Date(post.created_at).toLocaleDateString('zh-TW', {
                    month: 'short',
                    day: 'numeric'
                  })}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {/* 載入更多指示器 */}
      {enableProgressiveLoading && hasMore && (isLoadingMore || loading) && (
        <div className={styles.loadingMore}>
          <div className={styles.spinner}></div>
          <p>載入更多貼文中...</p>
        </div>
      )}
      
      {/* 沒有更多內容指示器 */}
      {enableProgressiveLoading && !hasMore && posts.length > 0 && (
        <div className={styles.noMore}>
          <p>已載入所有貼文</p>
        </div>
      )}
    </div>
  );
};

export default PostPreviewList; 