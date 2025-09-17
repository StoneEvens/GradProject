import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation('archives');
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
      
      console.log(t('archivePreviewForPublic.messages.archiveInitStatus'), {
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
      console.log(t('archivePreviewForPublic.messages.commentCountUpdated'), {
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
    
    console.log(t('archivePreviewForPublic.messages.likeAction'), {
      archiveId: archiveData.id,
      from: originalIsLiked ? t('archivePreviewForPublic.likeStatus.liked') : t('archivePreviewForPublic.likeStatus.notLiked'),
      to: newIsLiked ? t('archivePreviewForPublic.likeStatus.liked') : t('archivePreviewForPublic.likeStatus.notLiked'),
      likeCountChange: `${originalLikeCount} → ${newLikeCount}`
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
        console.error(t('archivePreviewForPublic.messages.likeActionFailed'), result.error);
        return;
      }
      
      console.log(t('archivePreviewForPublic.messages.likeActionSuccess'), result.message);
      
      // 可選：通知父組件（用於統計等目的）
      if (onLike) {
        onLike(archiveData.id, newIsLiked);
      }
    } catch (error) {
      // 網路錯誤，還原 UI 狀態
      console.error(t('archivePreviewForPublic.messages.likeApiError'), error);
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
    
    console.log(t('archivePreviewForPublic.messages.saveAction'), {
      archiveId: archiveData.id,
      from: originalIsSaved ? t('archivePreviewForPublic.saveStatus.saved') : t('archivePreviewForPublic.saveStatus.notSaved'),
      to: newIsSaved ? t('archivePreviewForPublic.saveStatus.saved') : t('archivePreviewForPublic.saveStatus.notSaved')
    });
    
    // 樂觀更新 UI - 立即反映用戶操作
    setIsSaved(newIsSaved);
    
    try {
      // 調用 API 切換收藏狀態
      const result = await toggleArchiveSave(archiveData.id);
      
      if (!result.success) {
        // API 失敗，還原 UI 狀態
        setIsSaved(originalIsSaved);
        console.error(t('archivePreviewForPublic.messages.saveActionFailed'), result.error);
        return;
      }
      
      console.log(t('archivePreviewForPublic.messages.saveActionSuccess'), result.message);
      
      // 可選：通知父組件（用於統計等目的）
      if (onSave) {
        onSave(archiveData.id, newIsSaved);
      }
    } catch (error) {
      // 網路錯誤，還原 UI 狀態
      console.error(t('archivePreviewForPublic.messages.saveApiError'), error);
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
        onShowNotification(t('archivePreviewForPublic.messages.linkCopied'));
      }
    } catch (err) {
      console.error(t('archivePreviewForPublic.messages.copyLinkFailed'), err);
      if (onShowNotification) {
        onShowNotification(t('archivePreviewForPublic.messages.copyLinkFailed'));
      }
    }
  };


  // 顯示確認對話框
  const showConfirmation = (action) => {
    setShowMenu(false);
    setConfirmAction(action);
    if (action === 'delete') {
      setConfirmMessage(t('archivePreviewForPublic.confirmMessages.deleteArticle'));
    } else if (action === 'private') {
      setConfirmMessage(t('archivePreviewForPublic.confirmMessages.makePrivateArticle'));
    }
  };

  // 刪除文章
  const handleDelete = async () => {
    try {
      const result = await deleteDiseaseArchive(archiveData.id);
      if (result.success) {
        if (onShowNotification) {
          onShowNotification(t('archivePreviewForPublic.messages.articleDeleted'));
        }
        if (onDelete) {
          onDelete(archiveData.id);
        }
      } else {
        if (onShowNotification) {
          onShowNotification(result.error || t('archivePreviewForPublic.messages.deleteFailed'));
        }
      }
    } catch (error) {
      console.error(t('archivePreviewForPublic.messages.deleteArticleFailed'), error);
      if (onShowNotification) {
        onShowNotification(t('archivePreviewForPublic.messages.deleteFailedRetry'));
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
          onShowNotification(t('archivePreviewForPublic.messages.articleMadePrivate'));
        }
        if (onDelete) {
          onDelete(archiveData.id);  // 從公開列表中移除
        }
      } else {
        if (onShowNotification) {
          onShowNotification(result.error || t('archivePreviewForPublic.messages.makePrivateFailed'));
        }
      }
    } catch (error) {
      console.error(t('archivePreviewForPublic.messages.makePrivateFailedError'), error);
      if (onShowNotification) {
        onShowNotification(t('archivePreviewForPublic.messages.makePrivateFailedRetry'));
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
      // 預載入策略：先在當前頁面開始載入資料
      try {
        // 預載入詳情頁面資料（非阻塞）
        import('../services/petService').then(({ getDiseaseArchiveDetail }) => {
          getDiseaseArchiveDetail(archiveData.id).catch(() => {
            // 預載入失敗不影響導航
          });
        });
      } catch (error) {
        // 預載入失敗不影響導航
      }
      
      // 立即導航
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
    
    console.log(t('archivePreviewForPublic.messages.userAvatarClicked'), {
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
      console.log(t('archivePreviewForPublic.messages.navigateToOwnProfile'));
      navigate('/user-profile');
    } else {
      // 預設行為：跳轉到其他用戶個人資料頁面
      const userAccount = userInfo.user_account || userInfo.username;
      if (userAccount) {
        console.log(t('archivePreviewForPublic.messages.navigateToUserProfile'), `/user/${userAccount}`);
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
          alt={t('archivePreviewForPublic.userAvatarAlt')} 
          className={styles.userAvatar}
          onClick={handleUserAvatarClick}
        />
        <h3 className={styles.archiveTitle}>
          {archiveData?.archive_title || archiveData?.archiveTitle || t('archivePreviewForPublic.defaultArchiveTitle')}
        </h3>
        
        {/* 菜單按鈕 */}
        <div className={styles.menuContainer} ref={menuRef}>
          <button 
            className={styles.menuButton} 
            onClick={handleMenuClick}
          >
            <img 
              src="/assets/icon/PostMoreInfo.png" 
              alt={t('archivePreviewForPublic.moreOptionsAlt')} 
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
                    {t('archivePreviewForPublic.menuItems.deleteArticle')}
                  </button>
                  <button 
                    className={styles.dropdownItem}
                    onClick={(e) => {
                      e.stopPropagation();
                      showConfirmation('private');
                    }}
                  >
                    {t('archivePreviewForPublic.menuItems.makePrivate')}
                  </button>
                </>
              ) : (
                // 其他用戶選項
                <button 
                  className={styles.dropdownItem}
                  onClick={handleCopyLink}
                >
                  {t('archivePreviewForPublic.menuItems.copyLink')}
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
            alt={t('archivePreviewForPublic.likeButtonAlt')} 
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
            alt={t('archivePreviewForPublic.commentButtonAlt')} 
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
            alt={t('archivePreviewForPublic.saveButtonAlt')} 
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