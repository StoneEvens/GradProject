import React from 'react';
import styles from '../styles/ConfirmFollowModal.module.css';

const FeedReviewConfirmModal = ({ 
  isVisible, 
  onClose, 
  onConfirm
}) => {
  if (!isVisible) return null;

  const handleBackgroundClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className={styles.overlay} onClick={handleBackgroundClick}>
      <div className={styles.modal}>
        <div className={styles.content}>
          <h3 className={styles.title}>
            請協助審核飼料
          </h3>
          <p className={styles.description}>
            此飼料尚未通過審核，請您協助審核後再使用此飼料
          </p>
          
          <div className={styles.buttons}>
            <button 
              className={styles.cancelButton}
              onClick={onClose}
            >
              取消
            </button>
            <button 
              className={styles.confirmButton}
              onClick={onConfirm}
            >
              確定
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FeedReviewConfirmModal;