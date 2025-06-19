import React from 'react';
import styles from '../styles/ConfirmFollowModal.module.css';

const ConfirmFollowModal = ({ 
  isVisible, 
  onClose, 
  onConfirm, 
  username,
  isPrivateAccount = true 
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
            確定要送出{isPrivateAccount ? '要求追蹤' : '追蹤'} ?
          </h3>
          
          <div className={styles.buttons}>
            <button 
              className={styles.cancelButton}
              onClick={onClose}
            >
              算了
            </button>
            <button 
              className={styles.confirmButton}
              onClick={onConfirm}
            >
              確認
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConfirmFollowModal; 