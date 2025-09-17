import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import TopNavbar from '../components/TopNavbar';
import BottomNavbar from '../components/BottomNavigationbar';
import PostPreviewList from '../components/PostPreviewList';
import Notification from '../components/Notification';
import { getUserSavedPosts } from '../services/socialService';
import styles from '../styles/InteractionPostsPage.module.css';

const SavedPostsPage = () => {
  const { t } = useTranslation('social');
  const navigate = useNavigate();
  const [savedPosts, setSavedPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notification, setNotification] = useState('');
  const [sortOption, setSortOption] = useState('post_date_desc'); // Default sort: post date desc

  // Sort options
  const sortOptions = [
    { value: 'post_date_desc', label: t('savedPostsPage.sortOptions.postDateDesc') },
    { value: 'post_date_asc', label: t('savedPostsPage.sortOptions.postDateAsc') },
    { value: 'save_date_desc', label: t('savedPostsPage.sortOptions.saveDateDesc') },
    { value: 'save_date_asc', label: t('savedPostsPage.sortOptions.saveDateAsc') }
  ];

  useEffect(() => {
    loadSavedPosts();
  }, [sortOption]);

  const loadSavedPosts = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Call real API
      const response = await getUserSavedPosts({ sort: sortOption });

      if (response.success) {
        // Process API response data
        const posts = response.data.posts || response.data || [];
        setSavedPosts(posts);
      } else {
        throw new Error(response.error || t('savedPostsPage.messages.loadFailed'));
      }

    } catch (err) {
      console.error(t('savedPostsPage.console.loadError'), err);
      setError(err.message || t('savedPostsPage.messages.loadErrorRetry'));
      setSavedPosts([]); // Clear data
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
            <h1 className={styles.title}>{t('savedPostsPage.title')}</h1>
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
            posts={savedPosts}
            loading={loading}
            error={error}
            emptyMessage={t('savedPostsPage.emptyMessage')}
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