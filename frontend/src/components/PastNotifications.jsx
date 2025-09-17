import React from 'react';
import { useTranslation } from 'react-i18next';
import styles from '../styles/PastNotifications.module.css';

const PastNotifications = ({ notifications }) => {
  const { t } = useTranslation('social');

  // 處理頭像載入失敗
  const handleImageError = (e) => {
    e.target.src = '/assets/icon/DefaultAvatar.jpg';
  };

  // 獲取頭像URL，確保有效性
  const getAvatarUrl = (notification) => {
    const headshot_url = notification.follow_request_from_info?.headshot_url;
    return headshot_url && headshot_url !== 'null' ? headshot_url : '/assets/icon/DefaultAvatar.jpg';
  };



  if (!notifications || notifications.length === 0) {
    return (
      <div className={styles.container}>
        <h3 className={styles.sectionTitle}>{t('notifications.pastTitle')}</h3>
        <div className={styles.divider}></div>
        <div className={styles.emptyMessage}>
          {t('notifications.noPast')}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <h3 className={styles.sectionTitle}>{t('notifications.pastTitle')}</h3>
      <div className={styles.divider}></div>
      <div className={styles.notificationList}>
        {notifications.map((notification) => (
          <div key={notification.id} className={styles.notificationItem}>
            <div className={styles.avatar}>
              <img
                src={getAvatarUrl(notification)}
                alt={t('notifications.avatar')}
                onError={handleImageError}
              />
            </div>
            <div className={styles.content}>
              {notification.notification_type === 'info' ? (
                // info類型通知只顯示內容
                <span className={styles.message}>
                  {notification.content}
                </span>
              ) : (
                // 其他類型通知顯示用戶名和內容
                <>
                  <span className={styles.username}>
                    {notification.follow_request_from_info?.username || t('notifications.unknownUser')}
                  </span>
                  <span className={styles.message}>
                    {notification.content}
                  </span>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PastNotifications; 