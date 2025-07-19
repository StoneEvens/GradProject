import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import TopNavbar from '../components/TopNavbar';
import BottomNavbar from '../components/BottomNavigationbar';
import PostList from '../components/PostList';
import Notification from '../components/Notification';
import { getPetRelatedPosts } from '../services/socialService';
import styles from '../styles/PetRelatedPostsListPage.module.css';

const PetRelatedPostsListPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { petId } = useParams();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notification, setNotification] = useState('');
  const [targetPostIndex, setTargetPostIndex] = useState(0);
  const [petName, setPetName] = useState('寵物'); // 預設寵物名稱

  // 從 state 獲取相關貼文列表和目標貼文ID
  const { relatedPosts = [], targetPostId } = location.state || {};

  useEffect(() => {
    loadRelatedPostsList();
  }, []);

  const loadRelatedPostsList = async () => {
    try {
      setLoading(true);
      setError(null);

      let postsData = [];

      if (relatedPosts && relatedPosts.length > 0) {
        // 如果有傳入的相關貼文列表，直接使用
        postsData = relatedPosts;
      } else {
        // 否則重新獲取相關貼文
        const response = await getPetRelatedPosts(petId, { sort: 'post_date_desc' });
        if (response.success) {
          postsData = response.data.posts || response.data || [];
        } else {
          throw new Error(response.error || '獲取相關貼文失敗');
        }
      }

      setPosts(postsData);

      // 如果有貼文，從第一個貼文中獲取寵物名稱
      if (postsData.length > 0 && postsData[0].tagged_pets && postsData[0].tagged_pets.length > 0) {
        const targetPet = postsData[0].tagged_pets.find(pet => pet.id === parseInt(petId));
        if (targetPet) {
          setPetName(targetPet.pet_name);
        }
      }

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
      console.error('載入相關貼文列表失敗:', err);
      setError(err.message || '載入相關貼文列表失敗，請稍後再試');
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
          <h1 className={styles.title}>{petName}的相關貼文</h1>
        </div>

        {/* 分隔線 */}
        <div className={styles.divider}></div>

        {/* 貼文列表 */}
        <div className={styles.postsContainer}>
          <PostList
            posts={posts}
            loading={loading}
            error={error}
            emptyMessage={`${petName}還沒有相關貼文`}
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

export default PetRelatedPostsListPage;