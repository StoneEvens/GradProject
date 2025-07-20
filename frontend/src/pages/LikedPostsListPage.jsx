import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import TopNavbar from '../components/TopNavbar';
import BottomNavbar from '../components/BottomNavigationbar';
import PostList from '../components/PostList';
import Notification from '../components/Notification';
import { getUserLikedPosts } from '../services/socialService';
import styles from '../styles/InteractionPostsListPage.module.css';

const LikedPostsListPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notification, setNotification] = useState('');
  const [targetPostIndex, setTargetPostIndex] = useState(0);

  // 從 state 獲取按讚貼文列表和目標貼文ID
  const { likedPosts = [], targetPostId } = location.state || {};

  useEffect(() => {
    loadLikedPostsList();
  }, []);

  const loadLikedPostsList = async () => {
    try {
      setLoading(true);
      setError(null);

      let postsData = [];

      if (likedPosts && likedPosts.length > 0) {
        // 如果有傳入的按讚貼文列表，直接使用
        postsData = likedPosts;
      } else {
        // 否則重新獲取按讚貼文
        const response = await getUserLikedPosts({ sort: 'post_date_desc' });
        if (response.success) {
          postsData = response.data.posts || response.data || [];
        } else {
          throw new Error(response.error || '獲取按讚貼文失敗');
        }
      }

      setPosts(postsData);

      // 找到目標貼文的索引
      if (targetPostId && postsData.length > 0) {
        const index = postsData.findIndex(post => 
          (post.id || post.post_id) === targetPostId
        );
        if (index !== -1) {
          setTargetPostIndex(index);
        }
      }

    } catch (err) {
      console.error('載入按讚貼文列表失敗:', err);
      setError(err.message || '載入按讚貼文列表失敗，請稍後再試');
      setPosts([]);
    } finally {
      setLoading(false);
    }
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

  const handleLike = (postId, newIsLiked) => {
    console.log('LikedPostsListPage 收到按讚通知:', { postId, newIsLiked });
    // Post 組件已經處理了所有邏輯
    // 如果用戶取消按讚，從按讚列表中移除這個貼文並通知用戶
    if (!newIsLiked) {
      setPosts(prevPosts => prevPosts.filter(post => post.id !== postId));
      showNotification('已從按讚列表移除');
    }
  };

  const handleComment = (postId) => {
    showNotification('評論功能開發中');
  };

  const handleSave = (postId, newIsSaved) => {
    console.log('LikedPostsListPage 收到收藏通知:', { postId, newIsSaved });
    // Post 組件已經處理了所有邏輯，收藏操作不顯示通知
  };

  return (
    <div className={styles.container}>
      <TopNavbar />
      
      <div className={styles.content}>
        {/* 標題列 */}
        <div className={styles.header}>
          <button 
            className={styles.backButton}
            onClick={handleBackClick}
          >
            ❯
          </button>
          <h1 className={styles.title}>按讚的貼文</h1>
        </div>

        {/* 分隔線 */}
        <div className={styles.divider}></div>

        {/* 貼文列表 */}
        <div className={styles.postsContainer}>
          <PostList
            posts={posts}
            loading={loading}
            error={error}
            emptyMessage="尚未按讚任何貼文"
            targetPostIndex={targetPostIndex}
            onLike={handleLike}
            onComment={handleComment}
            onSave={handleSave}
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

export default LikedPostsListPage;