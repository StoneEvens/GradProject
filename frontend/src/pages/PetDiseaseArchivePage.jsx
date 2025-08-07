import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import TopNavbar from '../components/TopNavbar';
import BottomNavbar from '../components/BottomNavigationBar';
import { NotificationProvider } from '../context/NotificationContext';
import { getUserPets, getMyDiseaseArchivesPreview } from '../services/petService';
import styles from '../styles/PetDiseaseArchivePage.module.css';

const PetDiseaseArchivePage = () => {
  const { petId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [pet, setPet] = useState(null);
  const [diseaseArchives, setDiseaseArchives] = useState([]);

  // 載入資料
  useEffect(() => {
    loadData();
  }, [petId]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // 同時載入寵物資料和疾病檔案
      const [pets, archives] = await Promise.all([
        getUserPets(),
        getMyDiseaseArchivesPreview()
      ]);
      
      // 設定當前寵物
      const currentPet = pets.find(p => p.pet_id === parseInt(petId));
      if (currentPet) {
        setPet(currentPet);
      }
      
      // 過濾出當前寵物的疾病檔案
      const petArchives = archives.filter(archive => 
        archive.pet_name === currentPet?.pet_name
      );
      setDiseaseArchives(petArchives);
      
    } catch (error) {
      console.error('載入資料失敗:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleArchiveItemClick = (archive) => {
    // 導向到疾病檔案詳細頁面
    navigate(`/pet/${petId}/disease-archive/${archive.id}`);
  };

  const handleCreateClick = () => {
    navigate(`/pet/${petId}/disease-archive/create`);
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

  return (
    <NotificationProvider>
      <div className={styles.container}>
        <TopNavbar />
        
        <div className={styles.content}>
          {/* 標題列 */}
          <div className={styles.header}>
            <div className={styles.titleSection}>
              <img 
                src={pet?.headshot_url || '/assets/icon/DefaultAvatar.jpg'} 
                alt={pet?.pet_name}
                className={styles.petAvatar}
              />
              <span className={styles.title}>的疾病檔案</span>
            </div>
            <button className={styles.newButton} onClick={handleCreateClick}>新增</button>
          </div>
          
          <div className={styles.divider}></div>

          {/* 疾病檔案列表 */}
          <div className={styles.forumList}>
            {diseaseArchives.length === 0 ? (
              <div className={styles.emptyState}>
                <img 
                  src="/assets/icon/SearchNoResult.png" 
                  alt="空狀態" 
                  className={styles.emptyIcon}
                />
                <p>尚無疾病檔案</p>
              </div>
            ) : (
              diseaseArchives.map(archive => (
                <div 
                  key={archive.id} 
                  className={styles.forumItem}
                  onClick={() => handleArchiveItemClick(archive)}
                >
                  <div className={styles.forumIcon}>
                    <img 
                      src="/assets/icon/PetpageIllnessArchiveButton.png" 
                      alt="疾病檔案"
                    />
                  </div>
                  
                  <div className={styles.forumContent}>
                    <div className={styles.forumTitleRow}>
                      <span className={styles.forumTitle}>{archive.archive_title}</span>
                      {archive.health_status === '已康復' && (
                        <span className={styles.recoveredBadge}>已康復</span>
                      )}
                    </div>
                    <div className={styles.forumInfo}>
                      <span className={styles.forumLabel}>建立日期：</span>
                      <span className={styles.forumDate}>
                        {new Date(archive.created_at).toLocaleDateString('zh-TW')}
                      </span>
                    </div>
                  </div>
                  
                  <div className={styles.forumArrow}>
                    ❯
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
        
        <BottomNavbar />
      </div>
    </NotificationProvider>
  );
};

export default PetDiseaseArchivePage;