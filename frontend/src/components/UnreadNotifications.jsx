import React from 'react';
import { useTranslation } from 'react-i18next';
import styles from '../styles/UnreadNotifications.module.css';
import { respondToFollowRequest } from '../services/notificationService';

const UnreadNotifications = ({ notifications, onNotificationUpdate }) => {
  const { t } = useTranslation('social');

  // 處理追蹤請求回應
  const handleFollowRequestResponse = async (notificationId, action) => {
    try {
      const result = await respondToFollowRequest(notificationId, action);
      if (result.success) {
        // 通知父組件更新通知列表
        onNotificationUpdate();
        
        // 顯示操作成功訊息
        if (window.showNotification) {
          const actionText = action === 'accept' ? t('notifications.actionSuccess.accepted') : t('notifications.actionSuccess.rejected');
          window.showNotification(`${actionText}${t('notifications.actionSuccess.followRequest')}`);
        }
      } else {
        // 顯示錯誤訊息
        if (window.showNotification) {
          window.showNotification(t('notifications.actionFailed'));
        }
      }
    } catch (error) {
      console.error('處理追蹤請求失敗:', error);
      if (window.showNotification) {
        window.showNotification(t('notifications.actionFailed'));
      }
    }
  };

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
        <h3 className={styles.sectionTitle}>{t('notifications.unreadTitle')}</h3>
        <div className={styles.divider}></div>
        <div className={styles.emptyMessage}>
          {t('notifications.noUnread')}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <h3 className={styles.sectionTitle}>{t('notifications.unreadTitle')}</h3>
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
            <div className={styles.actions}>
              {notification.notification_type === 'follow_request' && (
                <>
                  <button
                    className={styles.rejectButton}
                    onClick={() => handleFollowRequestResponse(notification.id, 'reject')}
                  >
                    {t('common.reject')}
                  </button>
                  <button
                    className={styles.acceptButton}
                    onClick={() => handleFollowRequestResponse(notification.id, 'accept')}
                  >
                    {t('common.confirm')}
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default UnreadNotifications; 