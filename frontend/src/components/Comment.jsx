import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from '../styles/Comment.module.css';
import ContextMenu from './ContextMenu';

const EditIcon = '/assets/icon/PetpageEditButton.png';
const HeartIcon = '/assets/icon/PostHeart.png';
const HeartFilledIcon = '/assets/icon/PostLiked.png';

const Comment = ({
  comment,
  type = 'normal', // 'normal' 或 'reply'
  onLike,
  onReply,
  onShowReplies,
  onDelete,
  onReport,
  currentUser,
  showingReplies = false,
  isReplying = false,
  hasReplies = false
}) => {
  const navigate = useNavigate();
  const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0 });
  const commentRef = useRef(null);
  const longPressTimer = useRef(null);

  // 取得圖片網格樣式類別
  const getImageGridClass = (imageCount) => {
    switch (imageCount) {
      case 1:
        return styles.singleImage;
      case 2:
        return styles.twoImages;
      case 3:
        return styles.threeImages;
      default:
        return styles.threeImages;
    }
  };

  // 處理圖片點擊事件
  const handleImageClick = (image) => {
    // 這裡可以實作圖片放大檢視功能
    console.log('圖片點擊:', image);
    // TODO: 實作圖片檢視模態窗口
  };
  
  const handleUserClick = (userInfo) => {
    // 檢查是否為目前使用者本人
    const isCurrentUser = currentUser && userInfo && (
      currentUser.user_account === userInfo.user_account ||
      currentUser.id === userInfo.id ||
      currentUser.username === userInfo.username
    );
    
    if (isCurrentUser) {
      // 導航到自己的個人檔案頁面
      navigate('/user-profile');
    } else {
      // 導航到他人的頁面
      navigate(`/user/${userInfo.user_account}`);
    }
  };

  const isNormalType = type === 'normal';
  const isOwnComment = currentUser && comment.user && (
    currentUser.user_account === comment.user.user_account ||
    currentUser.id === comment.user.id ||
    currentUser.username === comment.user.username
  );

  // 處理右鍵選單
  const handleContextMenu = (e) => {
    e.preventDefault();
    if (comment.content === "[此評論已刪除]") return;
    
    const rect = commentRef.current.getBoundingClientRect();
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY
    });
  };

  // 處理長按（手機）
  const handleTouchStart = (e) => {
    if (comment.content === "[此評論已刪除]") return;
    
    longPressTimer.current = setTimeout(() => {
      const touch = e.touches[0];
      setContextMenu({
        visible: true,
        x: touch.clientX,
        y: touch.clientY
      });
    }, 500); // 500ms 後觸發
  };

  const handleTouchEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
    }
  };

  const handleTouchMove = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
    }
  };

  // 清理計時器
  useEffect(() => {
    return () => {
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
      }
    };
  }, []);

  // 設定選單項目
  const menuItems = isOwnComment
    ? [
        {
          label: '刪除留言',
          danger: true,
          onClick: () => onDelete && onDelete(comment.id)
        }
      ]
    : [
        {
          label: '檢舉留言',
          onClick: () => onReport && onReport(comment.id)
        }
      ];

  return (
    <>
      <div 
        className={styles.commentWrapper}
        ref={commentRef}
        onContextMenu={handleContextMenu}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchMove={handleTouchMove}
      >
      <div className={`${styles.commentCard} ${type === 'reply' ? styles.replyCard : ''}`}>
        {/* 頭像 */}
        <div className={styles.userAvatar}>
          <img 
            src={comment.user.headshot_url || "/assets/icon/DefaultUser.png"} 
            alt={comment.user.username}
            onError={(e) => {
              e.target.src = "/assets/icon/DefaultUser.png";
            }}
          />
        </div>

        {/* 主要內容區域 */}
        <div className={styles.commentMain}>
          <div className={styles.commentHeader}>
            <span className={styles.username} onClick={() => handleUserClick(comment.user)}>
              {comment.user.username}
            </span>
            <div className={styles.likeSection}>
              {comment.content !== "[此評論已刪除]" && (
                <>
                  <button 
                    className={styles.likeButton} 
                    onClick={() => onLike(comment.id)}
                  >
                    <img 
                      src={comment.isLiked ? HeartFilledIcon : HeartIcon} 
                      alt={comment.isLiked ? '取消點讚' : '點讚'} 
                      className={styles.heartIcon} 
                    />
                    <span className={styles.likeCount}>{comment.likes || 0}</span>
                  </button>
                  {isNormalType && (
                    <button 
                      className={styles.replyButton} 
                      onClick={() => onReply(comment.id)}
                      title="回覆"
                    >
                      <img 
                        src="/assets/icon/CommentReplyIcon.png" 
                        alt="回覆" 
                        className={styles.replyIcon} 
                      />
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          {/* 留言內容 - 區分已刪除和正常留言 */}
          {comment.content === "[此評論已刪除]" ? (
            <div className={styles.commentContent}>
              <p className={styles.deletedCommentText}>{comment.content}</p>
            </div>
          ) : comment.content && comment.content.trim() !== "" ? (
            <div className={styles.commentContent}>
              <p className={styles.commentText}>{comment.content}</p>
            </div>
          ) : null}

          {/* 圖片顯示區域 - 已刪除的留言不顯示圖片 */}
          {comment.content !== "[此評論已刪除]" && comment.images && comment.images.length > 0 && (
            <div className={styles.commentImages}>
              <div className={`${styles.imageGrid} ${getImageGridClass(comment.images.length)}`}>
                {comment.images.map((image, index) => (
                  <div key={image.id || index} className={styles.imageItem}>
                    <img 
                      src={image.url || image.img_url} 
                      alt={image.alt_text || `留言圖片 ${index + 1}`}
                      onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.parentNode.innerHTML = '<div class="' + styles.imageError + '">圖片載入失敗</div>';
                      }}
                      onClick={() => handleImageClick(image)}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>

      {/* 操作按鈕移到 comment-card 外面 */}
      {isNormalType && hasReplies && (
        <div className={styles.commentActions}>
          <button className={styles.actionButton} onClick={() => onShowReplies(comment.id)}>
            {showingReplies ? '隱藏回覆' : '展開回覆'}
          </button>
        </div>
      )}
      </div>
      <ContextMenu
        visible={contextMenu.visible}
        x={contextMenu.x}
        y={contextMenu.y}
        items={menuItems}
        onClose={() => setContextMenu({ visible: false, x: 0, y: 0 })}
      />
    </>
  );
};

export default Comment;