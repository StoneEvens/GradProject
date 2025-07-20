import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import TopNavbar from '../components/TopNavbar';
import BottomNavbar from '../components/BottomNavigationbar';
import PostList from '../components/PostList';
import Notification from '../components/Notification';
import { getUserProfile, getOtherUserProfile } from '../services/userService';
import { NotificationProvider } from '../context/NotificationContext';
import styles from '../styles/PostList.module.css';

const UserPostsPage = () => {
  const { userAccount } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState('');
  const [isCurrentUser, setIsCurrentUser] = useState(false);
  
  // 從location.state獲取目標貼文ID
  const targetPostId = location.state?.targetPostId;

  useEffect(() => {
    const fetchUserData = async () => {
      setLoading(true);
      try {
        // 獲取當前登入用戶資訊
        const currentUser = await getUserProfile();
        
        let targetUser;
        if (userAccount) {
          // 如果有userAccount參數，獲取該用戶資訊
          targetUser = await getOtherUserProfile(userAccount);
          setIsCurrentUser(currentUser.user_account === userAccount);
        } else {
          // 如果沒有參數，顯示當前用戶的貼文
          targetUser = currentUser;
          setIsCurrentUser(true);
        }
        
        setUser(targetUser);
      } catch (error) {
        console.error('獲取用戶資料失敗:', error);
        setNotification('載入用戶資料失敗，請稍後再試');
        // 3秒後返回上一頁
        setTimeout(() => navigate(-1), 3000);
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, [userAccount, navigate]);


  // 處理用戶點擊
  const handleUserClick = (userInfo) => {
    // 判斷是否為當前用戶
    if (userInfo.user_account === user?.user_account) {
      navigate('/user-profile');
    } else {
      navigate(`/user/${userInfo.user_account}`);
    }
  };

  // 顯示通知
  const showNotification = (message) => {
    setNotification(message);
  };

  // 隱藏通知
  const hideNotification = () => {
    setNotification('');
  };


  if (loading) {
    return (
      <NotificationProvider>
        <div className={styles.container}>
          <TopNavbar />
          <div className={styles.loading}>
            <div className={styles.spinner}></div>
            <p>載入中...</p>
          </div>
          <BottomNavbar />
        </div>
      </NotificationProvider>
    );
  }

  if (!user) {
    return (
      <NotificationProvider>
        <div className={styles.container}>
          <TopNavbar />
          <div className={styles.error}>
            <p>用戶不存在</p>
          </div>
          <BottomNavbar />
        </div>
      </NotificationProvider>
    );
  }

  return (
    <NotificationProvider>
      <div className={styles.container}>
        <TopNavbar />
        {notification && (
          <Notification message={notification} onClose={hideNotification} />
        )}
        
        <main className={styles.content}>
          {/* 貼文列表 */}
          <PostList
            fetchUserPosts={true}
            userId={user.id}
            targetPostId={targetPostId}
            onUserClick={handleUserClick}
            className={styles.postList}
            style={{ marginTop: '100px' }}
          />
        </main>
        
        <BottomNavbar />
      </div>
    </NotificationProvider>
  );
};

export default UserPostsPage; 