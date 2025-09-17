import React from 'react';
import { useTranslation } from 'react-i18next';
import styles from '../styles/ConfirmFollowModal.module.css';

const ConfirmFollowModal = ({ 
  isVisible, 
  onClose, 
  onConfirm, 
  username,
  isPrivateAccount = true 
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
            {t('confirmFollowModal.title', {
              action: isPrivateAccount ? t('confirmFollowModal.actions.requestFollow') : t('confirmFollowModal.actions.follow')
            })}
          </h3>

          <div className={styles.buttons}>
            <button
              className={styles.cancelButton}
              onClick={onClose}
            >
              {t('confirmFollowModal.cancel')}
            </button>
            <button
              className={styles.confirmButton}
              onClick={onConfirm}
            >
              {t('common.confirm')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConfirmFollowModal; 