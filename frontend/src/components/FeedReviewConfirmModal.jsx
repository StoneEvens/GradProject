import React from 'react';
import { useTranslation } from 'react-i18next';
import styles from '../styles/ConfirmFollowModal.module.css';

const FeedReviewConfirmModal = ({
  isVisible,
  onClose,
  onConfirm
}) => {
  const { t } = useTranslation('feed');

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
            {t('reviewConfirmModal.title')}
          </h3>
          <p className={styles.description}>
            {t('reviewConfirmModal.description')}
          </p>
          
          <div className={styles.buttons}>
            <button
              className={styles.cancelButton}
              onClick={onClose}
            >
              {t('reviewConfirmModal.buttons.cancel')}
            </button>
            <button
              className={styles.confirmButton}
              onClick={onConfirm}
            >
              {t('reviewConfirmModal.buttons.confirm')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FeedReviewConfirmModal;