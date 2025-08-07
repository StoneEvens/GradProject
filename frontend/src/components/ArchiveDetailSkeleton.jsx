import React from 'react';
import styles from '../styles/ArchiveDetailSkeleton.module.css';

const ArchiveDetailSkeleton = ({ isPublicView = false }) => {
  return (
    <div className={styles.skeletonContainer}>
      {/* 標題區域骨架 */}
      <div className={styles.headerSkeleton}>
        <div className={styles.titleSection}>
          <div className={styles.backButtonSkeleton}></div>
          <div className={styles.titleSkeleton}></div>
        </div>
        {!isPublicView && (
          <div className={styles.publishButtonSkeleton}></div>
        )}
      </div>
      
      <div className={styles.divider}></div>
      
      {/* 主要內容區域骨架 */}
      <div className={styles.cardContainer}>
        {/* 用戶資訊骨架 */}
        <div className={styles.userSection}>
          <div className={styles.avatarSkeleton}></div>
          <div className={styles.userInfo}>
            <div className={styles.usernameSkeleton}></div>
            <div className={styles.dateSkeleton}></div>
          </div>
        </div>
        
        {/* 標題骨架 */}
        <div className={styles.archiveTitleSkeleton}></div>
        
        {/* 寵物資訊骨架 */}
        <div className={styles.petInfoSection}>
          <div className={styles.petAvatarSkeleton}></div>
          <div className={styles.petInfoText}>
            <div className={styles.petNameSkeleton}></div>
            <div className={styles.petDetailsSkeleton}></div>
          </div>
        </div>
        
        {/* 病因標籤骨架 */}
        <div className={styles.tagsSection}>
          <div className={styles.tagSkeleton}></div>
          <div className={styles.tagSkeleton}></div>
          <div className={styles.tagSkeleton}></div>
        </div>
        
        {/* 內容骨架 */}
        <div className={styles.contentSection}>
          <div className={styles.contentLineSkeleton}></div>
          <div className={styles.contentLineSkeleton}></div>
          <div className={styles.contentLineSkeleton}></div>
          <div className={styles.contentLineSkeleton} style={{width: '70%'}}></div>
        </div>
        
        {/* 症狀區域骨架 */}
        <div className={styles.symptomsSection}>
          <div className={styles.sectionTitleSkeleton}></div>
          <div className={styles.symptomsGrid}>
            <div className={styles.symptomCardSkeleton}></div>
            <div className={styles.symptomCardSkeleton}></div>
            <div className={styles.symptomCardSkeleton}></div>
          </div>
        </div>
        
        {/* 互動按鈕骨架 - 只在公開模式顯示 */}
        {isPublicView && (
          <div className={styles.interactionSection}>
            <div className={styles.interactionButtonSkeleton}></div>
            <div className={styles.interactionButtonSkeleton}></div>
            <div className={styles.interactionButtonSkeleton}></div>
          </div>
        )}
      </div>
      
      {/* 公開模式互動區域 */}
      {isPublicView && (
        <div className={styles.publicInteractionSection}>
          <div className={styles.publicInteractionButtons}>
            <div className={styles.publicInteractionButton}></div>
            <div className={styles.publicInteractionButton}></div>
            <div className={styles.publicInteractionButton}></div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ArchiveDetailSkeleton;