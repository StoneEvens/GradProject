import React, { useRef, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from '../styles/ArticleRecommendations.module.css';
import { getRecommendedDiseaseArchives } from '../services/petService';
import { getUserProfile } from '../services/userService';
import ArchivePreviewForPublic from './ArchivePreviewForPublic';
import Notification from './Notification';

const ArticleRecommendations = () => {
  // 文章列表的引用
  const articleListRef = useRef(null);
  
  const navigate = useNavigate();
  
  // 推薦疾病檔案數據
  const [recommendedArchives, setRecommendedArchives] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [notification, setNotification] = useState({ show: false, message: '' });
  
  // Fetch user profile and recommended disease archives when component mounts
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // 並行獲取用戶資料和推薦檔案
        const [userResult, archiveResult] = await Promise.all([
          getUserProfile().catch(() => null),
          getRecommendedDiseaseArchives({
            sort: 'popular',  // 獲取熱門疾病檔案
            limit: 5,
            offset: 0
          })
        ]);
        
        // 設置用戶資料
        if (userResult) {
          setCurrentUser(userResult);
        }
        
        // 設置推薦檔案
        if (archiveResult.success && archiveResult.data && archiveResult.data.archives) {
          console.log('Retrieved disease archives:', archiveResult.data.archives);
          setRecommendedArchives(archiveResult.data.archives);
        } else {
          console.log('No disease archives found or API error:', archiveResult.error);
          setRecommendedArchives([]);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        setRecommendedArchives([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);
  
  // 滑動文章列表的函數
  const handleScroll = (direction) => {
    if (articleListRef.current) {
      const scrollAmount = 100; // 每次滑動的距離
      const currentScroll = articleListRef.current.scrollTop;
      
      if (direction === 'up') {
        articleListRef.current.scrollTo({
          top: Math.max(0, currentScroll - scrollAmount),
          behavior: 'smooth'
        });
      } else {
        articleListRef.current.scrollTo({
          top: currentScroll + scrollAmount,
          behavior: 'smooth'
        });
      }
    }
  };

  // 顯示通知
  const showNotification = (message) => {
    setNotification({ show: true, message });
    setTimeout(() => {
      setNotification({ show: false, message: '' });
    }, 3000);
  };

  // 處理檔案刪除（從推薦列表中移除）
  const handleArchiveDelete = (archiveId) => {
    setRecommendedArchives(prev => prev.filter(archive => archive.id !== archiveId));
  };

  // 加入滑鼠滾輪事件
  useEffect(() => {
    const handleWheel = (e) => {
      if (articleListRef.current && articleListRef.current.contains(e.target)) {
        e.preventDefault();
        const direction = e.deltaY > 0 ? 'down' : 'up';
        handleScroll(direction);
      }
    };

    const listElement = articleListRef.current;
    if (listElement) {
      listElement.addEventListener('wheel', handleWheel, { passive: false });
    }

    return () => {
      if (listElement) {
        listElement.removeEventListener('wheel', handleWheel);
      }
    };
  }, []);

  return (
    <div className={styles.container}>
      <div className={styles.header}>熱門論壇文章推薦</div>
      
      {loading ? (
        <div className={styles.loadingContainer}>
          <div className={styles.loadingText}>載入中...</div>
        </div>
      ) : (
        <div className={styles.articleList} ref={articleListRef}>
          {recommendedArchives.length === 0 ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyText}>暫無推薦內容</div>
            </div>
          ) : (
            recommendedArchives.map((archive) => (
              <div key={archive.id} className={styles.archiveItemWrapper}>
                <ArchivePreviewForPublic
                  archiveData={archive}
                  user={archive.user_info}
                  currentUser={currentUser}
                  onShowNotification={showNotification}
                  onDelete={handleArchiveDelete}
                />
              </div>
            ))
          )}
        </div>
      )}
      
      {/* 通知 */}
      {notification.show && (
        <Notification message={notification.message} />
      )}
    </div>
  );
};

export default ArticleRecommendations; 