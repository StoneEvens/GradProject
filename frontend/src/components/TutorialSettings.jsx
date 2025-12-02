import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import styles from '../styles/TutorialSettings.module.css';

const TutorialSettings = () => {
  const { t } = useTranslation('settings');
  const navigate = useNavigate();
  const [isExpanded, setIsExpanded] = useState(true);
  const [selectedTutorial, setSelectedTutorial] = useState('');

  // 教學列表
  const tutorials = [
    { id: 'tagPet', name: t('tutorial.options.tagPet', '如何在貼文中標註寵物') },
    { id: 'createPost', name: t('tutorial.options.createPost', '如何發布貼文') },
    { id: 'calculate', name: t('tutorial.options.calculate', '如何使用營養計算機') },
    { id: 'addAbnormalPost', name: t('tutorial.options.addAbnormalPost', '如何新增異常記錄') },
    { id: 'addPet', name: t('tutorial.options.addPet', '如何新增一隻寵物') },
  ];

  const handleToggleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  const handleTutorialChange = (e) => {
    setSelectedTutorial(e.target.value);
  };

  const handleStartTutorial = () => {
    if (!selectedTutorial) return;

    // 根據教學類型決定導航目標
    const tutorialStartPaths = {
      tagPet: '/main',
      createPost: '/main',
      calculate: '/calculator',
      addAbnormalPost: '/pet',
      addPet: '/pet',
    };

    const startPath = tutorialStartPaths[selectedTutorial] || '/main';

    // 先導航到起始頁面
    navigate(startPath);

    // 延遲觸發教學開始事件，確保頁面已載入
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('startTutorial', {
        detail: { tutorialType: selectedTutorial }
      }));
    }, 500);
  };

  return (
    <div className={styles.tutorialSettingsContainer}>
      {/* 標題列 */}
      <div className={styles.tutorialHeader} onClick={handleToggleExpand}>
        <div className={styles.headerLeft}>
          <img
            src="/assets/icon/TutorialIcon.png"
            alt="教學圖示"
            className={styles.tutorialIcon}
            onError={(e) => {
              e.target.onerror = null;
              e.target.src = '/assets/icon/SettingIcon.png';
            }}
          />
          <span className={styles.tutorialText}>{t('tutorial.title', '教學導覽')}</span>
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
                <span className={styles.settingText}>{t('tutorial.selectTutorial', '選擇教學')}</span>
              </div>
            </div>
          </div>

          <div className={styles.tutorialSelectContainer}>
            <select
              className={styles.tutorialSelect}
              value={selectedTutorial}
              onChange={handleTutorialChange}
            >
              <option value="">{t('tutorial.placeholder', '-- 請選擇教學 --')}</option>
              {tutorials.map(tutorial => (
                <option key={tutorial.id} value={tutorial.id}>
                  {tutorial.name}
                </option>
              ))}
            </select>

            <button
              className={styles.startButton}
              onClick={handleStartTutorial}
              disabled={!selectedTutorial}
            >
              {t('tutorial.startButton', '開始')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TutorialSettings;
