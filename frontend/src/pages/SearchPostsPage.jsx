import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import TopNavbar from '../components/TopNavbar';
import BottomNavbar from '../components/BottomNavigationbar';
import PostList from '../components/PostList';
import Notification from '../components/Notification';
import { NotificationProvider } from '../context/NotificationContext';
import styles from '../styles/PostList.module.css';

const SearchPostsPage = () => {
  const { t } = useTranslation('posts');
  const location = useLocation();
  const navigate = useNavigate();
  
  const [notification, setNotification] = useState('');
  const [posts, setPosts] = useState([]);
  const [targetPostId, setTargetPostId] = useState(null);

  // 從 location.state 獲取搜尋結果和目標貼文ID
  useEffect(() => {
    if (location.state?.searchPosts) {
      // 處理貼文資料格式，確保內容正確顯示
      const formattedPosts = location.state.searchPosts.map(post => ({
          ...post,
          id: post.post_id || post.id,
          // 確保 content 物件存在並包含 content_text
          content: {
            content_text: post.content?.content_text || post.content_text || post.description || post.caption || post.text || '',
            location: post.content?.location || post.location || ''
          },
          // 保留原始的 description 欄位作為備用
          description: post.content?.content_text || post.content_text || post.description || post.caption || post.text || '',
          // 確保 annotations 資料存在
          annotations: post.annotations || []
      }));
      
      setPosts(formattedPosts);
      setTargetPostId(location.state.targetPostId);
    } else {
      // 如果沒有搜尋結果，返回上一頁
      navigate(-1);
    }
  }, [location.state, navigate]);

  // 顯示通知
  const showNotification = (message) => {
    setNotification(message);
  };

  // 隱藏通知
  const hideNotification = () => {
    setNotification('');
  };

  // 處理按讚 - 可選的通知回調
  const handleLike = (postId, isLiked) => {
    console.log('SearchPostsPage 收到按讚通知:', { postId, isLiked });
    // Post 組件已經處理了所有邏輯，這裡可以做額外的處理
    // 例如：顯示通知、統計等
  };

  // 處理留言
  const handleComment = (postId) => {
    console.log('留言操作:', { postId });
    // 可以導航到貼文詳情頁面或顯示留言彈窗
    // navigate(`/post/${postId}`);
  };

  // 處理收藏 - 可選的通知回調
  const handleSave = (postId, isSaved) => {
    console.log('SearchPostsPage 收到收藏通知:', { postId, isSaved });
    // Post 組件已經處理了所有邏輯，收藏操作不顯示通知
  };

  // 處理用戶點擊
  const handleUserClick = (userInfo) => {
    // 判斷是否為當前用戶
    if (userInfo.user_account) {
      navigate(`/user/${userInfo.user_account}`);
    }
  };

  // 處理hashtag點擊
  const handleHashtagClick = (tagText) => {
    // 導航到社交頁面並執行標籤搜尋
    navigate(`/social?q=${encodeURIComponent('#' + tagText)}`);
  };

  return (
    <NotificationProvider>
      <div className={styles.container}>
        <TopNavbar />
        {notification && (
          <Notification message={notification} onClose={hideNotification} />
        )}
        
        <main className={styles.content}>
          <PostList
            posts={posts}
            loading={false}
            error={null}
            hasMore={false}
            onLike={handleLike}
            onComment={handleComment}
            onSave={handleSave}
            onUserClick={handleUserClick}
            onHashtagClick={handleHashtagClick}
            emptyMessage={t('searchPostsPage.emptyMessage')}
            targetPostId={targetPostId}
            style={{ marginTop: '100px' }}
          />
        </main>
        
        <BottomNavbar />
      </div>
    </NotificationProvider>
  );
};

export default SearchPostsPage;