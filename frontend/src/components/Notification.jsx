import React, { useEffect, useState } from 'react';
import styles from '../styles/Notification.module.css';
import { useNotification } from '../context/NotificationContext';

const Notification = ({ message, onClose }) => {
  const [isFading, setIsFading] = useState(false);
  
  // 嘗試使用 context，如果不存在則不使用
  let setIsNotificationVisible = null;
  try {
    const notificationContext = useNotification();
    if (notificationContext) {
      setIsNotificationVisible = notificationContext.setIsNotificationVisible;
    }
  } catch (error) {
    // Context 不存在時忽略錯誤
  }

  useEffect(() => {
    if (setIsNotificationVisible) {
      setIsNotificationVisible(true);
    }
    
    const timer = setTimeout(() => {
      handleClose();
    }, 4000);

    return () => {
      clearTimeout(timer);
      if (setIsNotificationVisible) {
        setIsNotificationVisible(false);
      }
    };
  }, [onClose, setIsNotificationVisible]);

  const handleClose = () => {
    setIsFading(true);
    if (setIsNotificationVisible) {
      setIsNotificationVisible(false);
    }
    setTimeout(() => {
      onClose();
    }, 300);
  };

  return (
    <div className={`${styles.notification} ${isFading ? styles.fadeOut : ''}`}>
      <span className={styles.message}>{message}</span>
      <button className={styles.closeButton} onClick={handleClose}>
        X
      </button>
    </div>
  );
};

export default Notification; 