import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import TopNavbar from '../components/TopNavbar';
import BottomNavbar from '../components/BottomNavigationbar';
import PostList from '../components/PostList';
import Notification from '../components/Notification';
import { getUserLikedPosts } from '../services/socialService';
import styles from '../styles/InteractionPostsListPage.module.css';

const LikedPostsListPage = () => {
  const { t } = useTranslation('social');
  const location = useLocation();
  const navigate = useNavigate();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notification, setNotification] = useState('');
  const [targetPostIndex, setTargetPostIndex] = useState(0);

  // Get liked posts list and target post ID from state
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
        // If liked posts list is passed in, use it directly
        postsData = likedPosts;
      } else {
        // Otherwise fetch liked posts again
        const response = await getUserLikedPosts({ sort: 'post_date_desc' });
        if (response.success) {
          postsData = response.data.posts || response.data || [];
        } else {
          throw new Error(response.error || t('likedPosts.messages.fetchFailed'));
        }
      }

      setPosts(postsData);

      // Find target post index
      if (targetPostId && postsData.length > 0) {
        const index = postsData.findIndex(post =>
          (post.id || post.post_id) === targetPostId
        );
        if (index !== -1) {
          setTargetPostIndex(index);
        }
      }

    } catch (err) {
      console.error(t('likedPosts.console.loadError'), err);
      setError(err.message || t('likedPosts.messages.loadErrorRetry'));
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
    console.log(t('likedPosts.console.likeNotification'), { postId, newIsLiked });
    // Post component has already handled all logic
    // If user unlikes, remove this post from liked list and notify user
    if (!newIsLiked) {
      setPosts(prevPosts => prevPosts.filter(post => post.id !== postId));
      showNotification(t('likedPosts.messages.removedFromList'));
    }
  };

  const handleComment = (postId) => {
    showNotification(t('likedPosts.messages.commentInDevelopment'));
  };

  const handleSave = (postId, newIsSaved) => {
    console.log(t('likedPosts.console.saveNotification'), { postId, newIsSaved });
    // Post component has already handled all logic, save operation doesn't show notification
  };

  return (
    <div className={styles.container}>
      <TopNavbar />
      
      <div className={styles.content}>
        {/* Header row */}
        <div className={styles.header}>
          <button
            className={styles.backButton}
            onClick={handleBackClick}
          >
            ❯
          </button>
          <h1 className={styles.title}>{t('likedPosts.title')}</h1>
        </div>

        {/* Divider */}
        <div className={styles.divider}></div>

        {/* Posts list */}
        <div className={styles.postsContainer}>
          <PostList
            posts={posts}
            loading={loading}
            error={error}
            emptyMessage={t('likedPosts.emptyMessage')}
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