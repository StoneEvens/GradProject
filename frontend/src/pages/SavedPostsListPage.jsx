import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import TopNavbar from '../components/TopNavbar';
import BottomNavbar from '../components/BottomNavigationbar';
import PostList from '../components/PostList';
import Notification from '../components/Notification';
import { getUserSavedPosts } from '../services/socialService';
import styles from '../styles/InteractionPostsListPage.module.css';

const SavedPostsListPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notification, setNotification] = useState('');
  const [targetPostIndex, setTargetPostIndex] = useState(0);

  // 從 state 獲取收藏貼文列表和目標貼文ID
  const { savedPosts = [], targetPostId } = location.state || {};

  useEffect(() => {
    loadSavedPostsList();
  }, []);

  const loadSavedPostsList = async () => {
    try {
      setLoading(true);
      setError(null);

      let postsData = [];

      if (savedPosts && savedPosts.length > 0) {
        // 如果有傳入的收藏貼文列表，直接使用
        postsData = savedPosts;
      } else {
        // 否則重新獲取收藏貼文
        const response = await getUserSavedPosts({ sort: 'post_date_desc' });
        if (response.success) {
          postsData = response.data.posts || response.data || [];
        } else {
          throw new Error(response.error || '獲取收藏貼文失敗');
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
      console.error('載入收藏貼文列表失敗:', err);
      setError(err.message || '載入收藏貼文列表失敗，請稍後再試');
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

  const handleLike = async (postId, newIsLiked) => {
    // 按讚後更新本地狀態
    setPosts(prevPosts => 
      prevPosts.map(post => 
        post.id === postId 
          ? { 
              ...post, 
              user_interaction: { 
                ...post.user_interaction, 
                is_liked: newIsLiked 
              },
              interaction_stats: {
                ...post.interaction_stats,
                likes: newIsLiked 
                  ? (post.interaction_stats?.likes || 0) + 1 
                  : Math.max(0, (post.interaction_stats?.likes || 0) - 1)
              }
            }
          : post
      )
    );
  };

  const handleComment = (postId) => {
    showNotification('評論功能開發中');
  };

  const handleSave = async (postId, newIsSaved) => {
    // 收藏後更新本地狀態
    setPosts(prevPosts => 
      prevPosts.map(post => 
        post.id === postId 
          ? { 
              ...post, 
              user_interaction: { 
                ...post.user_interaction, 
                is_saved: newIsSaved 
              },
              interaction_stats: {
                ...post.interaction_stats,
                saves: newIsSaved 
                  ? (post.interaction_stats?.saves || 0) + 1 
                  : Math.max(0, (post.interaction_stats?.saves || 0) - 1)
              }
            }
          : post
      )
    );
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
          <h1 className={styles.title}>收藏的貼文</h1>
        </div>

        {/* 分隔線 */}
        <div className={styles.divider}></div>

        {/* 貼文列表 */}
        <div className={styles.postsContainer}>
          <PostList
            posts={posts}
            loading={loading}
            error={error}
            emptyMessage="尚未收藏任何貼文"
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

export default SavedPostsListPage;