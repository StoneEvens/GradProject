import React, { useEffect, useState } from 'react';
import styles from '../styles/LongNotification.module.css';
import { useNotification } from '../context/NotificationContext';

const LongNotification = ({ message, onClose }) => {
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

    return () => {
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
    <div className={`${styles.longNotification} ${isFading ? styles.fadeOut : ''}`}>
      <span className={styles.message}>{message}</span>
      <button className={styles.closeButton} onClick={handleClose}>
        ✕
      </button>
    </div>
  );
};

export default LongNotification;