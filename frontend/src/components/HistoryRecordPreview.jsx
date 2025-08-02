import React from 'react';
import styles from '../styles/HistoryRecordPreview.module.css';

const HistoryRecordPreview = ({ record, onClick }) => {
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${month}月${day}日`;
  };

  return (
    <div 
      className={styles.recordPreviewItem}
      onClick={() => onClick(record)}
    >
      <div className={styles.previewIcon}>
        <img 
          src="/assets/icon/HistoryRecordIcon.png" 
          alt="歷史紀錄"
        />
      </div>
      
      <div className={styles.previewContent}>
        <div className={styles.previewDateRow}>
          <span className={styles.previewDate}>{formatDate(record.date)}</span>
        </div>
        <div className={styles.previewInfo}>
          <span className={styles.previewLabel}>寵物：</span>
          <span className={styles.previewPet}>{record.petName}</span>
        </div>
        <div className={styles.previewInfo}>
          <span className={styles.previewLabel}>飼料：</span>
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