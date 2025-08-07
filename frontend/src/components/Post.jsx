import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Annotation from './Annotation';
import ConfirmNotification from './ConfirmNotification';
import styles from '../styles/Post.module.css';
import { togglePostLike, togglePostSave } from '../services/socialService';
import { getUserProfile } from '../services/userService';
import PostComments from './PostComments';

const Post = ({ 
  postData,
  onLike,
  onComment,
  onSave,
  onUserClick,
  onHashtagClick,
  isInteractive = true, // 是否允許互動（按讚、留言等）
  showFullDescription = false, // 是否顯示完整描述
  className = '' // 額外的 CSS 類名
}) => {
  const navigate = useNavigate();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showAnnotationDots, setShowAnnotationDots] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [commentCount, setCommentCount] = useState(0);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const moreMenuRef = useRef(null);

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

  // 初始化互動狀態
  useEffect(() => {
    if (postData) {
      // 支援不同的互動數據格式
      const userInteraction = postData.user_interaction || {};
      const interactionStats = postData.interaction_stats || {};
      
      // 優先使用 user_interaction 中的狀態，因為它更準確
      const newIsLiked = userInteraction.is_liked ?? postData.is_liked ?? false;
      const newIsSaved = userInteraction.is_saved ?? postData.is_saved ?? false;
      const newLikeCount = interactionStats.likes ?? postData.like_count ?? 0;
      const newCommentCount = interactionStats.comments ?? postData.comment_count ?? 0;
      
      console.log('Post 初始化狀態:', {
        postId: postData.id,
        newIsLiked,
        newIsSaved,
        userInteraction,
        postData_is_saved: postData.is_saved
      });
      
      setIsLiked(newIsLiked);
      setIsSaved(newIsSaved);
      setLikeCount(newLikeCount);
      setCommentCount(newCommentCount);
      setCurrentImageIndex(0);
      setShowAnnotationDots(false);
    }
  }, [postData]);

  // 鍵盤導航支援
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (postData?.images && postData.images.length > 1) {
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
  }, [postData?.images]);

  // 點擊外部關閉選單
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(event.target)) {
        setShowMoreMenu(false);
      }
    };

    if (showMoreMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showMoreMenu]);

  // 處理圖片載入錯誤
  const handleImageError = (e) => {
    e.target.src = '/assets/icon/DefaultAvatar.jpg';
  };

  // 格式化時間顯示
  const formatTimeDisplay = (timestamp) => {
    if (!timestamp) return '剛剛';
    
    const now = new Date();
    const postTime = new Date(timestamp);
    const diffInSeconds = Math.floor((now - postTime) / 1000);
    
    if (diffInSeconds < 60) return '剛剛';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}分鐘前`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}小時前`;
    if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)}天前`;
    
    return postTime.toLocaleDateString('zh-TW');
  };

  // 切換標註點顯示
  const toggleAnnotationDots = () => {
    setShowAnnotationDots(!showAnnotationDots);
  };

  // 處理圖片滑動
  const handlePrevImage = () => {
    if (!postData?.images || postData.images.length <= 1) return;
    setCurrentImageIndex(prev => 
      prev > 0 ? prev - 1 : postData.images.length - 1
    );
    setShowAnnotationDots(false);
  };

  const handleNextImage = () => {
    if (!postData?.images || postData.images.length <= 1) return;
    setCurrentImageIndex(prev => 
      prev < postData.images.length - 1 ? prev + 1 : 0
    );
    setShowAnnotationDots(false);
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

  // 處理用戶點擊
  const handleUserClick = () => {
    const userInfo = postData.user_info || postData.user;
    if (onUserClick) {
      onUserClick(userInfo);
    } else if (userInfo?.user_account) {
      navigate(`/user/${userInfo.user_account}`);
    }
  };

  // 處理按讚 - Post 組件完全自主處理
  const handleLike = async () => {
    if (!isInteractive) return;
    
    const originalIsLiked = isLiked;
    const originalLikeCount = likeCount;
    const newIsLiked = !isLiked;
    const newLikeCount = newIsLiked ? likeCount + 1 : Math.max(0, likeCount - 1);
    
    console.log('Post 按讚操作:', {
      postId: postData.id,
      從: originalIsLiked ? '已按讚' : '未按讚',
      到: newIsLiked ? '已按讚' : '未按讚',
      讚數變化: `${originalLikeCount} → ${newLikeCount}`
    });
    
    // 樂觀更新 UI - 立即反映用戶操作
    setIsLiked(newIsLiked);
    setLikeCount(newLikeCount);
    
    try {
      // 調用 API 切換按讚狀態
      const result = await togglePostLike(postData.id);
      
      if (!result.success) {
        // API 失敗，還原 UI 狀態
        setIsLiked(originalIsLiked);
        setLikeCount(originalLikeCount);
        console.error('按讚操作失敗:', result.error);
        return;
      }
      
      console.log('按讚操作成功:', result.message);
      
      // 可選：通知父組件（用於統計等目的）
      if (onLike) {
        onLike(postData.id, newIsLiked);
      }
    } catch (error) {
      // 網路錯誤，還原 UI 狀態
      console.error('按讚 API 調用異常:', error);
      setIsLiked(originalIsLiked);
      setLikeCount(originalLikeCount);
    }
  };

  // 處理留言
  const handleComment = () => {
    if (!isInteractive) return;
    
    if (onComment) {
      onComment(postData.id);
    } else {
      // 預設導航到貼文詳情頁面
      navigate(`/post/${postData.id}`);
    }
  };

  // 處理收藏 - Post 組件完全自主處理
  const handleSave = async () => {
    if (!isInteractive) return;
    
    const originalIsSaved = isSaved;
    const newIsSaved = !isSaved;
    
    console.log('Post 收藏操作:', {
      postId: postData.id,
      從: originalIsSaved ? '已收藏' : '未收藏',
      到: newIsSaved ? '已收藏' : '未收藏'
    });
    
    // 樂觀更新 UI - 立即反映用戶操作
    setIsSaved(newIsSaved);
    
    try {
      // 調用 API 切換收藏狀態
      const result = await togglePostSave(postData.id);
      
      if (!result.success) {
        // API 失敗，還原 UI 狀態
        setIsSaved(originalIsSaved);
        console.error('收藏操作失敗:', result.error);
        // 可以在這裡顯示錯誤提示給用戶
        return;
      }
      
      console.log('收藏操作成功:', result.message);
      
      // 可選：通知父組件（用於統計等目的）
      if (onSave) {
        onSave(postData.id, newIsSaved);
      }
    } catch (error) {
      // 網路錯誤，還原 UI 狀態
      console.error('收藏 API 調用異常:', error);
      setIsSaved(originalIsSaved);
      // 可以在這裡顯示網路錯誤提示給用戶
    }
  };

  // 處理位置點擊
  const handleLocationClick = () => {
    const location = postData.content?.location || postData.location;
    if (location) {
      // 可以導航到位置相關頁面或顯示地圖
      console.log('點擊位置:', location);
    }
  };

  // 處理 hashtag 點擊
  const handleHashtagClick = (hashtag) => {
    // 取得 hashtag 文字，支援不同的數據格式
    const tagText = hashtag.tag || hashtag.text || (typeof hashtag === 'string' ? hashtag : '');
    if (tagText) {
      if (onHashtagClick) {
        // 如果有自定義的 hashtag 點擊處理器，使用它
        onHashtagClick(tagText);
      } else {
        // 預設行為：導航到社交頁面的標籤搜索結果
        navigate(`/social?q=${encodeURIComponent('#' + tagText)}`);
      }
    }
  };

  // 處理更多選項點擊
  const handleMoreOptions = () => {
    setShowMoreMenu(!showMoreMenu);
  };

  // 檢查是否為貼文作者
  const isPostAuthor = () => {
    if (!currentUser || !postData) return false;
    const postUser = postData.user_info || postData.user || {};
    
    // 多種方式比較用戶身份
    const isMatch = 
      (currentUser.user_account && postUser.user_account && currentUser.user_account === postUser.user_account) ||
      (currentUser.username && postUser.username && currentUser.username === postUser.username) ||
      (currentUser.id && postUser.id && currentUser.id === postUser.id) ||
      (currentUser.user_id && postUser.user_id && currentUser.user_id === postUser.user_id);
    
    // 調試資訊
    console.log('檢查貼文作者:', {
      currentUser,
      postUser,
      isMatch
    });
    
    return isMatch;
  };

  // 處理編輯貼文
  const handleEditPost = () => {
    setShowMoreMenu(false);
    // 導航到編輯頁面，傳遞貼文資料（包含標註）
    navigate(`/post/${postData.id}/edit`, {
      state: {
        postData: {
          id: postData.id,
          images: postData.images || [],
          description: postData.content?.content_text || postData.description || '',
          hashtags: postData.hashtags || [],
          location: postData.content?.location || postData.location || '',
          annotations: postData.annotations || []
        }
      }
    });
  };

  // 處理刪除貼文
  const handleDeletePost = () => {
    setShowMoreMenu(false);
    setShowDeleteConfirm(true);
  };

  // 確認刪除貼文
  const confirmDeletePost = () => {
    setShowDeleteConfirm(false);
    console.log('刪除貼文功能開發中');
    // 未來可以調用刪除 API
  };

  // 取消刪除貼文
  const cancelDeletePost = () => {
    setShowDeleteConfirm(false);
  };

  // 處理複製連結
  const handleCopyLink = () => {
    setShowMoreMenu(false);
    const postUrl = `${window.location.origin}/post/${postData.id}`;
    navigator.clipboard.writeText(postUrl).then(() => {
      console.log('貼文連結已複製到剪貼板');
      // 可以顯示成功提示
    }).catch(() => {
      console.log('複製失敗');
    });
  };

  // 處理檢舉貼文
  const handleReportPost = () => {
    setShowMoreMenu(false);
    console.log('檢舉貼文功能開發中');
    // 未來可以開啟檢舉表單
  };

  // 截取描述文字
  const getDisplayDescription = () => {
    // 支援不同的內容格式
    const description = postData.content?.content_text || postData.description || '';
    if (!description) return '';
    if (showFullDescription) return description;
    
    const maxLength = 100;
    if (description.length <= maxLength) return description;
    return description.substring(0, maxLength) + '...';
  };

  // 獲取圖片標註
  const getImageAnnotations = (imageIndex) => {
    if (!postData.annotations || !Array.isArray(postData.annotations)) {
      return [];
    }
    
    // 過濾出屬於當前圖片的標註
    return postData.annotations.filter(annotation => 
      annotation.image_index === imageIndex || 
      annotation.firebase_url === postData.images?.[imageIndex]?.firebase_url
    );
  };

  if (!postData) {
    return null;
  }

  const currentImage = postData.images?.[currentImageIndex];
  const userInfo = postData.user_info || postData.user || {};
  const location = postData.content?.location || postData.location;
  const currentImageAnnotations = getImageAnnotations(currentImageIndex);

  return (
    <div className={`${styles.postCard} ${className}`}>
      {/* 用戶資訊區域 */}
      <div className={styles.userInfo}>
        <img 
          src={userInfo.headshot_url || '/assets/icon/DefaultAvatar.jpg'} 
          alt="用戶頭像" 
          className={styles.userAvatar}
          onClick={handleUserClick}
          onError={handleImageError}
        />
        <div className={styles.userDetails}>
          <h3 className={styles.userName} onClick={handleUserClick}>
            {userInfo.user_account || userInfo.username || '未知用戶'}
          </h3>
          <div className={styles.postMeta}>
            {location && (
              <span className={styles.location} onClick={handleLocationClick}>
                {location}
              </span>
            )}
            <span className={styles.timeInfo}>
              {formatTimeDisplay(postData.created_at)}
            </span>
          </div>
        </div>
        <div className={styles.moreOptionsContainer} ref={moreMenuRef}>
          <button className={styles.moreOptionsButton} onClick={handleMoreOptions}>
            <img 
              src="/assets/icon/PostMoreInfo.png" 
              alt="更多選項" 
              className={styles.moreOptionsIcon}
            />
          </button>
          
          {showMoreMenu && (
            <div className={styles.moreOptionsMenu}>
              {isPostAuthor() ? (
                <>
                  <button className={styles.menuItem} onClick={handleEditPost}>
                    編輯貼文
                  </button>
                  <button className={styles.menuItem} onClick={handleDeletePost}>
                    刪除貼文
                  </button>
                </>
              ) : (
                <>
                  <button className={styles.menuItem} onClick={handleCopyLink}>
                    複製連結
                  </button>
                  <button className={styles.menuItem} onClick={handleReportPost}>
                    檢舉貼文
                  </button>
                </>
              )}
            </div>
          )}
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
            <div className={styles.mainImageContainer}>
              <img 
                src={currentImage?.dataUrl || currentImage?.url || currentImage?.firebase_url} 
                alt={`貼文圖片 ${currentImageIndex + 1}`}
                className={styles.postImage}
                onError={(e) => {
                  console.error('圖片載入失敗:', e.target.src);
                  e.target.style.display = 'none';
                }}
              />
              
              {/* 標註圖示 */}
              {currentImageAnnotations.length > 0 && (
                <div 
                  className={styles.annotationIcon}
                  onClick={toggleAnnotationDots}
                  title={`${currentImageAnnotations.length} 個標註`}
                >
                  <img 
                    src="/assets/icon/PostAnnotation.png" 
                    alt="標註" 
                    className={styles.annotationIconImage}
                    onError={(e) => {
                      e.target.style.display = 'none';
                      e.target.parentElement.innerHTML = '@';
                      e.target.parentElement.style.fontSize = '14px';
                      e.target.parentElement.style.fontWeight = 'bold';
                      e.target.parentElement.style.color = '#F08651';
                    }}
                  />
                </div>
              )}
              
              {/* 標註點顯示 */}
              {showAnnotationDots && currentImageAnnotations.map((annotation) => (
                <Annotation
                  key={annotation.id}
                  annotation={annotation}
                  x={annotation.x_position || annotation.x}
                  y={annotation.y_position || annotation.y}
                  isVisible={true}
                  onClick={() => {}} // 在 Post 組件中標註只用於顯示
                />
              ))}
              
              {/* 圖片指示器 */}
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
      {isInteractive && (
        <div className={styles.interactionButtons}>
          <button 
            className={`${styles.likeButton} ${isLiked ? styles.liked : ''}`}
            onClick={handleLike}
          >
            <img 
              src={isLiked ? "/assets/icon/PostLiked.png" : "/assets/icon/PostHeart.png"} 
              alt="按讚" 
              className={styles.interactionIcon} 
            />
            <span>{likeCount}</span>
          </button>
          <button className={styles.commentButton} onClick={handleComment}>
            <img src="/assets/icon/PostComment.png" alt="留言" className={styles.interactionIcon} />
            <span>{commentCount}</span>
          </button>
          <button 
            className={`${styles.saveButton} ${isSaved ? styles.saved : ''}`}
            onClick={handleSave}
          >
            <img 
              src={isSaved ? "/assets/icon/PostSaved.png" : "/assets/icon/PostSave.png"} 
              alt="收藏" 
              className={styles.interactionIcon} 
            />
          </button>
        </div>
      )}

      {/* 描述文字 */}
      {getDisplayDescription() && (
        <div className={styles.description}>
          {getDisplayDescription()}
          {!showFullDescription && (postData.content?.content_text || postData.description || '').length > 100 && (
            <span className={styles.showMore} onClick={() => handleComment()}>
              查看更多
            </span>
          )}
        </div>
      )}

      {/* Hashtag 區域 */}
      {postData.hashtags && postData.hashtags.length > 0 && (
        <div className={styles.hashtagSection}>
          {postData.hashtags.map((tag, index) => (
            <span 
              key={tag.id || index} 
              className={styles.hashtag}
              onClick={() => handleHashtagClick(tag)}
            >
              #{tag.tag || tag.text || (typeof tag === 'string' ? tag : '')}
            </span>
          ))}
        </div>
      )}

      <PostComments
        user={currentUser}
        previewComments={postData.top_comments || []}
      />

      {/* 刪除確認對話框 */}
      {showDeleteConfirm && (
        <ConfirmNotification
          message="確定要刪除這篇貼文嗎？"
          onConfirm={confirmDeletePost}
          onCancel={cancelDeletePost}
        />
      )}
    </div>
  );
};

export default Post; 