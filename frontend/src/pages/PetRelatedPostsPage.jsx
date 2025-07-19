import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import TopNavbar from '../components/TopNavbar';
import BottomNavbar from '../components/BottomNavigationbar';
import PostPreviewList from '../components/PostPreviewList';
import Notification from '../components/Notification';
import { getPetRelatedPosts } from '../services/socialService';
import styles from '../styles/PetRelatedPostsPage.module.css';

const PetRelatedPostsPage = () => {
  const navigate = useNavigate();
  const { petId } = useParams();
  const [relatedPosts, setRelatedPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notification, setNotification] = useState('');
  const [sortOption, setSortOption] = useState('post_date_desc'); // 預設按發布日期排序：近到遠
  const [petName, setPetName] = useState('寵物'); // 預設寵物名稱
  const [petAvatar, setPetAvatar] = useState('/assets/icon/DefaultAvatar.jpg'); // 預設寵物頭像

  // 排序選項 - 只有按發布日期排序
  const sortOptions = [
    { value: 'post_date_desc', label: '按發布日期：近到遠' },
    { value: 'post_date_asc', label: '按發布日期：遠到近' }
  ];

  useEffect(() => {
    loadRelatedPosts();
  }, [petId, sortOption]);

  const loadRelatedPosts = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // 調用真實的 API
      const response = await getPetRelatedPosts(petId, { sort: sortOption });
      
      if (response.success) {
        // 處理 API 回應數據
        const posts = response.data.posts || response.data || [];
        setRelatedPosts(posts);
        
        // 如果有貼文，從第一個貼文中獲取寵物名稱和頭像
        if (posts.length > 0 && posts[0].tagged_pets && posts[0].tagged_pets.length > 0) {
          const targetPet = posts[0].tagged_pets.find(pet => pet.id === parseInt(petId));
          if (targetPet) {
            setPetName(targetPet.pet_name);
            setPetAvatar(targetPet.headshot_url || '/assets/icon/DefaultAvatar.jpg');
          }
        }
      } else {
        throw new Error(response.error || '獲取相關貼文失敗');
      }
      
    } catch (err) {
      console.error('載入相關貼文失敗:', err);
      setError(err.message || '載入相關貼文失敗，請稍後再試');
      setRelatedPosts([]); // 清空數據
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
            <h1 className={styles.title}>的相關貼文</h1>
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
            emptyMessage={`${petName}還沒有相關貼文`}
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