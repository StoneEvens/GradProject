import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import TopNavbar from '../components/TopNavbar';
import BottomNavbar from '../components/BottomNavigationbar';
import ArchiveList from '../components/ArchiveList';
import Notification from '../components/Notification';
import { getUserLikedArchives } from '../services/socialService';
import styles from '../styles/InteractionPostsPage.module.css';

const LikedArchivesPage = () => {
  const navigate = useNavigate();
  const [likedArchives, setLikedArchives] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notification, setNotification] = useState('');
  const [sortOption, setSortOption] = useState('archive_date_desc'); // 預設按檔案建立日期排序：近到遠

  // 排序選項
  const sortOptions = [
    { value: 'archive_date_desc', label: '按建立日期：近到遠' },
    { value: 'archive_date_asc', label: '按建立日期：遠到近' },
    { value: 'like_date_desc', label: '按按讚日期：近到遠' },
    { value: 'like_date_asc', label: '按按讚日期：遠到近' }
  ];

  useEffect(() => {
    loadLikedArchives();
  }, [sortOption]);

  const loadLikedArchives = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // 調用真實的 API
      const response = await getUserLikedArchives({ sort: sortOption });
      
      if (response.success) {
        // 處理 API 回應數據
        const archives = response.data.archives || response.data || [];
        setLikedArchives(archives);
      } else {
        throw new Error(response.error || '獲取按讚的論壇文章失敗');
      }
      
    } catch (err) {
      console.error('載入按讚的論壇文章失敗:', err);
      setError(err.message || '載入按讚的論壇文章失敗，請稍後再試');
      setLikedArchives([]); // 清空數據
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

  // 處理按讚（取消按讚時需要從列表中移除）
  const handleLike = (archiveId, isLiked) => {
    if (!isLiked) {
      // 如果取消按讚，從列表中移除該檔案
      setLikedArchives(prevArchives => 
        prevArchives.filter(archive => archive.id !== archiveId)
      );
    }
  };

  // 處理留言
  const handleComment = (archiveId, increment = 0) => {
    if (increment !== 0) {
      // 更新留言數
      setLikedArchives(prevArchives => 
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
            <h1 className={styles.title}>按讚的論壇文章</h1>
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
            archives={likedArchives}
            loading={loading}
            error={error}
            emptyMessage="尚未按讚任何論壇文章"
            onLike={handleLike}
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

export default LikedArchivesPage;