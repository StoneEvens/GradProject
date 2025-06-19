import React from 'react';
import styles from '../styles/ConfirmFollowModal.module.css';

const ConfirmRemoveFollowerModal = ({ 
  isVisible, 
  onClose, 
  onConfirm, 
  username 
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
            是否確定移除粉絲?
          </h3>
          <p className={styles.description}>
            移除 @{username} 的追蹤
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
              移除
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConfirmRemoveFollowerModal; 