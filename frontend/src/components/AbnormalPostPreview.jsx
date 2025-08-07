import React from 'react';
import styles from '../styles/AbnormalPostPreview.module.css';

const AbnormalPostPreview = ({ date, isEmergency, symptoms, onClick }) => {
  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${month}月${day}日`;
  };

  const formatSymptoms = (symptomsArray) => {
    if (!symptomsArray || symptomsArray.length === 0) return '無症狀記錄';
    
    // 如果是字串陣列
    if (typeof symptomsArray[0] === 'string') {
      return symptomsArray.join('、');
    }
    
    // 如果是物件陣列
    return symptomsArray.map(symptom => symptom.symptom_name || symptom.text || symptom).join('、');
  };

  return (
    <div 
      className={`${styles.abnormalPostPreview} ${isEmergency ? styles.emergency : ''}`}
      onClick={onClick}
    >
      <div className={styles.postPreviewIcon}>
        <img 
          src={isEmergency ? "/assets/icon/EmergencyIcon.png" : "/assets/icon/PetpagePetAbnormalPostButton.png"}
          alt={isEmergency ? "緊急記錄" : "異常記錄"} 
        />
      </div>
      
      <div className={styles.postPreviewContent}>
        <div className={styles.postPreviewHeader}>
          <span className={styles.postPreviewDate}>
            {formatDate(date)}
          </span>
          {isEmergency && (
            <span className={styles.emergencyBadge}>緊急</span>
          )}
        </div>
        
        <div className={styles.postPreviewSymptoms}>
          症狀：{formatSymptoms(symptoms)}
        </div>
      </div>
      
      <div className={styles.postPreviewArrow}>
        ❯
      </div>
    </div>
  );
};

export default AbnormalPostPreview;