import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import TopNavbar from '../components/TopNavbar';
import BottomNavbar from '../components/BottomNavigationBar';
import ArchiveCard from '../components/ArchiveCard';
import PageTransition from '../components/PageTransition';
import { NotificationProvider } from '../context/NotificationContext';
import { getUserPets, getDiseaseArchiveDetail, publishDiseaseArchive, deleteDiseaseArchive } from '../services/petService';
import { getUserProfile } from '../services/userService';
import { toggleArchiveLike, toggleArchiveSave } from '../services/socialService';
import Notification from '../components/Notification';
import ConfirmNotification from '../components/ConfirmNotification';
import PostComments from '../components/PostComments';
import styles from '../styles/DiseaseArchiveDetailPage.module.css';

const DiseaseArchiveDetailPage = () => {
  const { petId, archiveId } = useParams();
  const navigate = useNavigate();
  
  // 檢測是否為公開瀏覽模式
  const isPublicView = window.location.pathname.includes('/public');
  const [loading, setLoading] = useState(true);
  const [archive, setArchive] = useState(null);
  const [pet, setPet] = useState(null);
  const [user, setUser] = useState(null);
  const [loadError, setLoadError] = useState(false); // 新增載入錯誤狀態
  const [showMenu, setShowMenu] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [commentCount, setCommentCount] = useState(0);
  const [notification, setNotification] = useState('');
  const [showConfirmNotification, setShowConfirmNotification] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState('');
  const [confirmAction, setConfirmAction] = useState(null);
  const [showComments, setShowComments] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    loadData();
  }, [petId, archiveId]);


  // 點擊外部關閉菜單
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showMenu && !event.target.closest(`.${styles.menuContainer}`)) {
        setShowMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showMenu]);

  const loadData = async () => {
    try {
      setLoading(true);
      setLoadError(false); // 重置錯誤狀態
      
      // 設定最小載入時間，確保過渡動畫順暢
      const minLoadTime = 250;
      const startTime = Date.now();
      
      // 獲取疾病檔案資料
      const archiveData = await getDiseaseArchiveDetail(archiveId);
      
      if (archiveData) {
        // 如果是公開瀏覽模式，從檔案資料中獲取寵物和用戶資料
        if (isPublicView) {
          // 公開模式：獲取當前用戶資訊以便留言
          try {
            const userProfile = await getUserProfile();
            setCurrentUser(userProfile);
          } catch (error) {
            console.error('獲取用戶資料失敗:', error);
          }
          
          // 從檔案資料中提取用戶和寵物資訊
          if (archiveData.pet_info) {
            setPet(archiveData.pet_info);
          }
          if (archiveData.user_info) {
            setUser(archiveData.user_info);
          }
        } else {
          // 私人模式：載入當前用戶的資料
          const [userProfile, pets] = await Promise.all([
            getUserProfile(),
            getUserPets()
          ]);
          
          setUser(userProfile);
          setCurrentUser(userProfile);
          
          const currentPet = pets.find(p => p.pet_id === parseInt(petId));
          if (currentPet) {
            setPet(currentPet);
          }
        }
        
        // 從異常記錄中提取症狀資料
        const allSymptoms = [];
        if (archiveData.abnormal_posts && Array.isArray(archiveData.abnormal_posts)) {
          archiveData.abnormal_posts.forEach(post => {
            if (post.symptoms && Array.isArray(post.symptoms)) {
              post.symptoms.forEach(symptom => {
                const symptomName = typeof symptom === 'string' ? symptom : symptom.symptom_name;
                if (symptomName && !allSymptoms.some(s => s.text === symptomName)) {
                  allSymptoms.push({ text: symptomName });
                }
              });
            }
          });
        }
        
        // 轉換格式以符合 ArchiveCard 預期的資料結構
        const archiveCardData = {
          archiveTitle: archiveData.archive_title,
          generated_content: archiveData.content,
          mainCause: archiveData.main_cause,
          abnormalPostsData: archiveData.abnormal_posts || [],
          symptoms: allSymptoms, // 添加症狀資料
          goToDoctor: archiveData.go_to_doctor,
          healthStatus: archiveData.health_status,
          createdAt: archiveData.created_at,
          isPrivate: archiveData.is_private, // 添加隱私狀態
          postFrame: archiveData.postFrame // 添加 postFrame 用於留言功能
        };
        
        setArchive(archiveCardData);
        
        // 初始化互動狀態（公開瀏覽模式）
        if (isPublicView && archiveData) {
          const userInteraction = archiveData.user_interaction || {};
          const interactionStats = archiveData.interaction_stats || {};
          
          setIsLiked(userInteraction.is_liked ?? false);
          setIsSaved(userInteraction.is_saved ?? false);
          setLikeCount(interactionStats.likes ?? 0);
          setCommentCount(interactionStats.comments ?? 0);
          
          console.log('Archive 詳情頁初始化狀態:', {
            archiveId: archiveData.id,
            isLiked: userInteraction.is_liked,
            isSaved: userInteraction.is_saved,
            likeCount: interactionStats.likes,
            userInteraction,
            interactionStats
          });
        }
      } else {
        console.error('找不到指定的疾病檔案');
        setLoadError(true); // 設定載入錯誤狀態
      }
      
      // 確保最小載入時間，讓過渡動畫完整播放
      const elapsed = Date.now() - startTime;
      if (elapsed < minLoadTime) {
        await new Promise(resolve => setTimeout(resolve, minLoadTime - elapsed));
      }
      
    } catch (error) {
      console.error('載入資料失敗:', error);
      setLoadError(true); // 設定載入錯誤狀態
      
      // 確保最小載入時間即使在錯誤情況下也要滿足
      const elapsed = Date.now() - startTime;
      if (elapsed < minLoadTime) {
        await new Promise(resolve => setTimeout(resolve, minLoadTime - elapsed));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    navigate(-1);
  };

  const handleEdit = () => {
    // 暫時導向編輯頁面
    navigate(`/pet/${petId}/disease-archive/${archiveId}/edit`);
  };

  const handleDelete = () => {
    setConfirmMessage('確定要刪除這篇文章嗎？此操作無法復原。');
    setConfirmAction(() => confirmDelete);
    setShowConfirmNotification(true);
    setShowMenu(false);
  };

  const confirmDelete = async () => {
    try {
      const result = await deleteDiseaseArchive(archiveId);
      
      if (result.success) {
        showNotification(result.message || '疾病檔案已刪除');
        setTimeout(() => {
          if (isPublicView) {
            navigate('/social');
          } else {
            navigate(`/pet/${petId}/disease-archive`);
          }
        }, 1500);
      } else {
        showNotification(result.error || '刪除失敗，請稍後再試');
      }
    } catch (error) {
      console.error('刪除失敗:', error);
      showNotification('刪除失敗，請稍後再試');
    }
  };

  const handlePublish = () => {
    if (archive?.isPrivate) {
      // 當前是私人，要發布為公開
      setConfirmMessage('確定要公開發布這篇文章嗎？發布後相關的異常記錄也會變為公開。');
    } else {
      // 當前是公開，要轉為私人
      setConfirmMessage('確定要將這篇文章轉為私人嗎？其他用戶將無法查看。');
    }
    setConfirmAction(() => confirmPublish);
    setShowConfirmNotification(true);
  };

  const confirmPublish = async () => {
    try {
      const result = await publishDiseaseArchive(archiveId);
      
      if (result.success) {
        const newIsPrivate = result.data?.is_private;
        showNotification(result.message || '操作成功！');
        
        // 立即更新本地狀態，避免重新載入
        if (archive) {
          setArchive(prevArchive => ({
            ...prevArchive,
            isPrivate: newIsPrivate
          }));
        }
      } else {
        showNotification(result.error || '操作失敗，請稍後再試');
      }
    } catch (error) {
      console.error('切換疾病檔案狀態失敗:', error);
      showNotification('操作失敗，請稍後再試');
    }
  };


  // 顯示通知
  const showNotification = (msg) => {
    setNotification(msg);
  };

  // 隱藏通知
  const hideNotification = () => {
    setNotification('');
  };

  // 處理按讚
  const handleLike = async () => {
    if (!isPublicView) return;
    
    const originalIsLiked = isLiked;
    const originalLikeCount = likeCount;
    const newIsLiked = !isLiked;
    const newLikeCount = newIsLiked ? likeCount + 1 : Math.max(0, likeCount - 1);
    
    console.log('Archive 詳情頁按讚操作:', {
      archiveId: archiveId,
      從: originalIsLiked ? '已按讚' : '未按讚',
      到: newIsLiked ? '已按讚' : '未按讚',
      讚數變化: `${originalLikeCount} → ${newLikeCount}`
    });
    
    // 樂觀更新 UI
    setIsLiked(newIsLiked);
    setLikeCount(newLikeCount);
    
    try {
      const result = await toggleArchiveLike(archiveId);
      
      if (!result.success) {
        // API 失敗，還原 UI 狀態
        setIsLiked(originalIsLiked);
        setLikeCount(originalLikeCount);
        console.error('按讚操作失敗:', result.error);
        showNotification('按讚操作失敗，請稍後再試');
        return;
      }
      
      console.log('按讚操作成功:', result.message);
      
    } catch (error) {
      // 網路錯誤，還原 UI 狀態
      console.error('按讚 API 調用異常:', error);
      setIsLiked(originalIsLiked);
      setLikeCount(originalLikeCount);
      showNotification('按讚操作失敗，請檢查網路連線');
    }
  };

  // 處理留言
  const handleComment = () => {
    if (!isPublicView) return;
    
    if (archive && archive.postFrame) {
      setShowComments(true);
    } else {
      showNotification('無法開啟留言功能');
    }
  };

  // 處理留言彈窗關閉
  const handleCommentsClose = () => {
    setShowComments(false);
  };

  // 處理留言數變化
  const handleCommentCountChange = (increment) => {
    setCommentCount(prevCount => {
      const newCount = prevCount + increment;
      console.log('DiseaseArchiveDetailPage 留言數更新:', {
        archiveId,
        increment,
        oldCount: prevCount,
        newCount
      });
      return newCount;
    });
  };

  // 處理收藏
  const handleSave = async () => {
    if (!isPublicView) return;
    
    const originalIsSaved = isSaved;
    const newIsSaved = !isSaved;
    
    console.log('Archive 詳情頁收藏操作:', {
      archiveId: archiveId,
      從: originalIsSaved ? '已收藏' : '未收藏',
      到: newIsSaved ? '已收藏' : '未收藏'
    });
    
    // 樂觀更新 UI
    setIsSaved(newIsSaved);
    
    try {
      const result = await toggleArchiveSave(archiveId);
      
      if (!result.success) {
        // API 失敗，還原 UI 狀態
        setIsSaved(originalIsSaved);
        console.error('收藏操作失敗:', result.error);
        showNotification('收藏操作失敗，請稍後再試');
        return;
      }
      
      console.log('收藏操作成功:', result.message);
      
    } catch (error) {
      // 網路錯誤，還原 UI 狀態
      console.error('收藏 API 調用異常:', error);
      setIsSaved(originalIsSaved);
      showNotification('收藏操作失敗，請檢查網路連線');
    }
  };


  // 使用 PageTransition 取代原本的 loading 狀態
  // if (loading) {
  //   return (
  //     <NotificationProvider>
  //       <div className={styles.container}>
  //         <TopNavbar />
  //         <div className={styles.content}>
  //           <ArchiveDetailSkeleton isPublicView={isPublicView} />
  //         </div>
  //         <BottomNavbar />
  //       </div>
  //     </NotificationProvider>
  //   );
  // }

  // 只有在載入完成且確實有錯誤時才顯示錯誤頁面
  if (!loading && loadError) {
    return (
      <NotificationProvider>
        <div className={styles.container}>
          <TopNavbar />
          <PageTransition 
            isLoading={false} 
            overlayColor="#FFF2D9"
            fadeDuration={400}
          >
            <div className={styles.content}>
              <div className={styles.errorContainer}>
                <div className={styles.errorMessage}>
                  <h3>找不到疾病檔案</h3>
                  <p>該檔案可能已被刪除或不存在</p>
                  <div className={styles.errorButtons}>
                    <button 
                      className={styles.retryButton} 
                      onClick={() => {
                        setLoadError(false);
                        loadData();
                      }}
                    >
                      重新載入
                    </button>
                    <button 
                      className={styles.backButton} 
                      onClick={() => {
                        if (isPublicView) {
                          navigate('/social');
                        } else {
                          navigate(`/pet/${petId}/disease-archive`);
                        }
                      }}
                    >
                      返回
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </PageTransition>
          <BottomNavbar />
        </div>
      </NotificationProvider>
    );
  }

  return (
    <NotificationProvider>
      <div className={styles.container}>
        <TopNavbar />
        
        <PageTransition 
          isLoading={loading} 
          overlayColor="#FFF2D9"
          fadeDuration={400}
        >
        
        <div className={styles.content}>
          {/* 標題區域 */}
          <div className={styles.header}>
            <div className={styles.titleSection}>
              <button className={styles.backButton} onClick={handleBack}>
                ❮
              </button>
              <span className={styles.title}>
                {isPublicView ? '正在瀏覽檔案' : '疾病檔案詳情'}
              </span>
            </div>
            
            {/* 公開發布按鈕 - 只有私人檔案且非公開瀏覽模式才顯示 */}
            {!isPublicView && archive?.isPrivate && (
              <button 
                className={styles.publishButton} 
                onClick={handlePublish}
              >
                公開發布
              </button>
            )}
            
            {/* 已公開狀態按鈕 - 非公開瀏覽模式才顯示，可點擊轉回私人 */}
            {!isPublicView && archive?.isPrivate === false && (
              <button 
                className={styles.publishedStatus}
                onClick={handlePublish}
              >
                已公開
              </button>
            )}
          </div>

          <div className={styles.divider}></div>

          {/* 疾病檔案內容卡片 */}
          <ArchiveCard 
            archiveData={archive}
            user={user}
            pet={pet}
            currentUser={currentUser}
            isPublicView={isPublicView}
            onShowNotification={showNotification}
          />
          
          {/* 刪除按鈕 - 在 ArchiveCard 下方，只有在非公開瀏覽模式才顯示 */}
          {!isPublicView && (
            <button 
              className={styles.deleteButtonInline}
              onClick={handleDelete}
            >
              刪除疾病檔案
            </button>
          )}
          
          
          {/* 公開瀏覽模式的互動區域 */}
          {isPublicView && (
            <div className={styles.interactionSection}>
              <div className={styles.interactionButtons}>
                <button 
                  className={`${styles.interactionButton} ${isLiked ? styles.liked : ''}`}
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
                  className={styles.interactionButton}
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
                  className={`${styles.interactionButton} ${isSaved ? styles.saved : ''}`}
                  onClick={handleSave}
                >
                  <img 
                    src={isSaved ? "/assets/icon/PostSaved.png" : "/assets/icon/PostSave.png"} 
                    alt="收藏" 
                    className={styles.interactionIcon} 
                  />
                  <span>{isSaved ? '已收藏' : '收藏'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
        </PageTransition>

        <BottomNavbar />
        
        {/* 通知組件 */}
        {notification && (
          <Notification message={notification} onClose={hideNotification} />
        )}

        {/* 確認對話框 */}
        {showConfirmNotification && (
          <ConfirmNotification
            message={confirmMessage}
            onConfirm={() => {
              confirmAction();
              setShowConfirmNotification(false);
            }}
            onCancel={() => setShowConfirmNotification(false)}
          />
        )}

        {/* 留言彈窗 */}
        {showComments && archive?.postFrame && currentUser && (
          <PostComments
            postID={archive.postFrame}
            user={currentUser}
            handleClose={handleCommentsClose}
            onCommentCountChange={handleCommentCountChange}
          />
        )}
      </div>
    </NotificationProvider>
  );
};

export default DiseaseArchiveDetailPage;