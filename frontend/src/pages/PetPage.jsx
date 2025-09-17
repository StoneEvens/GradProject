import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import styles from '../styles/PetPage.module.css';
import TopNavbar from '../components/TopNavbar';
import BottomNavbar from '../components/BottomNavigationbar';
import Notification from '../components/Notification';
import PetSwitcher from '../components/PetSwitcher';
import { NotificationProvider } from '../context/NotificationContext';
import { getUserPets } from '../services/petService';

const PetPage = () => {
  const { t } = useTranslation('pet');
  const navigate = useNavigate();
  const [notification, setNotification] = useState('');
  const [currentPet, setCurrentPet] = useState(null);
  const [allPets, setAllPets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [noPets, setNoPets] = useState(false);

  // 顯示通知
  const showNotification = (msg) => {
    setNotification(msg);
  };

  // 隱藏通知
  const hideNotification = () => {
    setNotification('');
  };

  // 獲取寵物資料的函數
  const fetchPets = async () => {
    setLoading(true);
    try {
      const pets = await getUserPets();
      
      if (!pets || pets.length === 0) {
        setNoPets(true);
        setAllPets([]);
        setCurrentPet(null);
      } else {
        // 轉換後端資料格式為前端使用的格式
        const formattedPets = pets.map(pet => ({
          id: pet.pet_id,
          pet_name: pet.pet_name,
          age: pet.age,
          type: pet.pet_type,
          breed: pet.breed,
          weight: pet.weight,
          height: pet.height,
          pet_stage: pet.pet_stage,
          predicted_adult_weight: pet.predicted_adult_weight,
          illnesses: pet.illnesses,
          description: pet.description || '',
          basicInfo: `${pet.age ? pet.age + t('page.ageUnit') : ''}${pet.breed ? '，' + pet.breed : ''}${pet.pet_stage ? '，' + pet.pet_stage : ''}`,
          avatarUrl: pet.headshot_url
        }));
        
        setAllPets(formattedPets);
        setCurrentPet(formattedPets[0]);
        setNoPets(false);
      }
    } catch (error) {
      console.error('Failed to fetch pet data:', error);
      showNotification(t('page.messages.fetchError'));
      setNoPets(true);
      setAllPets([]);
      setCurrentPet(null);
    } finally {
      setLoading(false);
    }
  };

  // 從後端 API 獲取寵物資料
  useEffect(() => {
    fetchPets();
  }, []);

  // 切換寵物
  const handlePetSwitch = (pet) => {
    setCurrentPet(pet);
  };

  // 功能按鈕點擊處理
  const handleFunctionClick = (functionName) => {
    showNotification(`${functionName} ${t('page.messages.featureInDevelopment')}`);
  };

  // 新增寵物
  const handleAddPet = () => {
    navigate('/pet/add');
  };

  // 編輯寵物資料
  const handleEditPet = () => {
    if (currentPet) {
      navigate(`/pet/${currentPet.id}/edit`);
    } else {
      showNotification(t('page.messages.selectPetToEdit'));
    }
  };

  // 查看相關貼文
  const handleRelatedPostsClick = () => {
    if (currentPet) {
      navigate(`/pet/${currentPet.id}/posts`);
    } else {
      showNotification(t('page.messages.selectPetFirst'));
    }
  };

  // 重新獲取寵物資料
  const refreshPets = () => {
    fetchPets();
  };

  // 處理異常記錄點擊 - 查看異常記錄列表
  const handleAbnormalPostClick = () => {
    if (currentPet) {
      // TODO: 導航到異常記錄列表頁面
      navigate(`/pet/${currentPet.id}/abnormal-posts`);
    } else {
      showNotification(t('page.messages.selectPetFirst'));
    }
  };

  return (
    <NotificationProvider>
      <div className={styles.container}>
        <TopNavbar />
        {notification && (
          <Notification message={notification} onClose={hideNotification} />
        )}
        <main className={styles.content}>
          {loading ? (
            <div className={styles.loadingContainer}>{t('page.loading')}</div>
          ) : noPets ? (
            /* 沒有寵物時的界面 */
            <div className={styles.noPetsContainer}>
              <div className={styles.noPetsIcon}>
                <img 
                  src="/assets/icon/PetpageNopetButton.png" 
                  alt={t('page.noData')} 
                  className={styles.noPetImage}
                />
              </div>
              <div className={styles.noPetsText}>
                <div className={styles.noPetsTitle}>{t('page.noData')}</div>
                <div className={styles.noPetsSubtitle}>{t('page.noDataSubtitle')}</div>
              </div>
              <button className={styles.addFirstPetButton} onClick={handleAddPet}>
                {t('addPet')}
              </button>
            </div>
          ) : currentPet && (
            <>
              {/* 寵物頭像與基本資訊 */}
              <div className={styles.petHeader}>
                <div className={styles.avatarSection}>
                  <img 
                    src={currentPet.avatarUrl || '/assets/icon/DefaultAvatar.jpg'} 
                    alt={currentPet.pet_name} 
                    className={styles.avatar}
                  />
                </div>
                <div className={styles.petInfo}>
                  <div className={styles.petName}>{currentPet.pet_name}</div>
                  <div className={styles.petBreed}>{currentPet.breed}</div>
                  <div className={styles.petDescription}>
                    {currentPet.description || currentPet.basicInfo || t('page.defaultDescription')}
                  </div>
                </div>
              </div>

              {/* 分隔線 */}
              <div className={styles.divider}></div>

              {/* 功能按鈕區域 - 統一顯示所有功能 */}
              <div className={styles.functionGrid}>
                <div className={styles.functionCell} onClick={handleEditPet}>
                  <img src="/assets/icon/PetpageEditButton.png" alt={t('page.functions.editData')} className={styles.functionIcon} />
                  <span className={styles.functionLabel}>{t('page.functions.editData')}</span>
                </div>
                <div className={styles.functionCell} onClick={() => handleRelatedPostsClick()}>
                  <img src="/assets/icon/PetpagePastPostButton.png" alt={t('page.functions.relatedPosts')} className={styles.functionIcon} />
                  <span className={styles.functionLabel}>{t('page.functions.relatedPosts')}</span>
                </div>
                <div className={styles.functionCell} onClick={() => navigate('/feeds')}>
                  <img src="/assets/icon/PetpageFeedButton.png" alt={t('page.functions.feedArea')} className={styles.functionIcon} />
                  <span className={styles.functionLabel}>{t('page.functions.feedArea')}</span>
                </div>
                <div className={styles.functionCell} onClick={() => {
                  if (currentPet) {
                    navigate(`/pet/${currentPet.id}/disease-archive`);
                  } else {
                    showNotification('請先選擇一隻寵物');
                  }
                }}>
                  <img src="/assets/icon/PetpageIllnessArchiveButton.png" alt={t('page.functions.diseaseArchive')} className={styles.functionIcon} />
                  <span className={styles.functionLabel}>{t('page.functions.diseaseArchive')}</span>
                </div>
                <div className={styles.functionCell} onClick={handleAbnormalPostClick}>
                  <img src="/assets/icon/PetpagePetAbnormalPostButton.png" alt={t('page.functions.abnormalRecord')} className={styles.functionIcon} />
                  <span className={styles.functionLabel}>{t('page.functions.abnormalRecord')}</span>
                </div>
                <div className={styles.functionCell} onClick={() => {
                  if (currentPet) {
                    navigate(`/pet/${currentPet.id}/health-reports`);
                  } else {
                    showNotification(t('page.messages.selectPetFirst'));
                  }
                }}>
                  <img src="/assets/icon/PetpageHealthReportButton.png" alt={t('page.functions.healthReport')} className={styles.functionIcon} />
                  <span className={styles.functionLabel}>{t('page.functions.healthReport')}</span>
                </div>
              </div>

              {/* 新的切換寵物組件 */}
              <PetSwitcher
                allPets={allPets}
                currentPet={currentPet}
                onPetSwitch={handlePetSwitch}
                onAddPet={handleAddPet}
                showNotification={showNotification}
              />
            </>
          )}
        </main>
        <BottomNavbar />
      </div>
    </NotificationProvider>
  );
};

export default PetPage; 