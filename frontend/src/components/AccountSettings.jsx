import React, { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import styles from '../styles/AccountSettings.module.css';

const AccountSettings = ({ onPrivacyToggle, isPrivacyPublic }) => {
  const { t } = useTranslation('settings');
  const [isExpanded, setIsExpanded] = useState(true);

  const handleToggleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  const handlePrivacyToggle = () => {
    onPrivacyToggle(!isPrivacyPublic);
  };

  return (
    <div className={styles.accountSettingsContainer}>
      {/* 帳號標題列 */}
      <div className={styles.accountHeader} onClick={handleToggleExpand}>
        <div className={styles.headerLeft}>
          <img 
            src="/assets/icon/SettingIcon.png" 
            alt="設定圖示" 
            className={styles.pawIcon}
          />
          <span className={styles.accountText}>{t('account.title')}</span>
        </div>
        <div className={styles.headerRight}>
          <span className={`${styles.arrowIcon} ${isExpanded ? styles.expanded : styles.collapsed}`}>
            ▼
          </span>
        </div>
      </div>

      {/* 摺疊內容 */}
      {isExpanded && (
        <div className={styles.settingsContent}>
          <div className={styles.settingItem}>
            <div className={styles.settingLeft}>
              <div className={styles.settingTextContainer}>
                <span className={styles.settingText}>{t('account.accountPrivacy')}</span>
              </div>
            </div>
            <div className={styles.settingRight}>
              <div className={styles.toggleContainer}>
                <div 
                  className={`${styles.toggle} ${isPrivacyPublic ? styles.toggleOn : styles.toggleOff}`}
                  onClick={handlePrivacyToggle}
                >
                  <div className={styles.toggleSlider}></div>
                </div>
                <span className={styles.toggleLabel}>
                  {isPrivacyPublic ? t('account.privacyPublic') : t('account.privacyPrivate')}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AccountSettings; 