import React, { useState, useEffect } from 'react';
import styles from '../styles/TopNavbar.module.css';
import { useNavigate, useLocation } from 'react-router-dom';
import Notification from './Notification';
import { NotificationProvider } from '../context/NotificationContext';
import { getUserProfile } from '../services/userService';

const TopNavbar = ({ onSearchSubmit, onSearchChange, initialSearchValue }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [notification, setNotification] = useState('');
  const [userHeadshot, setUserHeadshot] = useState('/assets/icon/DefaultAvatar.jpg');
  const [searchQuery, setSearchQuery] = useState('');

  // 當初始搜尋值改變時更新搜尋框
  useEffect(() => {
    if (initialSearchValue !== undefined) {
      setSearchQuery(initialSearchValue);
    }
  }, [initialSearchValue]);

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

  const handleNotification = () => {
    navigate('/notifications');
  };

  const hideNotification = () => {
    setNotification('');
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (onSearchSubmit) {
      onSearchSubmit(searchQuery);
    }
  };

  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchQuery(value);
    if (onSearchChange) {
      onSearchChange(value);
    }
  };

  // 判斷是否在社群頁面或社群搜尋頁面
  const isSocialPage = location.pathname === '/social' || location.pathname.startsWith('/social/search');

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
          {isSocialPage ? (
            // 在社群頁面顯示搜尋框
            <form onSubmit={handleSearchSubmit} className={styles.searchForm}>
              <input
                type="text"
                placeholder="搜尋..."
                value={searchQuery}
                onChange={handleSearchChange}
                className={styles.searchInput}
              />
              <button type="submit" className={styles.searchButton}>
                <img 
                  src="/assets/icon/Community_Search.png" 
                  alt="搜尋"
                  className={styles.searchIcon}
                />
              </button>
            </form>
          ) : (
            // 在其他頁面顯示通知按鈕
            <img 
              src="/assets/icon/HeaderButton_Notification.png" 
              alt="通知"
              className={styles.icon}
              onClick={handleNotification}
            />
          )}
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