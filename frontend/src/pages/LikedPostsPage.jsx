import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import TopNavbar from '../components/TopNavbar';
import BottomNavbar from '../components/BottomNavigationbar';
import PostPreviewList from '../components/PostPreviewList';
import Notification from '../components/Notification';
import { getUserLikedPosts } from '../services/socialService';
import styles from '../styles/InteractionPostsPage.module.css';

const LikedPostsPage = () => {
  const { t } = useTranslation('social');
  const navigate = useNavigate();
  const [likedPosts, setLikedPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notification, setNotification] = useState('');
  const [sortOption, setSortOption] = useState('post_date_desc'); // Default sort: post date desc

  // Sort options
  const sortOptions = [
    { value: 'post_date_desc', label: t('likedPostsPage.sortOptions.postDateDesc') },
    { value: 'post_date_asc', label: t('likedPostsPage.sortOptions.postDateAsc') },
    { value: 'like_date_desc', label: t('likedPostsPage.sortOptions.likeDateDesc') },
    { value: 'like_date_asc', label: t('likedPostsPage.sortOptions.likeDateAsc') }
  ];

  useEffect(() => {
    loadLikedPosts();
  }, [sortOption]);

  const loadLikedPosts = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Call real API
      const response = await getUserLikedPosts({ sort: sortOption });

      if (response.success) {
        // Process API response data
        const posts = response.data.posts || response.data || [];
        setLikedPosts(posts);
      } else {
        throw new Error(response.error || t('likedPostsPage.messages.loadFailed'));
      }

    } catch (err) {
      console.error(t('likedPostsPage.console.loadError'), err);
      setError(err.message || t('likedPostsPage.messages.loadErrorRetry'));
      setLikedPosts([]); // Clear data
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
        {/* Header row */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <button
              className={styles.backButton}
              onClick={handleBackClick}
            >
              ❯
            </button>
            <h1 className={styles.title}>{t('likedPostsPage.title')}</h1>
          </div>

          {/* Sort dropdown */}
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

        {/* Divider */}
        <div className={styles.divider}></div>

        {/* Post preview list */}
        <div className={styles.postsContainer}>
          <PostPreviewList
            posts={likedPosts}
            loading={loading}
            error={error}
            emptyMessage={t('likedPostsPage.emptyMessage')}
            isSearchResult={false}
            isLikedPosts={true}
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

export default LikedPostsPage;