import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from '../styles/PetPage.module.css';
import TopNavbar from '../components/TopNavbar';
import BottomNavbar from '../components/BottomNavbar';
import Notification from '../components/Notification';
import PetSwitcher from '../components/PetSwitcher';
import { NotificationProvider } from '../context/NotificationContext';
import { getUserPets } from '../services/petService';

const PetPage = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('social');
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
          name: pet.pet_name,
          age: pet.age,
          type: pet.pet_type,
          breed: pet.breed,
          weight: pet.weight,
          height: pet.height,
          pet_stage: pet.pet_stage,
          predicted_adult_weight: pet.predicted_adult_weight,
          illnesses: pet.illnesses,
          description: pet.description || '',
          basicInfo: `${pet.age ? pet.age + '歲' : ''}${pet.breed ? '，' + pet.breed : ''}${pet.pet_stage ? '，' + pet.pet_stage : ''}`,
          avatarUrl: pet.headshot_url
        }));
        
        setAllPets(formattedPets);
        setCurrentPet(formattedPets[0]);
        setNoPets(false);
      }
    } catch (error) {
      console.error('獲取寵物資料失敗:', error);
      showNotification('獲取寵物資料失敗，請稍後再試');
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

  // 切換分頁
  const handleTabChange = (tab) => {
    setActiveTab(tab);
  };

  // 切換寵物
  const handlePetSwitch = (pet) => {
    setCurrentPet(pet);
  };

  // 功能按鈕點擊處理
  const handleFunctionClick = (functionName) => {
    showNotification(`${functionName} 功能開發中`);
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
      showNotification('請選擇要編輯的寵物');
    }
  };

  // 重新獲取寵物資料
  const refreshPets = () => {
    fetchPets();
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
            <div className={styles.loadingContainer}>載入中...</div>
          ) : noPets ? (
            /* 沒有寵物時的界面 */
            <div className={styles.noPetsContainer}>
              <div className={styles.noPetsIcon}>
                <img 
                  src="/assets/icon/PetpageNopetButton.png" 
                  alt="沒有寵物" 
                  className={styles.noPetImage}
                />
              </div>
              <div className={styles.noPetsText}>
                <div className={styles.noPetsTitle}>您目前沒有寵物資料</div>
                <div className={styles.noPetsSubtitle}>馬上新增您的寵物以使用寵物頁面</div>
              </div>
              <button className={styles.addFirstPetButton} onClick={handleAddPet}>
                新增寵物
              </button>
            </div>
          ) : currentPet && (
            <>
              {/* 寵物頭像與基本資訊 */}
              <div className={styles.petHeader}>
                <div className={styles.avatarSection}>
                  <img 
                    src={currentPet.avatarUrl || '/assets/icon/DefaultAvatar.jpg'} 
                    alt={currentPet.name} 
                    className={styles.avatar}
                  />
                </div>
                <div className={styles.petInfo}>
                  <div className={styles.petName}>{currentPet.name}</div>
                  <div className={styles.petBreed}>{currentPet.breed}</div>
                  <div className={styles.petDescription}>
                    {currentPet.description || currentPet.basicInfo || '這隻寵物很可愛，主人還沒有添加描述。'}
                  </div>
                </div>
              </div>

              {/* 分頁切換 */}
              <div className={styles.tabs}>
                <button
                  className={`${styles.tab} ${activeTab === 'social' ? styles.active : ''}`}
                  onClick={() => handleTabChange('social')}
                >
                  社交
                </button>
                <button
                  className={`${styles.tab} ${activeTab === 'health' ? styles.active : ''}`}
                  onClick={() => handleTabChange('health')}
                >
                  健康
                </button>
                <button
                  className={`${styles.tab} ${activeTab === 'daily' ? styles.active : ''}`}
                  onClick={() => handleTabChange('daily')}
                >
                  日常
                </button>
              </div>

              {/* 功能按鈕區域 */}
              <div className={styles.functionGrid}>
                {activeTab === 'social' && (
                  <>
                    <div className={styles.functionCell} onClick={handleEditPet}>
                      <img src="/assets/icon/PetpageEditButton.png" alt="編輯資料" className={styles.functionIcon} />
                      <span className={styles.functionLabel}>編輯資料</span>
                    </div>
                    <div className={styles.functionCell} onClick={() => handleFunctionClick('相關貼文')}>
                      <img src="/assets/icon/PetpagePastPostButton.png" alt="相關貼文" className={styles.functionIcon} />
                      <span className={styles.functionLabel}>相關貼文</span>
                    </div>
                    <div className={styles.functionCell} onClick={() => handleFunctionClick('寵物社群')}>
                      <img src="/assets/icon/PetpagePetFriendsButton.png" alt="寵物社群" className={styles.functionIcon} />
                      <span className={styles.functionLabel}>寵物社群</span>
                    </div>
                  </>
                )}
                
                {activeTab === 'health' && (
                  <>
                    <div className={styles.functionCell} onClick={() => handleFunctionClick('健康報告')}>
                      <img src="/assets/icon/PetpageHealthReportButton.png" alt="健康報告" className={styles.functionIcon} />
                      <span className={styles.functionLabel}>健康報告</span>
                    </div>
                    <div className={styles.functionCell} onClick={() => handleFunctionClick('疾病檔案')}>
                      <img src="/assets/icon/PetpageIllnessArchiveButton.png" alt="疾病檔案" className={styles.functionIcon} />
                      <span className={styles.functionLabel}>疾病檔案</span>
                    </div>
                    <div className={styles.functionCell} onClick={() => handleFunctionClick('異常貼文')}>
                      <img src="/assets/icon/PetpagePetAbnormalPostButton.png" alt="異常貼文" className={styles.functionIcon} />
                      <span className={styles.functionLabel}>異常貼文</span>
                    </div>
                    <div className={styles.functionCell} onClick={() => handleFunctionClick('統計資料')}>
                      <img src="/assets/icon/PetpageStatisticsButton.png" alt="統計資料" className={styles.functionIcon} />
                      <span className={styles.functionLabel}>統計資料</span>
                    </div>
                  </>
                )}

                {activeTab === 'daily' && (
                  <>
                    <div className={styles.functionCell} onClick={() => handleFunctionClick('日程安排')}>
                      <img src="/assets/icon/PetpageScheduleButton.png" alt="日程安排" className={styles.functionIcon} />
                      <span className={styles.functionLabel}>日程安排</span>
                    </div>
                    <div className={styles.functionCell} onClick={() => handleFunctionClick('常用飼料')}>
                      <img src="/assets/icon/PetpageFeedButton.png" alt="常用飼料" className={styles.functionIcon} />
                      <span className={styles.functionLabel}>常用飼料</span>
                    </div>
                    <div className={styles.functionCell} onClick={() => handleFunctionClick('購物記錄')}>
                      <img src="/assets/icon/PetpageShoppingRecordsButton.png" alt="購物記錄" className={styles.functionIcon} />
                      <span className={styles.functionLabel}>購物記錄</span>
                    </div>
                  </>
                )}
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