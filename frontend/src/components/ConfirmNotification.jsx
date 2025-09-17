import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import styles from '../styles/ConfirmNotification.module.css';
import { useNotification } from '../context/NotificationContext';

const ConfirmNotification = ({ message, onConfirm, onCancel }) => {
  const { t } = useTranslation('social');
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

  React.useEffect(() => {
    if (setIsNotificationVisible) {
      setIsNotificationVisible(true);
    }
    
    return () => {
      if (setIsNotificationVisible) {
        setIsNotificationVisible(false);
      }
    };
  }, [setIsNotificationVisible]);

  const handleConfirm = () => {
    setIsFading(true);
    if (setIsNotificationVisible) {
      setIsNotificationVisible(false);
    }
    setTimeout(() => {
      onConfirm();
    }, 300);
  };

  const handleCancel = () => {
    setIsFading(true);
    if (setIsNotificationVisible) {
      setIsNotificationVisible(false);
    }
    setTimeout(() => {
      onCancel();
    }, 300);
  };

  return (
    <div className={`${styles.confirmNotification} ${isFading ? styles.fadeOut : ''}`}>
      <span className={styles.message}>{message}</span>
      <div className={styles.buttonContainer}>
        <button className={styles.cancelButton} onClick={handleCancel}>
          {t('confirmNotification.cancel')}
        </button>
        <button className={styles.confirmButton} onClick={handleConfirm}>
          {t('confirmNotification.confirm')}
        </button>
      </div>
    </div>
  );
};

export default ConfirmNotification;