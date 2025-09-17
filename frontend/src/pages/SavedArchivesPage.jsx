import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import TopNavbar from '../components/TopNavbar';
import BottomNavbar from '../components/BottomNavigationbar';
import ArchiveList from '../components/ArchiveList';
import Notification from '../components/Notification';
import { getUserSavedArchives } from '../services/socialService';
import styles from '../styles/InteractionPostsPage.module.css';

const SavedArchivesPage = () => {
  const { t } = useTranslation('social');
  const navigate = useNavigate();
  const [savedArchives, setSavedArchives] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notification, setNotification] = useState('');
  const [sortOption, setSortOption] = useState('archive_date_desc'); // Default sort: archive creation date desc

  // Sort options
  const sortOptions = [
    { value: 'archive_date_desc', label: t('savedArchives.sortOptions.archiveDateDesc') },
    { value: 'archive_date_asc', label: t('savedArchives.sortOptions.archiveDateAsc') },
    { value: 'save_date_desc', label: t('savedArchives.sortOptions.saveDateDesc') },
    { value: 'save_date_asc', label: t('savedArchives.sortOptions.saveDateAsc') }
  ];

  useEffect(() => {
    loadSavedArchives();
  }, [sortOption]);

  const loadSavedArchives = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Call real API
      const response = await getUserSavedArchives({ sort: sortOption });

      if (response.success) {
        // Process API response data
        const archives = response.data.archives || response.data || [];
        setSavedArchives(archives);
      } else {
        throw new Error(response.error || t('savedArchives.messages.loadFailed'));
      }

    } catch (err) {
      console.error(t('savedArchives.console.loadError'), err);
      setError(err.message || t('savedArchives.messages.loadErrorRetry'));
      setSavedArchives([]); // Clear data
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

  // Handle save (remove from list when unsaved)
  const handleSave = (archiveId, isSaved) => {
    if (!isSaved) {
      // If unsaved, remove from list
      setSavedArchives(prevArchives =>
        prevArchives.filter(archive => archive.id !== archiveId)
      );
    }
  };

  // Handle comment
  const handleComment = (archiveId, increment = 0) => {
    if (increment !== 0) {
      // Update comment count
      setSavedArchives(prevArchives => 
        prevArchives.map(archive => {
          if (archive.id === archiveId) {
            const oldCount = archive.interaction_stats?.comments || 0;
            const newCount = oldCount + increment;
            return {
              ...archive,
              interaction_stats: {
                ...archive.interaction_stats,
                comments: newCount
              }
            };
          }
          return archive;
        })
      );
    }
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
            <h1 className={styles.title}>{t('savedArchives.title')}</h1>
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

        {/* Archive preview list */}
        <div className={styles.postsContainer}>
          <ArchiveList
            archives={savedArchives}
            loading={loading}
            error={error}
            emptyMessage={t('savedArchives.emptyMessage')}
            onSave={handleSave}
            onComment={handleComment}
            className={styles.archiveList}
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

export default SavedArchivesPage;