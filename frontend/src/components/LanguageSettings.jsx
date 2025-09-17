import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import styles from '../styles/LanguageSettings.module.css';

const LanguageSettings = () => {
  const { i18n, t } = useTranslation('settings');
  const [isExpanded, setIsExpanded] = useState(true);
  const [currentLanguage, setCurrentLanguage] = useState(i18n.language || 'zh-TW');
  const [isChanging, setIsChanging] = useState(false);

  useEffect(() => {
    // 確保語言設定同步
    setCurrentLanguage(i18n.language);
  }, [i18n.language]);

  const handleToggleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  const handleLanguageChange = async (e) => {
    const newLanguage = e.target.value;
    setIsChanging(true);

    try {
      await i18n.changeLanguage(newLanguage);
      setCurrentLanguage(newLanguage);
      localStorage.setItem('language', newLanguage);

      // 顯示變更成功的視覺反饋
      setTimeout(() => {
        setIsChanging(false);
      }, 300);
    } catch (error) {
      console.error('語言切換失敗:', error);
      setIsChanging(false);
    }
  };

  const languages = [
    { code: 'zh-TW', name: '繁體中文', flag: '🇹🇼' },
    { code: 'en', name: 'English', flag: '🇺🇸' },
    { code: 'ja', name: '日本語', flag: '🇯🇵' },
    // { code: 'es', name: 'Español', flag: '🇪🇸' }
  ];

  return (
    <div className={styles.languageContainer}>
      {/* 語言設定標題列 */}
      <div className={styles.languageHeader} onClick={handleToggleExpand}>
        <div className={styles.headerLeft}>
          <img
            src="/assets/icon/SettingIcon.png"
            alt="語言設定圖示"
            className={styles.languageIcon}
          />
          <span className={styles.languageText}>{t('language.title')}</span>
        </div>
        <div className={styles.headerRight}>
          <span className={`${styles.arrowIcon} ${isExpanded ? styles.expanded : styles.collapsed}`}>
            ▼
          </span>
        </div>
      </div>

      {/* 摺疊內容 */}
      {isExpanded && (
        <div className={styles.languageContent}>
          <div className={styles.languageItem}>
            <div className={styles.itemLeft}>
              <span className={styles.itemText}>{t('language.systemLanguage')}</span>
            </div>
            <div className={styles.itemRight}>
              <select
                className={`${styles.languageSelect} ${isChanging ? styles.changing : ''}`}
                value={currentLanguage}
                onChange={handleLanguageChange}
                disabled={isChanging}
              >
                {languages.map(lang => (
                  <option key={lang.code} value={lang.code}>
                    {lang.flag} {lang.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 語言說明 */}
          <div className={styles.languageInfo}>
            <p className={styles.infoText}>
              {t('language.changeLanguageInfo')}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default LanguageSettings;