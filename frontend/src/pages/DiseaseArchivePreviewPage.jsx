import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import TopNavbar from '../components/TopNavbar';
import BottomNavbar from '../components/BottomNavigationBar';
import Notification from '../components/Notification';
import ArchiveCard from '../components/ArchiveCard';
import SymptomCalendar from '../components/SymptomCalendar';
import { NotificationProvider } from '../context/NotificationContext';
import { getPetDetail, validateAbnormalPostsExist, saveDiseaseArchive } from '../services/petService';
import { getUserProfile } from '../services/userService';
import styles from '../styles/DiseaseArchivePreviewPage.module.css';

const DiseaseArchivePreviewPage = () => {
  const { petId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [loading, setLoading] = useState(true);
  const [pet, setPet] = useState(null);
  const [user, setUser] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [notification, setNotification] = useState('');
  const [archiveData, setArchiveData] = useState(null);

  // 顯示通知
  const showNotification = (msg) => {
    setNotification(msg);
  };

  // 隱藏通知
  const hideNotification = () => {
    setNotification('');
  };

  // 驗證異常記錄數據完整性
  const validateAbnormalPostData = async () => {
    if (!archiveData || !archiveData.abnormalPostsData || archiveData.abnormalPostsData.length === 0) {
      console.log('跳過驗證：沒有異常記錄數據');
      return;
    }

    try {
      console.log('開始驗證異常記錄數據:', archiveData.abnormalPostsData);
      
      const postIds = archiveData.abnormalPostsData
        .map(post => post && post.id)
        .filter(id => id != null && id !== undefined && id !== '');
        
      console.log('提取到的異常記錄ID:', postIds);
      
      if (postIds.length === 0) {
        console.log('沒有有效的異常記錄ID');
        return;
      }

      const { validIds, invalidIds } = await validateAbnormalPostsExist(postIds);

      if (invalidIds.length > 0) {
        // 過濾掉已刪除的記錄
        const filteredAbnormalPosts = archiveData.abnormalPostsData.filter(post => 
          post && post.id && validIds.includes(post.id)
        );

        // 更新archive數據
        const updatedArchiveData = {
          ...archiveData,
          abnormalPostsData: filteredAbnormalPosts
        };

        setArchiveData(updatedArchiveData);

        // 同步更新localStorage中的數據
        try {
          const DRAFT_KEY = `diseaseArchiveDraft_${petId}`;
          const savedDraft = localStorage.getItem(DRAFT_KEY);
          if (savedDraft) {
            const draftData = JSON.parse(savedDraft);
            if (draftData.realAbnormalPosts) {
              draftData.realAbnormalPosts = draftData.realAbnormalPosts.filter(post => 
                post && post.id && validIds.includes(post.id)
              );
              localStorage.setItem(DRAFT_KEY, JSON.stringify(draftData));
            }
          }
        } catch (storageError) {
          console.error('更新localStorage失敗:', storageError);
        }

        // 顯示通知
        showNotification(`檢測到 ${invalidIds.length} 筆異常記錄已被刪除，已自動更新預覽`);
      }

    } catch (error) {
      console.error('驗證異常記錄數據失敗:', error);
    }
  };

  // 載入頁面數據
  useEffect(() => {
    loadPageData();
  }, [petId]);

  // 頁面聚焦時驗證數據完整性
  useEffect(() => {
    let hasNavigatedAway = false;
    let validationTimeout = null;

    const handleBeforeUnload = () => {
      hasNavigatedAway = true;
    };

    const handleVisibilityChange = () => {
      if (!document.hidden && hasNavigatedAway && archiveData && archiveData.abnormalPostsData && archiveData.abnormalPostsData.length > 0) {
        // 只有在離開過頁面後重新回來才驗證
        if (validationTimeout) clearTimeout(validationTimeout);
        validationTimeout = setTimeout(() => {
          validateAbnormalPostData();
          hasNavigatedAway = false; // 重置標記
        }, 1000);
      }
    };

    const handleFocus = () => {
      if (hasNavigatedAway && archiveData && archiveData.abnormalPostsData && archiveData.abnormalPostsData.length > 0) {
        // 只有在離開過頁面後重新聚焦才驗證
        if (validationTimeout) clearTimeout(validationTimeout);
        validationTimeout = setTimeout(() => {
          validateAbnormalPostData();
          hasNavigatedAway = false; // 重置標記
        }, 1000);
      }
    };

    // 監聽頁面可見性變化和窗口聚焦
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);  
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (validationTimeout) clearTimeout(validationTimeout);
    };
  }, [archiveData]);

  const loadPageData = async () => {
    try {
      setLoading(true);
      
      // 檢查是否有從前一頁傳來的數據
      if (!location.state || !location.state.archiveData) {
        showNotification('缺少必要數據，返回編輯頁面');
        setTimeout(() => {
          navigate(`/pet/${petId}/disease-archive/edit-content`);
        }, 1500);
        return;
      }
      
      // 載入用戶資料
      const userProfile = await getUserProfile();
      setUser(userProfile);
      setCurrentUser(userProfile);
      
      // 載入寵物資料
      const petDetail = await getPetDetail(petId);
      if (petDetail) {
        setPet(petDetail);
      }
      
      // 設置檔案數據
      const data = location.state.archiveData;
      
      // 從localStorage中獲取真實的異常記錄資訊
      try {
        const DRAFT_KEY = `diseaseArchiveDraft_${petId}`;
        const savedDraft = localStorage.getItem(DRAFT_KEY);
        
        
        if (savedDraft && (!data.abnormalPostsData || data.abnormalPostsData.length === 0)) {
          const draftData = JSON.parse(savedDraft);
          
          
          if (draftData.abnormalPostsForDates) {
            const objectValues = Object.values(draftData.abnormalPostsForDates);
            const filteredPosts = objectValues.filter(post => post && post.id);
            
            const abnormalPostsData = filteredPosts.map(post => {
              // 如果有rawData使用rawData，否則使用post本身
              if (post.rawData) {
                return post.rawData;
              } else {
                // 構建標準格式的異常記錄數據
                return {
                  id: post.id,
                  record_date: `2025-${String(post.date.split('月')[0]).padStart(2, '0')}-${String(post.date.split('月')[1].split('日')[0]).padStart(2, '0')}T12:00:00Z`,
                  symptoms: post.symptoms ? [{ symptom_name: post.symptoms }] : [],
                  content: post.description || '異常記錄'
                };
              }
            });
            
            data.abnormalPostsData = abnormalPostsData;
          }
          
          // 如果沒有從abnormalPostsForDates找到，嘗試其他可能的來源
          if (!data.abnormalPostsData || data.abnormalPostsData.length === 0) {
            // 嘗試從其他可能的字段獲取
            if (draftData.realAbnormalPosts && Array.isArray(draftData.realAbnormalPosts)) {
              data.abnormalPostsData = draftData.realAbnormalPosts;
            }
          }
          
          // 優先使用realAbnormalPosts，因為它包含完整的API數據
          if (draftData.realAbnormalPosts && Array.isArray(draftData.realAbnormalPosts) && draftData.realAbnormalPosts.length > 0) {
            data.abnormalPostsData = draftData.realAbnormalPosts;
          }
        }
      } catch (error) {
        console.error('從localStorage獲取異常記錄失敗:', error);
      }
      setArchiveData(data);
      
    } catch (error) {
      console.error('載入資料失敗:', error);
      showNotification('載入資料失敗');
    } finally {
      setLoading(false);
    }
  };


  // 處理上一步
  const handlePreviousStep = () => {
    navigate(`/pet/${petId}/disease-archive/edit-content`, {
      state: {
        formData: archiveData,
        needsGeneration: false
      }
    });
  };

  // 處理確認建立檔案
  const handleConfirmCreate = async () => {
    try {
      setLoading(true);
      
      // 準備儲存的數據
      const saveData = {
        petId: parseInt(petId),
        archiveTitle: archiveData.archiveTitle,
        generatedContent: archiveData.generated_content,
        mainCause: archiveData.mainCause || '',
        symptoms: archiveData.symptoms || [],
        includedAbnormalPostIds: archiveData.includedAbnormalPostIds || [],
        goToDoctor: archiveData.goToDoctor || false,
        healthStatus: archiveData.healthStatus || '治療中',
        isPrivate: archiveData.isPrivate !== false // 預設為 true
      };
      
      console.log('準備建立疾病檔案:', saveData);
      
      // 呼叫 API 儲存疾病檔案
      const result = await saveDiseaseArchive(saveData);
      
      console.log('疾病檔案建立成功:', result);
      showNotification('疾病檔案建立成功！');
      
      // 清除 localStorage 中的草稿
      const DRAFT_KEY = `diseaseArchiveDraft_${petId}`;
      localStorage.removeItem(DRAFT_KEY);
      localStorage.removeItem('diseaseArchiveDraft'); // 保留舊的鍵名以防萬一
      
      // 延遲後導向到疾病檔案詳細頁面
      setTimeout(() => {
        if (result && result.id) {
          navigate(`/pet/${petId}/disease-archive/${result.id}`);
        } else {
          navigate(`/pet/${petId}/disease-archive`);
        }
      }, 1500);
      
    } catch (error) {
      console.error('建立疾病檔案失敗:', error);
      showNotification('建立疾病檔案失敗，請稍後再試');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <NotificationProvider>
        <div className={styles.container}>
          <TopNavbar />
          <div className={styles.loadingContainer}>
            載入中...
          </div>
          <BottomNavbar />
        </div>
      </NotificationProvider>
    );
  }

  if (!archiveData) {
    return (
      <NotificationProvider>
        <div className={styles.container}>
          <TopNavbar />
          <div className={styles.errorContainer}>
            缺少必要數據，正在返回編輯頁面...
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
        
        <div className={styles.content}>
          {/* 標題區域 */}
          <div className={styles.header}>
            <div className={styles.titleSection}>
              <img 
                src={pet?.headshot_url || '/assets/icon/DefaultAvatar.jpg'} 
                alt={pet?.pet_name}
                className={styles.petAvatar}
              />
              <span className={styles.title}>疾病檔案預覽</span>
            </div>
          </div>

          <div className={styles.divider}></div>

          {/* 疾病檔案預覽卡片 */}
          <ArchiveCard 
            archiveData={archiveData}
            user={user}
            pet={pet}
            currentUser={currentUser}
          />

          {/* 操作按鈕 */}
          <div className={styles.actionButtons}>
            <button 
              className={styles.previousButton} 
              onClick={handlePreviousStep}
            >
              上一步
            </button>
            <button 
              className={styles.confirmButton} 
              onClick={handleConfirmCreate}
            >
              確認建立
            </button>
          </div>
        </div>

        <BottomNavbar />
        
        {/* 通知組件 */}
        {notification && (
          <Notification message={notification} onClose={hideNotification} />
        )}
      </div>
    </NotificationProvider>
  );
};

export default DiseaseArchivePreviewPage;