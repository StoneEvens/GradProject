import React, { useState } from 'react';
import styles from '../styles/AddSchedule.module.css';

const AddSchedule = ({ onClose, onSave }) => {
  const [isPM, setIsPM] = useState(false);
  const [hour, setHour] = useState('08');
  const [minute, setMinute] = useState('00');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  const handleHourChange = (e) => {
    let value = e.target.value;
    // 限制輸入範圍為 1-12
    if (value === '' || (parseInt(value) >= 1 && parseInt(value) <= 12)) {
      // 格式化為兩位數
      setHour(value.padStart(2, '0'));
    }
  };

  const handleMinuteChange = (e) => {
    let value = e.target.value;
    // 限制輸入範圍為 0-59
    if (value === '' || (parseInt(value) >= 0 && parseInt(value) <= 59)) {
      // 格式化為兩位數
      setMinute(value.padStart(2, '0'));
    }
  };

  const handleSubmit = () => {
    // 轉換時間格式為24小時制
    let formattedHour = parseInt(hour);
    
    // 調整為 24 小時制
    if (isPM && formattedHour < 12) {
      formattedHour += 12;
    } else if (!isPM && formattedHour === 12) {
      formattedHour = 0;
    }
    
    // 格式化時間
    const formattedTime = `${formattedHour.toString().padStart(2, '0')}:${minute}`;
    
    // 創建行程數據
    const scheduleData = {
      time: formattedTime,
      title: title,
      description: description || null
    };
    
    // 呼叫保存方法並關閉模態框
    onSave(scheduleData);
    onClose();
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>新增行程</div>
        
        <div className={styles.timeSection}>
          <button 
            className={`${styles.periodButton} ${!isPM ? styles.active : ''}`}
            onClick={() => setIsPM(false)}
          >
            上午
          </button>
          <button 
            className={`${styles.periodButton} ${isPM ? styles.active : ''}`}
            onClick={() => setIsPM(true)}
          >
            下午
          </button>
        </div>
        
        <div className={styles.timeInputSection}>
          <input
            type="text"
            className={styles.timeInput}
            value={hour}
            onChange={handleHourChange}
            maxLength={2}
          />
          <span className={styles.timeSeparator}>:</span>
          <input
            type="text"
            className={styles.timeInput}
            value={minute}
            onChange={handleMinuteChange}
            maxLength={2}
          />
        </div>
        
        <input
          type="text"
          className={styles.titleInput}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="請輸入行程事項"
        />
        
        <textarea
          className={styles.descriptionInput}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="備註..."
          rows={4}
        />
        
        <div className={styles.buttonSection}>
          <button className={styles.cancelButton} onClick={onClose}>
            取消
          </button>
          <button 
            className={styles.saveButton} 
            onClick={handleSubmit}
            disabled={!title.trim() || !hour || !minute}
          >
            儲存
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddSchedule; 