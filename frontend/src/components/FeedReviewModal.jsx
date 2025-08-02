import React, { useState } from 'react';
import styles from '../styles/EditProfileModal.module.css';
import Notification from './Notification';
import FeedErrorReportModal from './FeedErrorReportModal';
import LongNotification from './LongNotification';

const FeedReviewModal = ({ feed, isOpen, onClose, onConfirm, onReportError, onErrorReportSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState('');
  const [showErrorReportModal, setShowErrorReportModal] = useState(false);
  const [showLongNotification, setShowLongNotification] = useState(false);

  // 顯示通知
  const showNotification = (message) => {
    setNotification(message);
  };

  // 隱藏通知
  const hideNotification = () => {
    setNotification('');
  };

  // 處理確認審核
  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm(feed);
      onClose();
    } catch (error) {
      console.error('審核失敗:', error);
      showNotification('審核失敗，請稍後再試');
    } finally {
      setLoading(false);
    }
  };

  // 處理回報錯誤 - 打開錯誤回報 modal
  const handleReportError = () => {
    setShowErrorReportModal(true);
  };

  // 處理錯誤回報提交
  const handleErrorReportSubmit = async (errorData) => {
    try {
      await onReportError(errorData);
      setShowErrorReportModal(false);
      setShowLongNotification(true);
      
      // 如果有成功回調，執行它（例如允許使用飼料）
      if (onErrorReportSuccess) {
        onErrorReportSuccess(feed);
      }
      
      // 不自動關閉主 modal，讓用戶看到長通知並手動關閉
    } catch (error) {
      console.error('回報錯誤失敗:', error);
      throw error;
    }
  };

  // 處理取消
  const handleCancel = () => {
    setNotification('');
    onClose();
  };

  // 處理點擊遮罩關閉 modal
  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget && !loading) {
      handleCancel();
    }
  };

  if (!isOpen || !feed) return null;

  return (
    <>
      <div className={styles.modalOverlay} onClick={handleOverlayClick}>
        {notification && (
          <Notification
            message={notification}
            onClose={hideNotification}
          />
        )}
        <div className={styles.modalContainer}>
          <div className={styles.modalHeader}>
            <h2>{feed.name || feed.feedName || '飼料名稱'}</h2>
          </div>
          
          <div className={styles.modalBody}>
            {/* 飼料圖片區塊 */}
            <div className={styles.avatarSection}>
              <div className={styles.avatarContainer}>
                {feed.frontImage || feed.front_image_url ? (
                  <img 
                    src={feed.frontImage || feed.front_image_url} 
                    alt="飼料圖片" 
                    className={styles.avatarPreview}
                  />
                ) : (
                  <div className={styles.avatarPreview} style={{
                    backgroundColor: '#FFE4B5',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#89350c',
                    fontSize: '14px'
                  }}>
                    無圖片
                  </div>
                )}
              </div>
            </div>

            {/* 飼料資訊區塊 */}
            <div className={styles.formSection}>
              <div className={styles.inputGroup}>
                <label>新增使用者名稱</label>
                <div className={styles.readOnlyField}>
                  {feed.created_by_name || feed.createdByName || '未知使用者'}
                </div>
              </div>

              <div className={styles.inputGroup}>
                <label>新增日期</label>
                <div className={styles.readOnlyField}>
                  {feed.created_at ? new Date(feed.created_at).toLocaleDateString('zh-TW') : '未知日期'}
                </div>
              </div>

              <div className={styles.inputGroup}>
                <label>飼料品牌</label>
                <div className={styles.readOnlyField}>
                  {feed.brand || '未提供'}
                </div>
              </div>

              <div className={styles.inputGroup}>
                <label>飼料價錢</label>
                <div className={styles.readOnlyField}>
                  {feed.price ? `NT$ ${feed.price}` : '未提供'}
                </div>
              </div>

              <div className={styles.inputGroup}>
                <label>營養成分</label>
                <div className={styles.nutritionInfo}>
                  <div className={styles.nutritionRow}>
                    <span>蛋白質: {feed.protein || 0}%</span>
                    <span>脂肪: {feed.fat || 0}%</span>
                  </div>
                  <div className={styles.nutritionRow}>
                    <span>碳水化合物: {feed.carbohydrate || 0}%</span>
                    <span>鈣: {feed.calcium || 0}%</span>
                  </div>
                  <div className={styles.nutritionRow}>
                    <span>磷: {feed.phosphorus || 0}%</span>
                    <span>鎂: {feed.magnesium || 0}%</span>
                  </div>
                  <div className={styles.nutritionRow}>
                    <span>鈉: {feed.sodium || 0}%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className={styles.modalFooter}>
            <button 
              className={styles.cancelButton} 
              onClick={handleReportError}
              disabled={loading}
            >
              回報錯誤
            </button>
            <button 
              className={styles.saveButton} 
              onClick={handleConfirm}
              disabled={loading}
            >
              {loading ? '處理中...' : '確認'}
            </button>
          </div>
        </div>
      </div>

      {/* 錯誤回報 Modal */}
      <FeedErrorReportModal
        feed={feed}
        isOpen={showErrorReportModal}
        onClose={() => setShowErrorReportModal(false)}
        onSubmit={handleErrorReportSubmit}
      />
      
      {/* 長通知 */}
      {showLongNotification && (
        <LongNotification
          message="感謝您的回報，請靜待系統審核錯誤。您目前可以自由使用此飼料，錯誤的資訊麻煩您手動於營養計算機處更新"
          onClose={() => {
            setShowLongNotification(false);
            onClose();
          }}
        />
      )}
    </>
  );
};

export default FeedReviewModal;