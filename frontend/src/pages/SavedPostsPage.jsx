import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import TopNavbar from '../components/TopNavbar';
import BottomNavbar from '../components/BottomNavigationbar';
import PostPreviewList from '../components/PostPreviewList';
import Notification from '../components/Notification';
import { getUserSavedPosts } from '../services/socialService';
import styles from '../styles/InteractionPostsPage.module.css';

const SavedPostsPage = () => {
  const navigate = useNavigate();
  const [savedPosts, setSavedPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notification, setNotification] = useState('');
  const [sortOption, setSortOption] = useState('post_date_desc'); // 預設按發布日期排序：近到遠

  // 排序選項
  const sortOptions = [
    { value: 'post_date_desc', label: '按發布日期：近到遠' },
    { value: 'post_date_asc', label: '按發布日期：遠到近' },
    { value: 'save_date_desc', label: '按收藏日期：近到遠' },
    { value: 'save_date_asc', label: '按收藏日期：遠到近' }
  ];

  useEffect(() => {
    loadSavedPosts();
  }, [sortOption]);

  const loadSavedPosts = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // 調用真實的 API
      const response = await getUserSavedPosts({ sort: sortOption });
      
      if (response.success) {
        // 處理 API 回應數據
        const posts = response.data.posts || response.data || [];
        setSavedPosts(posts);
      } else {
        throw new Error(response.error || '獲取收藏貼文失敗');
      }
      
    } catch (err) {
      console.error('載入收藏貼文失敗:', err);
      setError(err.message || '載入收藏貼文失敗，請稍後再試');
      setSavedPosts([]); // 清空數據
    } finally {
      setLoading(false);
    }
  };


  const handleSortChange = (event) => {
    setSortOption(event.target.value);
  };

  const handleBackClick = () => {
    navigate(-1);
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
          <div className={styles.headerLeft}>
            <button 
              className={styles.backButton}
              onClick={handleBackClick}
            >
              ❯
            </button>
            <h1 className={styles.title}>收藏的貼文</h1>
          </div>
          
          {/* 排序下拉選單 */}
          <div className={styles.headerRight}>
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
        </div>

        {/* 分隔線 */}
        <div className={styles.divider}></div>

        {/* 貼文預覽列表 */}
        <div className={styles.postsContainer}>
          <PostPreviewList
            posts={savedPosts}
            loading={loading}
            error={error}
            emptyMessage="尚未收藏任何貼文"
            isSearchResult={false}
            isSavedPosts={true}
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

export default SavedPostsPage;