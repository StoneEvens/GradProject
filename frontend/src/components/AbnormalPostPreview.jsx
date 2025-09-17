import React from 'react';
import { useTranslation } from 'react-i18next';
import { useSymptomTranslation } from '../hooks/useSymptomTranslation';
import styles from '../styles/AbnormalPostPreview.module.css';

const AbnormalPostPreview = ({ date, isEmergency, symptoms, onClick }) => {
  const { t, i18n } = useTranslation('posts');
  const { formatSymptomsForDisplay } = useSymptomTranslation();
  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);

    if (i18n.language === 'en') {
      // English format: "Jan 15", "Feb 3", etc.
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } else if (i18n.language === 'ja') {
      // Japanese format: "1月15日", "2月3日", etc.
      return date.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' });
    } else {
      // Chinese format: "1月15日", "2月3日", etc.
      return date.toLocaleDateString('zh-TW', { month: 'short', day: 'numeric' });
    }
  };

  const formatSymptoms = (symptomsArray) => {
    if (!symptomsArray || symptomsArray.length === 0) return t('abnormalPostPreview.noSymptoms');

    // 使用症狀翻譯工具
    return formatSymptomsForDisplay(symptomsArray) || t('abnormalPostPreview.noSymptoms');
  };

  return (
    <div 
      className={`${styles.abnormalPostPreview} ${isEmergency ? styles.emergency : ''}`}
      onClick={onClick}
    >
      <div className={styles.postPreviewIcon}>
        <img 
          src={isEmergency ? "/assets/icon/EmergencyIcon.png" : "/assets/icon/PetpagePetAbnormalPostButton.png"}
          alt={isEmergency ? t('abnormalPostPreview.emergencyRecordAlt') : t('abnormalPostPreview.abnormalRecordAlt')} 
        />
      </div>
      
      <div className={styles.postPreviewContent}>
        <div className={styles.postPreviewHeader}>
          <span className={styles.postPreviewDate}>
            {formatDate(date)}
          </span>
          {isEmergency && (
            <span className={styles.emergencyBadge}>{t('abnormalPostPreview.emergencyBadge')}</span>
          )}
        </div>
        
        <div className={styles.postPreviewSymptoms}>
          {t('abnormalPostPreview.symptomsLabel')}：{formatSymptoms(symptoms)}
        </div>
      </div>
      
      <div className={styles.postPreviewArrow}>
        ❯
      </div>
    </div>
  );
};

export default AbnormalPostPreview;