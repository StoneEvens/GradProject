import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import TopNavbar from '../components/TopNavbar';
import BottomNavbar from '../components/BottomNavigationbar';
import ImageViewer from '../components/ImageViewer';
import { NotificationProvider } from '../context/NotificationContext';
import { getAbnormalPostDetail, getPublicAbnormalPostDetail, getUserPets, deleteAbnormalPost } from '../services/petService';
import { getUserProfile } from '../services/userService';
import Notification from '../components/Notification';
import ConfirmNotification from '../components/ConfirmNotification';
import { useSymptomTranslation } from '../hooks/useSymptomTranslation';
import styles from '../styles/AbnormalPostDetailPage.module.css';

const AbnormalPostDetailPage = () => {
  const { t } = useTranslation('posts');
  const { translateSingleSymptom } = useSymptomTranslation();
  const { petId, postId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  
  // 檢測是否為公開瀏覽模式
  const isPublicView = window.location.pathname.includes('/public');
  const [loading, setLoading] = useState(true);
  const [post, setPost] = useState(null);
  const [pet, setPet] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [showMenu, setShowMenu] = useState(false);
  const [showImageViewer, setShowImageViewer] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [notification, setNotification] = useState('');
  const [showConfirmNotification, setShowConfirmNotification] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState('');
  const [confirmAction, setConfirmAction] = useState(null);

  // Refs for scrollable containers  
  const imageContainerRef = useRef(null);

  useEffect(() => {
    loadData();
  }, [petId, postId]);


  // 處理滑鼠滾輪橫向滾動 - 圖片容器
  useEffect(() => {
    const container = imageContainerRef.current;
    if (!container || !post?.images?.length) return;

    const handleWheel = (e) => {
      if (e.deltaY !== 0) {
        e.preventDefault();
        container.scrollLeft += e.deltaY;
      }
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      container.removeEventListener('wheel', handleWheel);
    };
  }, [post?.images]);

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
      
      if (isPublicView) {
        // 公開模式：只需要獲取異常記錄詳情，用戶和寵物資訊會包含在回應中
        const postData = await getPublicAbnormalPostDetail(postId);
        
        if (postData) {
          setPost(postData);
          // 從異常記錄資料中提取寵物和用戶資訊
          if (postData.pet_info) {
            setPet(postData.pet_info);
          }
          if (postData.user_info) {
            setCurrentUser(postData.user_info);
          }
        } else {
          console.error(t('abnormalPostDetail.messages.publicPostNotFound'));
          navigate('/social?tab=forum');
        }
      } else {
        // 私人模式：載入用戶資料、寵物資料和異常記錄詳情
        const [userProfile, pets, postData] = await Promise.all([
          getUserProfile(),
          getUserPets(),
          getAbnormalPostDetail(petId, postId)
        ]);
        
        setCurrentUser(userProfile);
        
        const currentPet = pets.find(p => p.pet_id === parseInt(petId));
        if (currentPet) {
          setPet(currentPet);
        }
        
        if (postData) {
          setPost(postData);
        } else {
          console.error(t('abnormalPostDetail.messages.postNotFound'));
          navigate(`/pet/${petId}/abnormal-posts`);
        }
      }
      
      // 除錯資訊
      console.log('Debug - isPublicView:', isPublicView);
      console.log('Debug - post:', post);
      console.log('Debug - pet:', pet);
      
    } catch (error) {
      console.error('載入資料失敗:', error);
      if (isPublicView) {
        navigate('/social?tab=forum');
      } else {
        navigate(`/pet/${petId}/abnormal-posts`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    // 檢查是否有目標異常記錄ID
    if (location.state?.targetAbnormalPostId) {
      // 將目標異常記錄ID存儲到 sessionStorage
      sessionStorage.setItem('targetAbnormalPostId', location.state.targetAbnormalPostId);
    }
    
    // 如果是從編輯頁面來的
    if (location.state?.fromEdit) {
      // 如果原本是從疾病檔案詳情頁來的，返回到疾病檔案詳情頁
      if (location.state?.fromDiseaseArchive && location.state?.diseaseArchiveId) {
        navigate(`/pet/${petId}/disease-archive/${location.state.diseaseArchiveId}`, {
          state: { fromEditAbnormal: true }
        });
      } else {
        // 否則導航到異常記錄列表頁
        navigate(`/pet/${petId}/abnormal-posts`);
      }
    } else {
      // 否則返回上一頁
      navigate(-1);
    }
  };

  const handleEdit = () => {
    navigate(`/pet/${petId}/abnormal-post/${postId}/edit`, {
      state: {
        fromDiseaseArchive: location.state?.fromDiseaseArchive,
        diseaseArchiveId: location.state?.diseaseArchiveId
      }
    });
  };

  const handleDelete = () => {
    setShowMenu(false);
    showConfirmDialog(
      t('abnormalPostDetail.ui.deleteConfirmMessage'),
      async () => {
        try {
          setLoading(true);
          await deleteAbnormalPost(petId, postId);
          showNotification(t('abnormalPostDetail.messages.deleteSuccess'));
          // 延遲跳轉讓用戶看到成功訊息
          setTimeout(() => {
            navigate(`/pet/${petId}/abnormal-posts`);
          }, 1500);
        } catch (error) {
          console.error('刪除失敗:', error);
          let errorMessage = t('abnormalPostDetail.messages.deleteFailed');

          if (error.response?.data?.message) {
            errorMessage = error.response.data.message;
          } else if (error.response?.status === 404) {
            errorMessage = t('abnormalPostDetail.messages.postNotFound');
          } else if (error.response?.status === 403) {
            errorMessage = t('abnormalPostDetail.messages.noPermission');
          }
          
          showNotification(errorMessage);
        } finally {
          setLoading(false);
        }
      }
    );
  };

  const handleImageClick = (index) => {
    setSelectedImageIndex(index);
    setShowImageViewer(true);
  };

  const handleCloseImageViewer = () => {
    setShowImageViewer(false);
  };

  const toggleMenu = () => {
    setShowMenu(!showMenu);
  };

  // 顯示通知
  const showNotification = (msg) => {
    setNotification(msg);
  };

  // 隱藏通知
  const hideNotification = () => {
    setNotification('');
  };

  // 顯示確認對話框
  const showConfirmDialog = (message, onConfirm) => {
    setConfirmMessage(message);
    setConfirmAction(() => onConfirm);
    setShowConfirmNotification(true);
  };

  // 處理確認對話框的確認按鈕
  const handleConfirmAction = () => {
    if (confirmAction) {
      confirmAction();
    }
    setShowConfirmNotification(false);
    setConfirmAction(null);
  };

  // 處理確認對話框的取消按鈕
  const handleCancelAction = () => {
    setShowConfirmNotification(false);
    setConfirmAction(null);
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return t('abnormalPostDetail.ui.dateTitle', { year, month, day });
  };

  const formatSymptoms = (symptoms) => {
    if (!symptoms || symptoms.length === 0) return [];
    return symptoms.map(s => translateSingleSymptom(s.symptom_name));
  };

  if (loading) {
    return (
      <NotificationProvider>
        <div className={styles.container}>
          <TopNavbar />
          <div className={styles.loadingContainer}>
            {t('common.loading')}
          </div>
          <BottomNavbar />
        </div>
      </NotificationProvider>
    );
  }

  if (!post) {
    return (
      <NotificationProvider>
        <div className={styles.container}>
          <TopNavbar />
          <div className={styles.errorContainer}>
            {t('abnormalPostDetail.messages.postNotFound')}
          </div>
          <BottomNavbar />
        </div>
      </NotificationProvider>
    );
  }

  return (
    <NotificationProvider>
      <div className={styles.container}>
        <TopNavbar />
        
        {/* 通知組件 */}
        {notification && (
          <Notification message={notification} onClose={hideNotification} />
        )}
        
        {/* 確認對話框 */}
        {showConfirmNotification && (
          <ConfirmNotification 
            message={confirmMessage}
            onConfirm={handleConfirmAction}
            onCancel={handleCancelAction}
          />
        )}
        
        <div className={styles.content}>
          {/* 標題區域 */}
          <div className={styles.header}>
            <button className={styles.backButton} onClick={handleBack}>
              ❮
            </button>
            <h2 className={styles.title}>{formatDate(post.record_date)}</h2>
            {/* 只有非公開模式且寵物主人才能看到選單 */}
            {!isPublicView && currentUser && pet && currentUser.id === pet.owner && (
              <div className={styles.menuContainer}>
                <button className={styles.menuButton} onClick={toggleMenu}>
                  <img src="/assets/icon/PostMoreInfo.png" alt={t('abnormalPostDetail.ui.moreOptions')} />
                </button>
                {showMenu && (
                  <div className={styles.menuDropdown}>
                    <button className={styles.menuItem} onClick={handleEdit}>
                      {t('abnormalPostDetail.ui.editRecord')}
                    </button>
                    <button className={styles.menuItem} onClick={handleDelete}>
                      {t('abnormalPostDetail.ui.deleteRecord')}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
          
          <div className={styles.divider}></div>

          {/* 寵物資訊區域 */}
          <div className={styles.section}>
            <label className={styles.sectionLabel}>{t('createAbnormalPost.sections.selectPet')}:</label>
            <div className={styles.petRow}>
              <div className={styles.petInfo}>
                <img
                  src={pet?.headshot_url || '/assets/icon/DefaultAvatar.jpg'}
                  alt={pet?.pet_name}
                  className={styles.petAvatar}
                />
              </div>
              <div className={styles.emergencyCheckbox}>
                <input 
                  type="checkbox"
                  checked={post.is_emergency}
                  disabled
                  className={styles.checkbox}
                  id="emergency"
                />
                <label htmlFor="emergency" className={styles.checkboxLabel}>
                  {t('createAbnormalPost.dateSelection.emergency')}
                </label>
              </div>
            </div>
          </div>

          {/* 症狀區域 */}
          <div className={styles.section}>
            <label className={styles.sectionLabel}>{t('createAbnormalPost.symptoms.title')}</label>
            <div className={styles.symptomSection}>
              <div className={styles.symptomsContainer}>
                {formatSymptoms(post.symptoms).map((symptom, index) => (
                  <div key={index} className={styles.symptomTag}>
                    <span className={styles.symptomText}>{translateSingleSymptom(symptom)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 身體數值區域 */}
          <div className={styles.section}>
            <label className={styles.sectionLabel}>{t('createAbnormalPost.bodyStats.title')}</label>
            <div className={styles.bodyStatsContainer}>
              <div className={styles.statRow}>
                <span className={styles.statLabel}>{t('createAbnormalPost.bodyStats.weight')}</span>
                <div className={styles.statInputWrapper}>
                  <input 
                    type="text"
                    value={post.weight || ''}
                    readOnly
                    className={styles.statInput}
                  />
                  <span className={styles.statUnit}>{t('createAbnormalPost.bodyStats.units.kg')}</span>
                </div>
              </div>
              <div className={styles.statRow}>
                <span className={styles.statLabel}>{t('createAbnormalPost.bodyStats.waterIntake')}</span>
                <div className={styles.statInputWrapper}>
                  <input 
                    type="text"
                    value={post.water_amount ? (post.water_amount / 1000).toString() : ''}
                    readOnly
                    className={styles.statInput}
                  />
                  <span className={styles.statUnit}>{t('createAbnormalPost.bodyStats.units.liters')}</span>
                </div>
              </div>
              <div className={styles.statRow}>
                <span className={styles.statLabel}>{t('createAbnormalPost.bodyStats.temperature')}</span>
                <div className={styles.statInputWrapper}>
                  <input 
                    type="text"
                    value={post.body_temperature || ''}
                    readOnly
                    className={styles.statInput}
                  />
                  <span className={styles.statUnit}>{t('createAbnormalPost.bodyStats.units.celsius')}</span>
                </div>
              </div>
            </div>
          </div>

          {/* 補充描述區域 */}
          <div className={styles.section}>
            <label className={styles.sectionLabel}>{t('createAbnormalPost.description.title')}</label>
            <div className={styles.descriptionSection}>
              <div className={styles.descriptionContent}>
                {post.content || t('abnormalPostDetail.ui.noDescription')}
              </div>
            </div>
          </div>

          {/* 圖片區域 */}
          {post.images && post.images.length > 0 && (
            <div className={styles.section}>
              <label className={styles.sectionLabel}>{t('createAbnormalPost.imageUpload.title')}</label>
              <div className={styles.imageSection}>
                <div ref={imageContainerRef} className={styles.imagePreviewContainer}>
                  {post.images.map((image, index) => (
                    <div 
                      key={image.id || index} 
                      className={styles.imagePreview}
                      onClick={() => handleImageClick(index)}
                      style={{ cursor: 'pointer' }}
                    >
                      <img 
                        src={image.url || image.firebase_url}
                        alt={t('abnormalPostDetail.ui.imageAlt', { index: index + 1 })}
                        className={styles.postImage}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

        </div>
        
        {/* 圖片檢視器 */}
        <ImageViewer 
          isOpen={showImageViewer}
          onClose={handleCloseImageViewer}
          images={post?.images || []}
          initialIndex={selectedImageIndex}
        />
        
        <BottomNavbar />
      </div>
    </NotificationProvider>
  );
};

export default AbnormalPostDetailPage;