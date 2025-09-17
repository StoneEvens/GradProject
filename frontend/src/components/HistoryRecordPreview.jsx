import React from 'react';
import { useTranslation } from 'react-i18next';
import styles from '../styles/HistoryRecordPreview.module.css';

const HistoryRecordPreview = ({ record, onClick }) => {
  const { t } = useTranslation('calculator');

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return t('historyPreview.monthDay', { month, day });
  };

  return (
    <div 
      className={styles.recordPreviewItem}
      onClick={() => onClick(record)}
    >
      <div className={styles.previewIcon}>
        <img 
          src="/assets/icon/HistoryRecordIcon.png" 
          alt={t('historyPreview.historyRecord')}
        />
      </div>
      
      <div className={styles.previewContent}>
        <div className={styles.previewDateRow}>
          <span className={styles.previewDate}>{formatDate(record.date)}</span>
        </div>
        <div className={styles.previewInfo}>
          <span className={styles.previewLabel}>{t('historyPreview.pet')}</span>
          <span className={styles.previewPet}>{record.petName}</span>
        </div>
        <div className={styles.previewInfo}>
          <span className={styles.previewLabel}>{t('historyPreview.feed')}</span>
          <span className={styles.previewFeed}>{record.feedName}</span>
        </div>
      </div>
      
      <div className={styles.previewArrow}>
        ❯
      </div>
    </div>
  );
};

export default HistoryRecordPreview;