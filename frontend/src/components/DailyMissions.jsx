import React, { useState, useEffect } from 'react';
import styles from '../styles/DailyMissions.module.css';

const DailyMissions = () => {
  const [missions, setMissions] = useState([
    { id: 1, title: '社群發文 1 次', completed: false },
    { id: 2, title: '閱讀 1 篇論壇文章', completed: false },
    { id: 3, title: '按讚 1 篇社群貼文', completed: false },
    { id: 4, title: '公園散步', completed: false },
    { id: 5, title: '餵食寵物', completed: false },
    { id: 6, title: '清理寵物用品', completed: false },
  ]);

  // 模擬從 API 獲取任務
  useEffect(() => {
    // 這裡可以添加 API 調用
    // const fetchMissions = async () => {
    //   try {
    //     const response = await api.getMissions();
    //     setMissions(response.data);
    //   } catch (error) {
    //     console.error('獲取任務失敗:', error);
    //   }
    // };
    // fetchMissions();
  }, []);

  // 切換任務完成狀態
  const toggleMissionComplete = (id) => {
    setMissions(prevMissions => prevMissions.map(mission => 
      mission.id === id ? { ...mission, completed: !mission.completed } : mission
    ));
    
    // 這裡可以添加 API 調用，更新任務狀態
    // api.updateMissionStatus(id, !missions.find(m => m.id === id).completed);
  };

  // 全部領取
  const handleCollectAll = () => {
    // 檢查是否有未完成的任務
    if (missions.some(mission => !mission.completed)) {
      // 將所有任務標記為已完成
      setMissions(prevMissions => prevMissions.map(mission => ({ ...mission, completed: true })));
      
      // 這裡可以添加 API 調用，一次性完成所有任務
      // api.completeAllMissions();
      
      // 顯示通知或者獎勵訊息
      alert('恭喜！您已領取所有任務獎勵！');
    } else {
      alert('您已經完成並領取了所有任務！');
    }
  };

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>每日任務</h2>
      <div className={styles.missionList}>
        {missions.map((mission) => (
          <div key={mission.id} className={styles.missionItem}>
            <div 
              className={`${styles.checkbox} ${mission.completed ? styles.completed : ''}`}
              onClick={() => toggleMissionComplete(mission.id)}
            />
            <span className={styles.missionText}>{mission.title}</span>
          </div>
        ))}
      </div>
      <button 
        className={styles.collectButton}
        onClick={handleCollectAll}
        disabled={missions.every(mission => mission.completed)}
      >
        全部領取
      </button>
    </div>
  );
};

export default DailyMissions; 