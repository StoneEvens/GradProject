import React, { useEffect, useState } from 'react';
import styles from '../styles/Notification.module.css';
import { useNotification } from '../context/NotificationContext';

const Notification = ({ message, onClose }) => {
  const [isFading, setIsFading] = useState(false);
  const { setIsNotificationVisible } = useNotification();

  useEffect(() => {
    setIsNotificationVisible(true);
    const timer = setTimeout(() => {
      handleClose();
    }, 4000);

    return () => {
      clearTimeout(timer);
      setIsNotificationVisible(false);
    };
  }, [onClose, setIsNotificationVisible]);

  const handleClose = () => {
    setIsFading(true);
    setIsNotificationVisible(false);
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