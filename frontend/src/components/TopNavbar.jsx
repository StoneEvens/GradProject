import React, { useState } from 'react';
import styles from '../styles/TopNavbar.module.css';
import { useNavigate } from 'react-router-dom';
import Notification from './Notification';
import { NotificationProvider } from '../context/NotificationContext';

const TopNavbar = () => {
  const navigate = useNavigate();
  const [notification, setNotification] = useState('');

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
            src="/assets/icon/HeaderButton_UserProfile.png" 
            alt="用戶資料"
            className={styles.icon}
            onClick={() => navigate('/token-test')}
          />
        </div>
      </nav>
    </NotificationProvider>
  );
};

export default TopNavbar; 