import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import TopNavbar from '../components/TopNavbar';
import BottomNavbar from '../components/BottomNavigationbar';
import PostList from '../components/PostList';
import Notification from '../components/Notification';
import { NotificationProvider } from '../context/NotificationContext';
import styles from '../styles/PostList.module.css';

const SearchPostsPage = () => {
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

  // 處理按讚
  const handleLike = async (postId, isLiked) => {
    try {
      // 更新本地狀態
      setPosts(prevPosts => 
        prevPosts.map(post => 
          post.id === postId 
            ? { 
                ...post, 
                is_liked: isLiked,
                like_count: isLiked ? (post.like_count || 0) + 1 : Math.max(0, (post.like_count || 0) - 1)
              }
            : post
        )
      );

      // TODO: 調用後端 API 進行按讚操作
      // await socialService.likePost(postId, isLiked);
      
    } catch (error) {
      console.error('按讚失敗:', error);
      showNotification('按讚失敗，請稍後再試');
    }
  };

  // 處理留言
  const handleComment = (postId) => {
    console.log('留言操作:', { postId });
    // 可以導航到貼文詳情頁面或顯示留言彈窗
    // navigate(`/post/${postId}`);
  };

  // 處理收藏
  const handleSave = async (postId, isSaved) => {
    try {
      // 更新本地狀態
      setPosts(prevPosts => 
        prevPosts.map(post => 
          post.id === postId 
            ? { ...post, is_saved: isSaved }
            : post
        )
      );

      // TODO: 調用後端 API 進行收藏操作
      // await socialService.savePost(postId, isSaved);
      showNotification(isSaved ? '已收藏' : '已取消收藏');
      
    } catch (error) {
      console.error('收藏失敗:', error);
      showNotification('操作失敗，請稍後再試');
    }
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
            emptyMessage="搜尋結果為空"
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