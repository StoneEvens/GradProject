import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation('archives');
  const { petId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [loading, setLoading] = useState(true);
  const [pet, setPet] = useState(null);
  const [user, setUser] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [notification, setNotification] = useState('');
  const [archiveData, setArchiveData] = useState(null);

  // Show notification
  const showNotification = (msg) => {
    setNotification(msg);
  };

  // Hide notification
  const hideNotification = () => {
    setNotification('');
  };

  // Validate abnormal post data integrity
  const validateAbnormalPostData = async () => {
    if (!archiveData || !archiveData.abnormalPostsData || archiveData.abnormalPostsData.length === 0) {
      console.log(t('diseaseArchivePreview.console.skipValidation'));
      return;
    }

    try {
      console.log(t('diseaseArchivePreview.console.startValidation'), archiveData.abnormalPostsData);
      
      const postIds = archiveData.abnormalPostsData
        .map(post => post && post.id)
        .filter(id => id != null && id !== undefined && id !== '');
        
      console.log(t('diseaseArchivePreview.console.extractedIds'), postIds);

      if (postIds.length === 0) {
        console.log(t('diseaseArchivePreview.console.noValidIds'));
        return;
      }

      const { validIds, invalidIds } = await validateAbnormalPostsExist(postIds);

      if (invalidIds.length > 0) {
        // Filter out deleted records
        const filteredAbnormalPosts = archiveData.abnormalPostsData.filter(post => 
          post && post.id && validIds.includes(post.id)
        );

        // Update archive data
        const updatedArchiveData = {
          ...archiveData,
          abnormalPostsData: filteredAbnormalPosts
        };

        setArchiveData(updatedArchiveData);

        // Sync update localStorage data
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
          console.error(t('diseaseArchivePreview.console.updateLocalStorageFailed'), storageError);
        }

        // Show notification
        showNotification(t('diseaseArchivePreview.messages.deletedRecordsDetected', { count: invalidIds.length }));
      }

    } catch (error) {
      console.error(t('diseaseArchivePreview.console.validationFailed'), error);
    }
  };

  // Load page data
  useEffect(() => {
    loadPageData();
  }, [petId]);

  // Validate data integrity when page is focused
  useEffect(() => {
    let hasNavigatedAway = false;
    let validationTimeout = null;

    const handleBeforeUnload = () => {
      hasNavigatedAway = true;
    };

    const handleVisibilityChange = () => {
      if (!document.hidden && hasNavigatedAway && archiveData && archiveData.abnormalPostsData && archiveData.abnormalPostsData.length > 0) {
        // Only validate when returning after leaving the page
        if (validationTimeout) clearTimeout(validationTimeout);
        validationTimeout = setTimeout(() => {
          validateAbnormalPostData();
          hasNavigatedAway = false; // Reset flag
        }, 1000);
      }
    };

    const handleFocus = () => {
      if (hasNavigatedAway && archiveData && archiveData.abnormalPostsData && archiveData.abnormalPostsData.length > 0) {
        // Only validate when refocusing after leaving the page
        if (validationTimeout) clearTimeout(validationTimeout);
        validationTimeout = setTimeout(() => {
          validateAbnormalPostData();
          hasNavigatedAway = false; // Reset flag
        }, 1000);
      }
    };

    // Listen for page visibility changes and window focus
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
      
      // Check if there's data passed from the previous page
      if (!location.state || !location.state.archiveData) {
        showNotification(t('diseaseArchivePreview.messages.missingDataReturnEdit'));
        setTimeout(() => {
          navigate(`/pet/${petId}/disease-archive/edit-content`);
        }, 1500);
        return;
      }
      
      // Load user profile
      const userProfile = await getUserProfile();
      setUser(userProfile);
      setCurrentUser(userProfile);
      
      // Load pet data
      const petDetail = await getPetDetail(petId);
      if (petDetail) {
        setPet(petDetail);
      }
      
      // Set archive data
      const data = location.state.archiveData;
      
      // Get real abnormal record information from localStorage
      try {
        const DRAFT_KEY = `diseaseArchiveDraft_${petId}`;
        const savedDraft = localStorage.getItem(DRAFT_KEY);

        console.log('載入 localStorage draft:', savedDraft ? '存在' : '不存在');

        if (savedDraft && (!data.abnormalPostsData || data.abnormalPostsData.length === 0)) {
          const draftData = JSON.parse(savedDraft);
          console.log('Draft 資料:', draftData);

          // 優先使用 realAbnormalPosts，因為它包含完整的 API 資料
          if (draftData.realAbnormalPosts && Array.isArray(draftData.realAbnormalPosts) && draftData.realAbnormalPosts.length > 0) {
            console.log('使用 realAbnormalPosts:', draftData.realAbnormalPosts.length, '筆');
            data.abnormalPostsData = draftData.realAbnormalPosts;
          }
          // 如果沒有 realAbnormalPosts，嘗試從 abnormalPostsForDates 構建
          else if (draftData.abnormalPostsForDates) {
            console.log('使用 abnormalPostsForDates');
            const objectValues = Object.values(draftData.abnormalPostsForDates);
            const filteredPosts = objectValues.filter(post => post && post.id);

            const abnormalPostsData = filteredPosts.map(post => {
              // 優先使用 rawData（完整的 API 資料）
              if (post.rawData) {
                console.log('使用 post.rawData:', post.rawData.id);
                return post.rawData;
              } else {
                console.warn('沒有 rawData，嘗試手動構建:', post);
                // 如果有 record_date 直接使用
                if (post.record_date) {
                  return {
                    id: post.id,
                    record_date: post.record_date,
                    symptoms: post.symptoms || [],
                    content: post.content || post.description || t('diseaseArchivePreview.defaultContent.abnormalRecord')
                  };
                }
                // 否則嘗試從 date 字串解析（容錯處理）
                return {
                  id: post.id,
                  record_date: post.date || new Date().toISOString(),
                  symptoms: post.symptoms ? (Array.isArray(post.symptoms) ? post.symptoms : [{ symptom_name: post.symptoms }]) : [],
                  content: post.description || post.content || t('diseaseArchivePreview.defaultContent.abnormalRecord')
                };
              }
            });

            console.log('構建的 abnormalPostsData:', abnormalPostsData.length, '筆');
            data.abnormalPostsData = abnormalPostsData;
          }
          // 最後嘗試其他可能的欄位
          else if (draftData.abnormalPosts && Array.isArray(draftData.abnormalPosts)) {
            console.log('使用 abnormalPosts');
            data.abnormalPostsData = draftData.abnormalPosts;
          }

          console.log('最終 abnormalPostsData:', data.abnormalPostsData ? data.abnormalPostsData.length : 0, '筆');
        }
      } catch (error) {
        console.error(t('diseaseArchivePreview.console.getLocalStorageFailed'), error);
      }
      setArchiveData(data);
      
    } catch (error) {
      console.error(t('diseaseArchivePreview.console.loadDataFailed'), error);
      showNotification(t('diseaseArchivePreview.messages.loadDataFailed'));
    } finally {
      setLoading(false);
    }
  };


  // Handle previous step
  const handlePreviousStep = () => {
    navigate(`/pet/${petId}/disease-archive/edit-content`, {
      state: {
        formData: archiveData,
        needsGeneration: false
      }
    });
  };

  // Handle confirm create archive
  const handleConfirmCreate = async () => {
    try {
      setLoading(true);
      
      // Prepare data to save
      const saveData = {
        petId: parseInt(petId),
        archiveTitle: archiveData.archiveTitle,
        generatedContent: archiveData.generated_content,
        mainCause: archiveData.mainCause || '',
        symptoms: archiveData.symptoms || [],
        includedAbnormalPostIds: archiveData.includedAbnormalPostIds || [],
        goToDoctor: archiveData.goToDoctor || false,
        healthStatus: archiveData.healthStatus || t('diseaseArchivePreview.defaultStatus.treating'),
        isPrivate: archiveData.isPrivate !== false // Default to true
      };
      
      console.log(t('diseaseArchivePreview.console.preparingToCreate'), saveData);

      // Call API to save disease archive
      const result = await saveDiseaseArchive(saveData);

      console.log(t('diseaseArchivePreview.console.createSuccess'), result);
      showNotification(t('diseaseArchivePreview.messages.createSuccess'));
      
      // Clear draft in localStorage
      const DRAFT_KEY = `diseaseArchiveDraft_${petId}`;
      localStorage.removeItem(DRAFT_KEY);
      localStorage.removeItem('diseaseArchiveDraft'); // Keep old key name just in case
      
      // Navigate to pet disease archive list page after delay
      setTimeout(() => {
        navigate(`/pet/${petId}/disease-archive`);
      }, 1500);
      
    } catch (error) {
      console.error(t('diseaseArchivePreview.console.createFailed'), error);
      showNotification(t('diseaseArchivePreview.messages.createFailed'));
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
            {t('common.loading')}
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
            {t('diseaseArchivePreview.messages.missingDataReturning')}
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
          {/* Title section */}
          <div className={styles.header}>
            <div className={styles.titleSection}>
              <img 
                src={pet?.headshot_url || '/assets/icon/DefaultAvatar.jpg'} 
                alt={pet?.pet_name}
                className={styles.petAvatar}
              />
              <span className={styles.title}>{t('diseaseArchivePreview.title')}</span>
            </div>
          </div>

          <div className={styles.divider}></div>

          {/* Disease archive preview card */}
          <ArchiveCard 
            archiveData={archiveData}
            user={user}
            pet={pet}
            currentUser={currentUser}
          />

          {/* Action buttons */}
          <div className={styles.actionButtons}>
            <button 
              className={styles.previousButton} 
              onClick={handlePreviousStep}
            >
              {t('diseaseArchivePreview.buttons.previous')}
            </button>
            <button 
              className={styles.confirmButton} 
              onClick={handleConfirmCreate}
            >
              {t('diseaseArchivePreview.buttons.confirmCreate')}
            </button>
          </div>
        </div>

        <BottomNavbar />
        
        {/* Notification component */}
        {notification && (
          <Notification message={notification} onClose={hideNotification} />
        )}
      </div>
    </NotificationProvider>
  );
};

export default DiseaseArchivePreviewPage;