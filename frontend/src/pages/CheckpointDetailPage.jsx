import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import CheckpointDetailCanvas from '../components/CheckpointDetailCanvas';
import { useUser } from '../context/UserContext';
import styles from '../styles/CheckpointDetailPage.module.css';

const CheckpointDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { userHeadshot } = useUser();
  const [isLoaded, setIsLoaded] = useState(false);
  const [checkpoint, setCheckpoint] = useState(null);

  // 模擬站點資料
  useEffect(() => {
    // 模擬資料載入延遲
    setTimeout(() => {
      const mockCheckpoint = {
        id: id || '1',
        name: '景美溪二號站點博物館',
        description: '這是文山區景美溪步行路線的第二號站點，展示當地歷史文物和自然生態。',
        ownerName: '小明',
        theme: 'nature', // 博物館主題
        items: [
          { id: 1, name: '景美溪生態標本', type: 'specimen' },
          { id: 2, name: '在地歷史文物', type: 'artifact' },
          { id: 3, name: '互動體驗區', type: 'interactive' }
        ]
      };
      
      setCheckpoint(mockCheckpoint);
      setIsLoaded(true);
    }, 1000);
  }, [id]);

  const handleBackToCity = () => {
    navigate('/interactive-city');
  };

  const handleExitCheckpoint = () => {
    navigate('/main');
  };

  return (
    <div className={styles.container}>
      {/* 載入畫面覆蓋層 */}
      {!isLoaded && (
        <div className={styles.loadingScreen}>
          <div className={styles.loadingContent}>
            <div className={styles.spinner}></div>
            <p className={styles.loadingText}>正在載入站點博物館</p>
            <p className={styles.debugMessage}>準備進入3D場景...</p>
          </div>
        </div>
      )}

      {/* 主要3D場景 */}
      {isLoaded && checkpoint && (
        <CheckpointDetailCanvas
          checkpoint={checkpoint}
          onSceneReady={() => console.log('博物館場景已載入')}
        />
      )}

      {/* 返回按鈕 */}
      <button 
        className={styles.backButton}
        onClick={handleBackToCity}
        title="返回互動城市"
      >
        ❮
      </button>

      {/* 使用者資訊區域 */}
      <div className={styles.userInfoSection}>
        <button className={styles.avatarButton}>
          <img 
            src={userHeadshot}
            alt="使用者頭像"
            className={styles.avatarImage}
          />
        </button>
      </div>
    </div>
  );
};

export default CheckpointDetailPage;