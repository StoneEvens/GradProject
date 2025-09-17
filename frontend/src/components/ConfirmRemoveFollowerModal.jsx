import React from 'react';
import { useTranslation } from 'react-i18next';
import styles from '../styles/ConfirmFollowModal.module.css';

const ConfirmRemoveFollowerModal = ({ 
  isVisible, 
  onClose, 
  onConfirm, 
  username 
}) => {
  const { t } = useTranslation('social');

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
            {t('confirmRemoveFollowerModal.title')}
          </h3>
          <p className={styles.description}>
            {t('confirmRemoveFollowerModal.description', { username })}
          </p>

          <div className={styles.buttons}>
            <button
              className={styles.cancelButton}
              onClick={onClose}
            >
              {t('common.cancel')}
            </button>
            <button
              className={styles.confirmButton}
              onClick={onConfirm}
            >
              {t('common.remove')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConfirmRemoveFollowerModal; 