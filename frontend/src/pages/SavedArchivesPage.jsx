import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import TopNavbar from '../components/TopNavbar';
import BottomNavbar from '../components/BottomNavigationbar';
import ArchiveList from '../components/ArchiveList';
import Notification from '../components/Notification';
import { getUserSavedArchives } from '../services/socialService';
import styles from '../styles/InteractionPostsPage.module.css';

const SavedArchivesPage = () => {
  const navigate = useNavigate();
  const [savedArchives, setSavedArchives] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notification, setNotification] = useState('');
  const [sortOption, setSortOption] = useState('archive_date_desc'); // 預設按檔案建立日期排序：近到遠

  // 排序選項
  const sortOptions = [
    { value: 'archive_date_desc', label: '按建立日期：近到遠' },
    { value: 'archive_date_asc', label: '按建立日期：遠到近' },
    { value: 'save_date_desc', label: '按收藏日期：近到遠' },
    { value: 'save_date_asc', label: '按收藏日期：遠到近' }
  ];

  useEffect(() => {
    loadSavedArchives();
  }, [sortOption]);

  const loadSavedArchives = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // 調用真實的 API
      const response = await getUserSavedArchives({ sort: sortOption });
      
      if (response.success) {
        // 處理 API 回應數據
        const archives = response.data.archives || response.data || [];
        setSavedArchives(archives);
      } else {
        throw new Error(response.error || '獲取收藏的論壇文章失敗');
      }
      
    } catch (err) {
      console.error('載入收藏的論壇文章失敗:', err);
      setError(err.message || '載入收藏的論壇文章失敗，請稍後再試');
      setSavedArchives([]); // 清空數據
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

  // 處理收藏（取消收藏時需要從列表中移除）
  const handleSave = (archiveId, isSaved) => {
    if (!isSaved) {
      // 如果取消收藏，從列表中移除該檔案
      setSavedArchives(prevArchives => 
        prevArchives.filter(archive => archive.id !== archiveId)
      );
    }
  };

  // 處理留言
  const handleComment = (archiveId, increment = 0) => {
    if (increment !== 0) {
      // 更新留言數
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
        {/* 標題列 */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <button 
              className={styles.backButton}
              onClick={handleBackClick}
            >
              ❯
            </button>
            <h1 className={styles.title}>收藏的論壇文章</h1>
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

        {/* 檔案預覽列表 */}
        <div className={styles.postsContainer}>
          <ArchiveList
            archives={savedArchives}
            loading={loading}
            error={error}
            emptyMessage="尚未收藏任何論壇文章"
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