import React, { useState, useEffect } from 'react';
import styles from '../styles/TopNavbar.module.css';
import { useNavigate } from 'react-router-dom';
import Notification from './Notification';
import { NotificationProvider } from '../context/NotificationContext';
import { getUserProfile } from '../services/userService';

const TopNavbar = () => {
  const navigate = useNavigate();
  const [notification, setNotification] = useState('');
  const [userHeadshot, setUserHeadshot] = useState('/assets/icon/DefaultAvatar.jpg');

  // 獲取用戶頭像
  useEffect(() => {
    const fetchUserHeadshot = async () => {
      try {
        const userData = await getUserProfile();
        if (userData.headshot_url) {
          setUserHeadshot(userData.headshot_url);
        }
      } catch (error) {
        console.error('獲取用戶頭像失敗:', error);
        // 如果 API 失敗，保持預設頭像
      }
    };

    // 只在用戶已登入時獲取頭像
    const token = localStorage.getItem('accessToken');
    if (token) {
      fetchUserHeadshot();
    }

    // 監聽認證狀態變化
    const handleAuthChange = () => {
      const newToken = localStorage.getItem('accessToken');
      if (newToken) {
        fetchUserHeadshot();
      } else {
        setUserHeadshot('/assets/icon/DefaultAvatar.jpg');
      }
    };

    window.addEventListener('auth-change', handleAuthChange);
    return () => window.removeEventListener('auth-change', handleAuthChange);
  }, []);

  const handleLogout = () => {
    // 清除所有認證信息
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('userData');
    
    // 觸發認證狀態更新
    window.dispatchEvent(new Event('auth-change'));
    
    // 顯示登出通知
    setNotification('登出成功！');
    
    // 延遲導航到首頁
    setTimeout(() => {
      navigate('/');
    }, 1500);
  };

  const hideNotification = () => {
    setNotification('');
  };

  return (
    <NotificationProvider>
      {notification && (
        <Notification
          message={notification}
          onClose={hideNotification}
        />
      )}
      <nav className={styles.navbar}>
        <div className={styles.leftSection}>
          <img 
            src="/assets/icon/HeaderButton_HomePage.png" 
            alt="首頁"
            className={styles.icon}
            onClick={() => navigate('/main')}
          />
        </div>
        <div className={styles.rightSection}>
          <img 
            src="/assets/icon/HeaderButton_Notification.png" 
            alt="通知"
            className={styles.icon}
            onClick={handleLogout}
          />
          <img 
            src={userHeadshot} 
            alt="用戶頭像"
            className={styles.userHeadshot}
            onClick={() => navigate('/user-profile')}
          />
        </div>
      </nav>
    </NotificationProvider>
  );
};

export default TopNavbar; 