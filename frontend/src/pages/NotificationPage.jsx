import React, { useState, useEffect } from 'react';
import styles from '../styles/NotificationPage.module.css';
import TopNavbar from '../components/TopNavbar';
import BottomNavbar from '../components/BottomNavigationbar';
import UnreadNotifications from '../components/UnreadNotifications';
import PastNotifications from '../components/PastNotifications';
import Notification from '../components/Notification';
import { getNotifications } from '../services/notificationService';

const NotificationPage = () => {
  const [unreadNotifications, setUnreadNotifications] = useState([]);
  const [readNotifications, setReadNotifications] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [notification, setNotification] = useState('');

  // 載入通知列表
  const loadNotifications = async () => {
    try {
      setIsLoading(true);
      const result = await getNotifications();
      
      if (result.success) {
        const allNotifications = result.data.notifications || [];
        setUnreadNotifications(allNotifications);
        
        // 分離未讀和已讀通知
        const unread = allNotifications.filter(n => !n.is_read);
        const read = allNotifications.filter(n => n.is_read);
        
        setUnreadNotifications(unread);
        setReadNotifications(read);
      } else {
        showNotification('載入通知失敗');
      }
    } catch (error) {
      console.error('載入通知失敗:', error);
      showNotification('載入通知失敗');
    } finally {
      setIsLoading(false);
    }
  };



  // 處理通知更新（當用戶處理追蹤請求時）
  const handleNotificationUpdate = async () => {
    await loadNotifications();
  };

  // 顯示通知訊息
  const showNotification = (message) => {
    setNotification(message);
  };

  // 隱藏通知訊息
  const hideNotification = () => {
    setNotification('');
  };

  // 組件載入時獲取通知
  useEffect(() => {
    loadNotifications();
  }, []);

  if (isLoading) {
    return (
      <div className={styles.container}>
        <TopNavbar />
        <div className={styles.loadingContainer}>
          <div className={styles.loading}>載入中...</div>
        </div>
        <BottomNavbar />
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <TopNavbar />
      
      {notification && (
        <Notification
          message={notification}
          onClose={hideNotification}
        />
      )}
      
      <main className={styles.content}>
        {/* 未讀訊息區域 */}
        <UnreadNotifications 
          notifications={unreadNotifications}
          onNotificationUpdate={handleNotificationUpdate}
        />
        
        {/* 過去訊息區域 */}
        <PastNotifications 
          notifications={readNotifications}
        />
      </main>
      
      <BottomNavbar />
    </div>
  );
};

export default NotificationPage; 