import React, { useState, useEffect } from 'react';
import styles from '../styles/TopNavbar.module.css';
import { useNavigate, useLocation } from 'react-router-dom';
import Notification from './Notification';
import { NotificationProvider } from '../context/NotificationContext';
import { useUser } from '../context/UserContext';

const TopNavbar = ({ onSearchSubmit, onSearchChange, initialSearchValue }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [notification, setNotification] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const { userHeadshot, imageLoading } = useUser();

  // 當初始搜尋值改變時更新搜尋框
  useEffect(() => {
    if (initialSearchValue !== undefined) {
      setSearchQuery(initialSearchValue);
    }
  }, [initialSearchValue]);


  const handleNotification = () => {
    navigate('/notifications');
  };

  const hideNotification = () => {
    setNotification('');
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (isFeedPage && searchQuery.trim()) {
      // 在飼料頁面進行搜尋時，導航到搜尋結果頁面
      navigate(`/feeds/search?q=${encodeURIComponent(searchQuery.trim())}`);
    } else if (onSearchSubmit) {
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
  
  // 判斷是否在飼料頁面或飼料相關搜尋頁面
  const isFeedPage = location.pathname === '/feeds' || 
                     location.pathname === '/feeds/all' || 
                     location.pathname === '/feeds/my-marked' || 
                     location.pathname.startsWith('/feeds/search');
  
  // 判斷是否需要顯示搜尋框
  const showSearchBar = isSocialPage || isFeedPage;

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
          {showSearchBar ? (
            // 在社群頁面或飼料頁面顯示搜尋框
            <form onSubmit={handleSearchSubmit} className={styles.searchForm}>
              <input
                type="text"
                placeholder={isFeedPage ? "搜尋飼料名稱或品牌..." : "搜尋..."}
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
            className={`${styles.userHeadshot} ${imageLoading ? styles.loading : ''}`}
            onClick={() => navigate('/user-profile')}
          />
        </div>
      </nav>
    </NotificationProvider>
  );
};

export default TopNavbar; 