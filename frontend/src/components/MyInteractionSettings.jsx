import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import styles from '../styles/MyInteractionSettings.module.css';

const MyInteractionSettings = () => {
  const { t } = useTranslation('settings');
  const [isExpanded, setIsExpanded] = useState(true);
  const navigate = useNavigate();

  const handleToggleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  const handleLikedPostsClick = () => {
    // 導航到按讚的貼文頁面
    navigate('/liked-posts');
  };

  const handleSavedPostsClick = () => {
    // 導航到收藏的貼文頁面
    navigate('/saved-posts');
  };

  const handleLikedArchivesClick = () => {
    // 導航到按讚的論壇文章頁面
    navigate('/liked-archives');
  };

  const handleSavedArchivesClick = () => {
    // 導航到收藏的論壇文章頁面
    navigate('/saved-archives');
  };

  return (
    <div className={styles.myInteractionContainer}>
      {/* 我的互動標題列 */}
      <div className={styles.interactionHeader} onClick={handleToggleExpand}>
        <div className={styles.headerLeft}>
          <img 
            src="/assets/icon/SettingIcon.png" 
            alt="我的互動圖示" 
            className={styles.pawIcon}
          />
          <span className={styles.interactionText}>{t('interaction.title')}</span>
        </div>
        <div className={styles.headerRight}>
          <span className={`${styles.arrowIcon} ${isExpanded ? styles.expanded : styles.collapsed}`}>
            ▼
          </span>
        </div>
      </div>

      {/* 摺疊內容 */}
      {isExpanded && (
        <div className={styles.interactionContent}>
          {/* 按讚的貼文 */}
          <div className={styles.interactionItem} onClick={handleLikedPostsClick}>
            <div className={styles.itemLeft}>
              <span className={styles.itemText}>{t('interaction.likedPosts')}</span>
            </div>
            <div className={styles.itemRight}>
              <span className={styles.chevronIcon}>❯</span>
            </div>
          </div>

          {/* 收藏的貼文 */}
          <div className={styles.interactionItem} onClick={handleSavedPostsClick}>
            <div className={styles.itemLeft}>
              <span className={styles.itemText}>{t('interaction.savedPosts')}</span>
            </div>
            <div className={styles.itemRight}>
              <span className={styles.chevronIcon}>❯</span>
            </div>
          </div>

          {/* 按讚的論壇文章 */}
          <div className={styles.interactionItem} onClick={handleLikedArchivesClick}>
            <div className={styles.itemLeft}>
              <span className={styles.itemText}>{t('interaction.likedArchives')}</span>
            </div>
            <div className={styles.itemRight}>
              <span className={styles.chevronIcon}>❯</span>
            </div>
          </div>

          {/* 收藏的論壇文章 */}
          <div className={styles.interactionItem} onClick={handleSavedArchivesClick}>
            <div className={styles.itemLeft}>
              <span className={styles.itemText}>{t('interaction.savedArchives')}</span>
            </div>
            <div className={styles.itemRight}>
              <span className={styles.chevronIcon}>❯</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyInteractionSettings;