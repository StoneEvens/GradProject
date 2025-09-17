import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import TopNavbar from '../components/TopNavbar';
import BottomNavbar from '../components/BottomNavigationbar';
import AbnormalPostFilter from '../components/AbnormalPostFilter';
import { NotificationProvider } from '../context/NotificationContext';
import { getPetAbnormalPostsPreview, getUserPets, getSymptoms } from '../services/petService';
import { useSymptomTranslation } from '../hooks/useSymptomTranslation';
import styles from '../styles/PetAbnormalPostsPage.module.css';

const PetAbnormalPostsPage = () => {
  const { t, i18n } = useTranslation('posts');
  const { translateSymptomList, formatSymptomsForDisplay, reverseTranslateSymptom } = useSymptomTranslation();
  const { petId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [pet, setPet] = useState(null);
  const [abnormalPosts, setAbnormalPosts] = useState([]);
  const [filteredPosts, setFilteredPosts] = useState([]);
  const [allSymptoms, setAllSymptoms] = useState([]);
  const [filters, setFilters] = useState({
    type: 'all',
    symptoms: [],
    startDate: null,
    endDate: null
  });
  const [sortOrder, setSortOrder] = useState('newest'); // 'newest', 'oldest'

  // 載入寵物資料和異常貼文
  useEffect(() => {
    loadData();
  }, [petId]);

  // 載入症狀列表
  useEffect(() => {
    loadSymptoms();
  }, [translateSymptomList, t]);

  // 根據篩選條件更新顯示的貼文
  useEffect(() => {
    if (Array.isArray(abnormalPosts)) {
      let filtered = [...abnormalPosts];

      // 根據症狀篩選
      if ((filters.type === 'symptom' || filters.type === 'both') && filters.symptoms && filters.symptoms.length > 0) {
        filtered = filtered.filter(post => {
          if (!post.symptoms || !Array.isArray(post.symptoms)) return false;
          // 檢查貼文是否包含任一選中的症狀
          // filters.symptoms 已經是反向翻譯後的中文症狀，可以直接比對
          return filters.symptoms.some(filterSymptom =>
            post.symptoms.includes(filterSymptom.text)
          );
        });
      }

      // 根據日期範圍篩選
      if ((filters.type === 'date' || filters.type === 'both')) {
        if (filters.startDate) {
          filtered = filtered.filter(post => {
            const postDate = new Date(post.record_date);
            return postDate >= filters.startDate;
          });
        }
        if (filters.endDate) {
          filtered = filtered.filter(post => {
            const postDate = new Date(post.record_date);
            return postDate <= filters.endDate;
          });
        }
      }

      // 根據選擇的排序方式排序
      if (sortOrder === 'newest') {
        filtered.sort((a, b) => new Date(b.record_date) - new Date(a.record_date));
      } else {
        filtered.sort((a, b) => new Date(a.record_date) - new Date(b.record_date));
      }
      
      setFilteredPosts(filtered);
    } else {
      setFilteredPosts([]);
    }
  }, [filters, abnormalPosts, sortOrder]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // 載入寵物資料
      const pets = await getUserPets();
      const currentPet = pets.find(p => p.pet_id === parseInt(petId));
      if (currentPet) {
        setPet(currentPet);
      }

      // 載入異常貼文預覽
      const response = await getPetAbnormalPostsPreview(petId);
      
      // 確保posts是陣列
      const posts = Array.isArray(response) ? response : [];
      setAbnormalPosts(posts);
      
    } catch (error) {
      console.error('載入資料失敗:', error);
      setAbnormalPosts([]);
      setFilteredPosts([]);
    } finally {
      setLoading(false);
    }
  };

  // 載入症狀列表
  const loadSymptoms = async () => {
    try {
      const symptoms = await getSymptoms();
      const formattedSymptoms = symptoms.map(symptom =>
        typeof symptom === 'string' ? symptom : symptom.symptom_name
      ).filter(name => typeof name === 'string');

      // 翻譯症狀名稱為當前界面語言
      const translatedSymptoms = translateSymptomList(formattedSymptoms);
      // 根據當前語言進行排序
      setAllSymptoms(translatedSymptoms.sort((a, b) => a.localeCompare(b)));
    } catch (error) {
      console.error('載入症狀列表失敗:', error);
      setAllSymptoms(t('createAbnormalPost.defaultSymptoms', { returnObjects: true }));
    }
  };

  const handleFilterChange = useCallback((newFilters) => {
    setFilters(newFilters);
  }, []);

  const handlePostClick = (post) => {
    // 導航到異常貼文詳情頁面
    navigate(`/pet/${petId}/abnormal-post/${post.id}`);
  };


  const formatDate = (dateString) => {
    const date = new Date(dateString);

    if (i18n.language === 'en') {
      // English format: "Jan 15", "Feb 3", etc.
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } else {
      // Chinese format: "1月15日", "2月3日", etc.
      return date.toLocaleDateString('zh-TW', { month: 'short', day: 'numeric' });
    }
  };

  const formatSymptoms = (symptoms) => {
    if (!symptoms || symptoms.length === 0) return '';
    // 使用症狀翻譯工具來格式化症狀顯示
    return formatSymptomsForDisplay(symptoms) || '';
  };

  const getEmergencyTag = (isEmergency) => {
    return isEmergency ? (
      <span className={styles.emergencyTag}>{t('petAbnormalPosts.emergencyLabel')}</span>
    ) : null;
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
              <span className={styles.title}>{t('petAbnormalPosts.title')}</span>
            </div>
          </div>
          
          <div className={styles.divider}></div>

          {/* 篩選器 */}
          <AbnormalPostFilter 
            onFilterChange={handleFilterChange}
            symptoms={allSymptoms}
          />

          {/* 篩選結果資訊 */}
          <div className={styles.resultInfo}>
            <span className={styles.resultLabel}>{t('petAbnormalPosts.resultLabel')}</span>
            <select 
              value={sortOrder} 
              onChange={(e) => setSortOrder(e.target.value)}
              className={styles.sortSelect}
            >
              <option value="newest">{t('petAbnormalPosts.sortOptions.newest')}</option>
              <option value="oldest">{t('petAbnormalPosts.sortOptions.oldest')}</option>
            </select>
          </div>
          
          <div className={styles.divider}></div>

          {/* 異常貼文列表 */}
          <div className={styles.postList}>
            {!loading && filteredPosts.length === 0 ? (
              <div className={styles.emptyState}>
                <img 
                  src="/assets/icon/SearchNoResult.png" 
                  alt={t('petAbnormalPosts.emptyStateAlt')} 
                  className={styles.emptyIcon}
                />
                <p>{abnormalPosts.length === 0 ? t('petAbnormalPosts.noRecords') : t('petAbnormalPosts.noFilteredRecords')}</p>
              </div>
            ) : (
              filteredPosts.map(post => (
                <div 
                  key={post.id} 
                  className={styles.postPreviewItem}
                  onClick={() => handlePostClick(post)}
                >
                  <div className={styles.previewIcon}>
                    <img 
                      src="/assets/icon/PetpagePetAbnormalPostButton.png" 
                      alt={t('petAbnormalPosts.abnormalRecordAlt')}
                    />
                  </div>
                  
                  <div className={styles.previewContent}>
                    <div className={styles.previewDateRow}>
                      <span className={styles.previewDate}>{formatDate(post.record_date)}</span>
                      {post.is_emergency && (
                        <span className={styles.emergencyLabel}>{t('petAbnormalPosts.emergencyLabel')}</span>
                      )}
                    </div>
                    <div className={styles.previewInfo}>
                      <span className={styles.previewLabel}>{t('petAbnormalPosts.symptomsLabel')}：</span>
                      <span className={styles.previewSymptoms}>{formatSymptoms(post.symptoms)}</span>
                    </div>
                  </div>
                  
                  <div className={styles.previewArrow}>
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

export default PetAbnormalPostsPage;