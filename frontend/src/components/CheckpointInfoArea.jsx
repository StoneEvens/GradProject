import React from 'react';
import styles from '../styles/CheckpointInfoArea.module.css';

const CheckpointInfoArea = ({ checkpoint, onClose, onEnter }) => {
  // 模擬數據
  const mockCheckpoint = checkpoint || {
    id: 1,
    name: '站點名稱',
    ownerName: '目前持有人',
    description: '這是文山區景美溪步行路線的第二號站點，風景不錯',
    imageUrl: '/assets/icon/MockCheckpointHeadshot.jpg',
    ownerAvatar: '/assets/icon/MockCheckpointHeadshot.jpg'
  };

  return (
    <div className={styles.checkpointInfoArea}>
      {/* 頂部區域 - 照片和站點名稱 */}
      <div className={styles.topSection}>
        {/* 站點圖片 - 凸出設計 */}
        <div className={styles.imageWrapper}>
          <div className={styles.imageContainer}>
            <img 
              src={mockCheckpoint.imageUrl} 
              alt={mockCheckpoint.name}
              className={styles.checkpointImage}
            />
          </div>
        </div>
        
        {/* 站點名稱和擁有者區域 */}
        <div className={styles.nameSection}>
          <h3 className={styles.checkpointName}>{mockCheckpoint.name}</h3>
          <div className={styles.ownerInfo}>
            <span className={styles.ownerLabel}>目前持有人</span>
          </div>
        </div>
      </div>

      {/* 描述區域 */}
      <div className={styles.descriptionSection}>
        <p className={styles.description}>
          {mockCheckpoint.description}
        </p>
      </div>

      {/* 按鈕區域 */}
      <div className={styles.buttonContainer}>
        <button 
          className={styles.closeButton}
          onClick={onClose}
        >
          關閉
        </button>
        <button 
          className={styles.enterButton}
          onClick={onEnter}
        >
          站點打卡
        </button>
      </div>
    </div>
  );
};

export default CheckpointInfoArea;