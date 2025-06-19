import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import TopNavbar from '../components/TopNavbar';
import BottomNavbar from '../components/BottomNavbar';
import Notification from '../components/Notification';
import AccountSettings from '../components/AccountSettings';
import { logout } from '../services/authService';
import { getUserProfile, updateAccountPrivacy } from '../services/userService';
import styles from '../styles/SettingsPage.module.css';

const SettingsPage = () => {
  const navigate = useNavigate();
  const [notification, setNotification] = useState('');
  const [isPrivacyPublic, setIsPrivacyPublic] = useState(true);
  const [isLoading, setIsLoading] = useState(false); // 用於登出按鈕
  const [userProfile, setUserProfile] = useState(null);

  useEffect(() => {
    // 載入用戶資料和隱私設定
    loadUserProfile();
  }, []);

  const loadUserProfile = async () => {
    try {
      const profile = await getUserProfile();
      setUserProfile(profile);
      // 後端 account_privacy 是 'public' 或 'private'
      setIsPrivacyPublic(profile.account_privacy === 'public');
    } catch (error) {
      console.error('載入用戶資料失敗:', error);
      showNotification('載入用戶資料失敗');
    }
  };

  const showNotification = (message) => {
    setNotification(message);
  };

  const hideNotification = () => {
    setNotification('');
  };

  const handlePrivacyToggle = async (newPrivacyState) => {
    try {
      // 轉換前端的 boolean 到後端的字串格式
      const privacyValue = newPrivacyState ? 'public' : 'private';
      
      await updateAccountPrivacy(privacyValue);
      
      setIsPrivacyPublic(newPrivacyState);
      
    } catch (error) {
      console.error('更新隱私設定失敗:', error);
      showNotification('更新隱私設定失敗，請稍後再試');
      // 恢復原狀態
      setIsPrivacyPublic(!newPrivacyState);
    }
  };

  const handleLogout = async () => {
    setIsLoading(true);
    try {
      await logout();
      showNotification('登出成功！');
      
      // logout函數已經處理頁面跳轉，這裡只是防護措施
      setTimeout(() => {
        navigate('/');
      }, 1500);
    } catch (error) {
      console.error('登出失敗:', error);
      showNotification('登出失敗，請稍後再試');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <TopNavbar />
      
      <div className={styles.content}>
        <div className={styles.header}>
          <h1 className={styles.title}>個人設定</h1>
        </div>

        <div className={styles.settingsSection}>
          {/* 分隔線 */}
          <div className={styles.divider}></div>
          
          {/* 帳號設定組件 */}
          <AccountSettings 
            onPrivacyToggle={handlePrivacyToggle}
            isPrivacyPublic={isPrivacyPublic}
          />
        </div>

        {/* 登出按鈕 */}
        <div className={styles.logoutSection}>
          <button 
            className={styles.logoutButton}
            onClick={handleLogout}
            disabled={isLoading}
          >
            {isLoading ? '登出中...' : '登出'}
          </button>
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

export default SettingsPage; 