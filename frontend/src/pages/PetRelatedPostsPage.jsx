import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import TopNavbar from '../components/TopNavbar';
import BottomNavbar from '../components/BottomNavigationbar';
import PostPreviewList from '../components/PostPreviewList';
import Notification from '../components/Notification';
import { getPetRelatedPosts } from '../services/socialService';
import { getUserPets } from '../services/petService';
import styles from '../styles/PetRelatedPostsPage.module.css';

const PetRelatedPostsPage = () => {
  const { t } = useTranslation('posts');
  const navigate = useNavigate();
  const { petId } = useParams();
  const [relatedPosts, setRelatedPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notification, setNotification] = useState('');
  const [sortOption, setSortOption] = useState('post_date_desc');
  const [petName, setPetName] = useState(t('petRelatedPosts.defaultPetName'));
  const [petAvatar, setPetAvatar] = useState('/assets/icon/DefaultAvatar.jpg'); // 預設寵物頭像

  const sortOptions = [
    { value: 'post_date_desc', label: t('petRelatedPosts.sortOptions.dateDescending') },
    { value: 'post_date_asc', label: t('petRelatedPosts.sortOptions.dateAscending') }
  ];

  useEffect(() => {
    loadRelatedPosts();
  }, [petId, sortOption]);

  const loadRelatedPosts = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // 先載入寵物資料以獲取正確的頭像和名稱
      try {
        const pets = await getUserPets();
        const currentPet = pets.find(pet => pet.pet_id === parseInt(petId));
        if (currentPet) {
          setPetName(currentPet.pet_name);
          setPetAvatar(currentPet.headshot_url || '/assets/icon/DefaultAvatar.jpg');
        }
      } catch (petErr) {
        console.warn('載入寵物資料失敗:', petErr);
      }
      
      const response = await getPetRelatedPosts(petId, { sort: sortOption });
      
      if (response.success) {
        const posts = response.data.posts || response.data || [];
        setRelatedPosts(posts);
      } else {
        throw new Error(response.error || t('petRelatedPosts.messages.loadPostsFailed'));
      }
      
    } catch (err) {
      console.error('載入相關貼文失敗:', err);
      setError(err.message || t('petRelatedPosts.messages.loadPostsError'));
      setRelatedPosts([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSortChange = (event) => {
    setSortOption(event.target.value);
  };

  const showNotification = (message) => {
    setNotification(message);
  };

  const hideNotification = () => {
    setNotification('');
  };

  return (
    <div className={styles.container}>
      <TopNavbar />
      
      <div className={styles.content}>
        {/* 標題列 */}
        <div className={styles.header}>
          <div className={styles.titleSection}>
            <img 
              src={petAvatar} 
              alt={petName} 
              className={styles.petAvatar}
              onError={(e) => {
                e.target.src = '/assets/icon/DefaultAvatar.jpg';
              }}
            />
            <h1 className={styles.title}>{t('petRelatedPosts.title')}</h1>
          </div>
          
          {/* 排序下拉選單 */}
          <select 
            className={styles.sortSelect}
            value={sortOption}
            onChange={handleSortChange}
          >
            {sortOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* 分隔線 */}
        <div className={styles.divider}></div>

        {/* 貼文預覽列表 */}
        <div className={styles.postsContainer}>
          <PostPreviewList
            posts={relatedPosts}
            loading={loading}
            error={error}
            emptyMessage={t('petRelatedPosts.messages.noRelatedPosts', { petName })}
            isSearchResult={false}
            isPetRelatedPosts={true}
            petId={petId}
          />
        </div>
      </div>

      <BottomNavbar />
      
      {notification && (
        <Notification 
          message={notification} 
          onClose={hideNotification} 
        />
      )}
    </div>
  );
};

export default PetRelatedPostsPage;