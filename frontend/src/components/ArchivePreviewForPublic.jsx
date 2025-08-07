import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { toggleArchiveLike, toggleArchiveSave } from '../services/socialService';
import { deleteDiseaseArchive, publishDiseaseArchive } from '../services/petService';
import ConfirmNotification from './ConfirmNotification';
import styles from '../styles/ArchivePreviewForPublic.module.css';

const ArchivePreviewForPublic = ({ 
  archiveData,
  user,
  pet,
  currentUser,  // 新增：當前登入的用戶
  onLike,
  onComment,
  onSave,
  onMenuClick,
  onDelete,  // 新增：刪除回調
  onShowNotification  // 新增：顯示通知
}) => {
  const navigate = useNavigate();
  const [isLiked, setIsLiked] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [commentCount, setCommentCount] = useState(0);
  const [showMenu, setShowMenu] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const [confirmMessage, setConfirmMessage] = useState('');
  const menuRef = useRef(null);

  // 初始化互動狀態
  useEffect(() => {
    if (archiveData) {
      // 支援不同的互動數據格式
      const userInteraction = archiveData.user_interaction || {};
      const interactionStats = archiveData.interaction_stats || {};
      
      // 優先使用 user_interaction 中的狀態，因為它更準確
      const newIsLiked = userInteraction.is_liked ?? archiveData.is_liked ?? false;
      const newIsSaved = userInteraction.is_saved ?? archiveData.is_saved ?? false;
      const newLikeCount = interactionStats.likes ?? archiveData.like_count ?? 0;
      const newCommentCount = interactionStats.comments ?? archiveData.comment_count ?? 0;
      
      console.log('Archive 初始化狀態:', {
        archiveId: archiveData.id,
        newIsLiked,
        newIsSaved,
        newLikeCount,
        newCommentCount,
        userInteraction,
        interactionStats,
        fullArchiveData: archiveData,
        commentsFromStats: interactionStats.comments
      });
      
      setIsLiked(newIsLiked);
      setIsSaved(newIsSaved);
      setLikeCount(newLikeCount);
      setCommentCount(newCommentCount);
    }
  }, [archiveData]);

  // 單獨監聽留言數的變化
  useEffect(() => {
    if (archiveData?.interaction_stats?.comments !== undefined) {
      const newCommentCount = archiveData.interaction_stats.comments;
      console.log('Comment count updated from parent:', {
        archiveId: archiveData.id,
        newCommentCount,
        currentCommentCount: commentCount
      });
      setCommentCount(newCommentCount);
    }
  }, [archiveData?.interaction_stats?.comments]);

  // 點擊外部關閉選單
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowMenu(false);
      }
    };

    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showMenu]);


  // 直接返回原始內容，讓CSS控制顯示行數
  const getPreviewContent = (content) => {
    if (!content) return '';
    return content;
  };

  // 處理按讚 - Archive 組件完全自主處理
  const handleLike = async () => {
    const originalIsLiked = isLiked;
    const originalLikeCount = likeCount;
    const newIsLiked = !isLiked;
    const newLikeCount = newIsLiked ? likeCount + 1 : Math.max(0, likeCount - 1);
    
    console.log('Archive 按讚操作:', {
      archiveId: archiveData.id,
      從: originalIsLiked ? '已按讚' : '未按讚',
      到: newIsLiked ? '已按讚' : '未按讚',
      讚數變化: `${originalLikeCount} → ${newLikeCount}`
    });
    
    // 樂觀更新 UI - 立即反映用戶操作
    setIsLiked(newIsLiked);
    setLikeCount(newLikeCount);
    
    try {
      // 調用 API 切換按讚狀態
      const result = await toggleArchiveLike(archiveData.id);
      
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
        onLike(archiveData.id, newIsLiked);
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
    if (onComment) {
      onComment(archiveData.id);
    }
  };

  // 處理收藏 - Archive 組件完全自主處理
  const handleSave = async () => {
    const originalIsSaved = isSaved;
    const newIsSaved = !isSaved;
    
    console.log('Archive 收藏操作:', {
      archiveId: archiveData.id,
      從: originalIsSaved ? '已收藏' : '未收藏',
      到: newIsSaved ? '已收藏' : '未收藏'
    });
    
    // 樂觀更新 UI - 立即反映用戶操作
    setIsSaved(newIsSaved);
    
    try {
      // 調用 API 切換收藏狀態
      const result = await toggleArchiveSave(archiveData.id);
      
      if (!result.success) {
        // API 失敗，還原 UI 狀態
        setIsSaved(originalIsSaved);
        console.error('收藏操作失敗:', result.error);
        return;
      }
      
      console.log('收藏操作成功:', result.message);
      
      // 可選：通知父組件（用於統計等目的）
      if (onSave) {
        onSave(archiveData.id, newIsSaved);
      }
    } catch (error) {
      // 網路錯誤，還原 UI 狀態
      console.error('收藏 API 調用異常:', error);
      setIsSaved(originalIsSaved);
    }
  };


  const handleMenuClick = (e) => {
    e.stopPropagation();
    setShowMenu(!showMenu);
    if (onMenuClick) {
      onMenuClick();
    }
  };

  // 判斷是否為文章作者
  const isAuthor = () => {
    if (!currentUser || !userInfo) return false;
    return currentUser.id === userInfo.id || 
           currentUser.user_account === userInfo.user_account;
  };

  // 複製連結
  const handleCopyLink = async (e) => {
    e.stopPropagation();
    setShowMenu(false);
    
    const url = `${window.location.origin}/disease-archive/${archiveData.id}/public`;
    
    try {
      await navigator.clipboard.writeText(url);
      if (onShowNotification) {
        onShowNotification('連結已複製到剪貼簿');
      }
    } catch (err) {
      console.error('複製連結失敗:', err);
      if (onShowNotification) {
        onShowNotification('複製連結失敗');
      }
    }
  };


  // 顯示確認對話框
  const showConfirmation = (action) => {
    setShowMenu(false);
    setConfirmAction(action);
    if (action === 'delete') {
      setConfirmMessage('確定要刪除這篇文章嗎？此操作無法復原。');
    } else if (action === 'private') {
      setConfirmMessage('確定要將這篇文章轉為私人嗎？其他用戶將無法查看。');
    }
  };

  // 刪除文章
  const handleDelete = async () => {
    try {
      const result = await deleteDiseaseArchive(archiveData.id);
      if (result.success) {
        if (onShowNotification) {
          onShowNotification('文章已刪除');
        }
        if (onDelete) {
          onDelete(archiveData.id);
        }
      } else {
        if (onShowNotification) {
          onShowNotification(result.error || '刪除失敗');
        }
      }
    } catch (error) {
      console.error('刪除文章失敗:', error);
      if (onShowNotification) {
        onShowNotification('刪除失敗，請稍後再試');
      }
    }
    setConfirmAction(null);
  };

  // 轉為私人（使用 publishDiseaseArchive API 切換狀態）
  const handleMakePrivate = async () => {
    try {
      // publishDiseaseArchive API 會切換公開/私人狀態
      const result = await publishDiseaseArchive(archiveData.id);
      if (result.success) {
        if (onShowNotification) {
          onShowNotification('文章已轉為私人');
        }
        if (onDelete) {
          onDelete(archiveData.id);  // 從公開列表中移除
        }
      } else {
        if (onShowNotification) {
          onShowNotification(result.error || '轉為私人失敗');
        }
      }
    } catch (error) {
      console.error('轉為私人失敗:', error);
      if (onShowNotification) {
        onShowNotification('轉為私人失敗，請稍後再試');
      }
    }
    setConfirmAction(null);
  };

  // 處理確認對話框
  const handleConfirm = () => {
    if (confirmAction === 'delete') {
      handleDelete();
    } else if (confirmAction === 'private') {
      handleMakePrivate();
    }
  };

  const handleCancelConfirm = () => {
    setConfirmAction(null);
    setConfirmMessage('');
  };

  // 处理点击卡片导向详情页
  const handleCardClick = (e) => {
    // 避免点击按钮时触发卡片点击
    if (e.target.closest('button')) {
      return;
    }
    
    // 导向疾病档案详情页，标记为公开浏览模式
    if (archiveData?.id) {
      navigate(`/disease-archive/${archiveData.id}/public`);
    }
  };

  // 獲取用戶資訊 (優先使用archiveData.user_info，然後是user)
  const userInfo = archiveData?.user_info || user || {};

  // 處理用戶頭像點擊
  const handleUserAvatarClick = (e) => {
    // 阻止事件冒泡，避免觸發卡片點擊
    e.stopPropagation();
    
    if (!userInfo || !currentUser) return;
    
    console.log('Archive 用戶頭像點擊:', {
      clickedUser: userInfo,
      currentUser: currentUser
    });
    
    // 判斷是否為當前用戶
    const isCurrentUser = currentUser && (
      userInfo.id === currentUser.id || 
      userInfo.user_account === currentUser.user_account
    );
    
    if (isCurrentUser) {
      // 如果是當前用戶，導向自己的個人資料頁面
      console.log('Archive - 導航到自己的個人資料頁面');
      navigate('/user-profile');
    } else {
      // 預設行為：跳轉到其他用戶個人資料頁面
      const userAccount = userInfo.user_account || userInfo.username;
      if (userAccount) {
        console.log('Archive - 導航到其他用戶個人資料頁面:', `/user/${userAccount}`);
        navigate(`/user/${userAccount}`);
      }
    }
  };

  return (
    <div className={styles.container} onClick={handleCardClick}>
      {/* 標頭區域 */}
      <div className={styles.header}>
        <img 
          src={userInfo.headshot_url || '/assets/icon/DefaultAvatar.jpg'} 
          alt="用戶頭像" 
          className={styles.userAvatar}
          onClick={handleUserAvatarClick}
        />
        <h3 className={styles.archiveTitle}>
          {archiveData?.archive_title || archiveData?.archiveTitle || '疾病檔案'}
        </h3>
        
        {/* 菜單按鈕 */}
        <div className={styles.menuContainer} ref={menuRef}>
          <button 
            className={styles.menuButton} 
            onClick={handleMenuClick}
          >
            <img 
              src="/assets/icon/PostMoreInfo.png" 
              alt="更多選項" 
              className={styles.menuIcon}
            />
          </button>
          
          {/* 下拉選單 */}
          {showMenu && (
            <div className={styles.dropdown}>
              {isAuthor() ? (
                // 作者選項
                <>
                  <button 
                    className={styles.dropdownItem}
                    onClick={(e) => {
                      e.stopPropagation();
                      showConfirmation('delete');
                    }}
                  >
                    刪除文章
                  </button>
                  <button 
                    className={styles.dropdownItem}
                    onClick={(e) => {
                      e.stopPropagation();
                      showConfirmation('private');
                    }}
                  >
                    轉為私人
                  </button>
                </>
              ) : (
                // 其他用戶選項
                <button 
                  className={styles.dropdownItem}
                  onClick={handleCopyLink}
                >
                  複製連結
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 內容preview區域 */}
      <div className={styles.contentPreview}>
        <div className={styles.contentText}>
          {getPreviewContent(archiveData?.generated_content || archiveData?.content)}
        </div>
      </div>

      {/* 互動按鈕區域 - 參考Post組件樣式 */}
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
        
        <button 
          className={styles.commentButton}
          onClick={handleComment}
        >
          <img 
            src="/assets/icon/PostComment.png" 
            alt="留言" 
            className={styles.interactionIcon} 
          />
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

      {/* 確認通知 */}
      {confirmAction && (
        <ConfirmNotification
          message={confirmMessage}
          onConfirm={handleConfirm}
          onCancel={handleCancelConfirm}
        />
      )}
    </div>
  );
};

export default ArchivePreviewForPublic;