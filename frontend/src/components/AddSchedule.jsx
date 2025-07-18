import React, { useState, useEffect, useRef } from 'react';
import styles from '../styles/AddSchedule.module.css';
import { formatDate } from '../services/scheduleService';
import ConfirmNotification from './ConfirmNotification';

const AddSchedule = ({ onClose, onSave, initialData, onDelete, onMarkCompleted, selectedDate }) => {
  // 是否為編輯模式
  const isEditMode = !!initialData;
  
  // 狀態設置
  const [title, setTitle] = useState(initialData?.title || '');
  const [showConfirmNotification, setShowConfirmNotification] = useState(false);
  const [description, setDescription] = useState(initialData?.description || '');
  
  // 開始時間相關狀態
  const [startHour, setStartHour] = useState(initialData?.start_time ? initialData.start_time.split(':')[0] : '08');
  const [startMinute, setStartMinute] = useState(initialData?.start_time ? initialData.start_time.split(':')[1] : '00');
  
  // 結束時間相關狀態
  const [endHour, setEndHour] = useState(initialData?.end_time ? initialData.end_time.split(':')[0] : '09');
  const [endMinute, setEndMinute] = useState(initialData?.end_time ? initialData.end_time.split(':')[1] : '00');
  
  // 時間錯誤提示
  const [timeError, setTimeError] = useState('');
  
  // 時間選擇器是否展開的狀態
  const [isStartHourOpen, setIsStartHourOpen] = useState(false);
  const [isStartMinuteOpen, setIsStartMinuteOpen] = useState(false);
  const [isEndHourOpen, setIsEndHourOpen] = useState(false);
  const [isEndMinuteOpen, setIsEndMinuteOpen] = useState(false);
  
  // 選擇器參考
  const startHourRef = useRef(null);
  const startMinuteRef = useRef(null);
  const endHourRef = useRef(null);
  const endMinuteRef = useRef(null);
  
  // 生成小時和分鐘選項
  const hours = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));
  const minutes = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0'));

  // 取得日期標題
  const getDateTitle = () => {
    if (!selectedDate) return '今日';
    
    const date = new Date(selectedDate);
    if (date.toDateString() === new Date().toDateString()) return '今日';
    
    return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;
  };

  // 處理點擊外部關閉選擇器
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (startHourRef.current && !startHourRef.current.contains(event.target)) {
        setIsStartHourOpen(false);
      }
      if (startMinuteRef.current && !startMinuteRef.current.contains(event.target)) {
        setIsStartMinuteOpen(false);
      }
      if (endHourRef.current && !endHourRef.current.contains(event.target)) {
        setIsEndHourOpen(false);
      }
      if (endMinuteRef.current && !endMinuteRef.current.contains(event.target)) {
        setIsEndMinuteOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // 檢查時間是否合理（結束時間應該晚於開始時間）
  useEffect(() => {
    const startTimeValue = parseInt(startHour) * 60 + parseInt(startMinute);
    const endTimeValue = parseInt(endHour) * 60 + parseInt(endMinute);
    
    if (endTimeValue <= startTimeValue) {
      setTimeError('結束時間必須晚於開始時間');
    } else {
      setTimeError('');
    }
  }, [startHour, startMinute, endHour, endMinute]);

  // 處理提交
  const handleSubmit = () => {
    // 檢查時間是否合理
    if (timeError) {
      return; // 如果有時間錯誤，不允許提交
    }
    
    // 創建行程數據
    const scheduleData = {
      title,
      description,
      startTime: `${startHour}:${startMinute}`,
      endTime: `${endHour}:${endMinute}`
    };
    
    // 如果有選定日期，添加到數據中
    if (selectedDate) {
      scheduleData.date = formatDate(new Date(selectedDate));
    }
    
    // 呼叫保存方法並關閉模態框
    onSave(scheduleData, initialData?.id);
    onClose();
  };

  // 選擇時間
  const selectTime = (type, value) => {
    if (type === 'startHour') {
      setStartHour(value);
      setIsStartHourOpen(false);
    } else if (type === 'startMinute') {
      setStartMinute(value);
      setIsStartMinuteOpen(false);
    } else if (type === 'endHour') {
      setEndHour(value);
      setIsEndHourOpen(false);
    } else if (type === 'endMinute') {
      setEndMinute(value);
      setIsEndMinuteOpen(false);
    }
  };

  // 處理刪除
  const handleDelete = () => {
    setShowConfirmNotification(true);
  };

  // 確認刪除
  const handleConfirmDelete = () => {
    onDelete(initialData.id);
    onClose();
    setShowConfirmNotification(false);
  };

  // 取消刪除
  const handleCancelDelete = () => {
    setShowConfirmNotification(false);
  };

  // 處理完成狀態
  const handleStatusChange = () => {
    if (initialData.is_completed) {
      return; // 已完成狀態不可點擊
    } else {
      onMarkCompleted(initialData.id);
      onClose();
    }
  };

  // 獲取狀態按鈕文字
  const getStatusButtonText = () => {
    if (!initialData) return null;
    if (initialData.is_completed) return '已完成';
    return '完成';
  };

  // 獲取狀態按鈕樣式
  const getStatusButtonClass = () => {
    if (!initialData) return '';
    if (initialData.is_completed) return styles.statusButton;
    return styles.completeButton;
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.headerSection}>
          <div className={styles.headerTitle}>
            {isEditMode ? '修改行程' : '新增行程'} 
            <span className={styles.dateLabel}>({getDateTitle()})</span>
          </div>
          {isEditMode && (
            <div className={styles.headerButtons}>
              <button 
                className={styles.deleteButton}
                onClick={handleDelete}
                title="刪除行程"
              >
                刪除
              </button>
              <button 
                className={getStatusButtonClass()}
                onClick={handleStatusChange}
                disabled={initialData?.is_completed}
                title={initialData?.is_completed ? '已完成' : '標記為已完成'}
              >
                {getStatusButtonText()}
              </button>
            </div>
          )}
        </div>
        
        <div className={styles.timeSection}>
          <div className={styles.timeLabel}>開始</div>
          <div className={styles.timeInputContainer}>
            <div className={styles.timeInput} ref={startHourRef}>
              <div 
                className={styles.timeValue} 
                onClick={() => setIsStartHourOpen(!isStartHourOpen)}
              >
                {startHour}
              </div>
              {isStartHourOpen && (
                <div className={styles.timeDropdown}>
                  {hours.map((hour) => (
                    <div 
                      key={`start-hour-${hour}`}
                      className={`${styles.timeOption} ${startHour === hour ? styles.selected : ''}`}
                      onClick={() => selectTime('startHour', hour)}
                    >
                      {hour}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className={styles.timeSeparator}>:</div>
            <div className={styles.timeInput} ref={startMinuteRef}>
              <div 
                className={styles.timeValue} 
                onClick={() => setIsStartMinuteOpen(!isStartMinuteOpen)}
              >
                {startMinute}
              </div>
              {isStartMinuteOpen && (
                <div className={styles.timeDropdown}>
                  {minutes.map((minute) => (
                    <div 
                      key={`start-minute-${minute}`}
                      className={`${styles.timeOption} ${startMinute === minute ? styles.selected : ''}`}
                      onClick={() => selectTime('startMinute', minute)}
                    >
                      {minute}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
        
        <div className={styles.timeSection}>
          <div className={styles.timeLabel}>結束</div>
          <div className={styles.timeInputContainer}>
            <div className={styles.timeInput} ref={endHourRef}>
              <div 
                className={styles.timeValue} 
                onClick={() => setIsEndHourOpen(!isEndHourOpen)}
              >
                {endHour}
              </div>
              {isEndHourOpen && (
                <div className={styles.timeDropdown}>
                  {hours.map((hour) => (
                    <div 
                      key={`end-hour-${hour}`}
                      className={`${styles.timeOption} ${endHour === hour ? styles.selected : ''}`}
                      onClick={() => selectTime('endHour', hour)}
                    >
                      {hour}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className={styles.timeSeparator}>:</div>
            <div className={styles.timeInput} ref={endMinuteRef}>
              <div 
                className={styles.timeValue} 
                onClick={() => setIsEndMinuteOpen(!isEndMinuteOpen)}
              >
                {endMinute}
              </div>
              {isEndMinuteOpen && (
                <div className={styles.timeDropdown}>
                  {minutes.map((minute) => (
                    <div 
                      key={`end-minute-${minute}`}
                      className={`${styles.timeOption} ${endMinute === minute ? styles.selected : ''}`}
                      onClick={() => selectTime('endMinute', minute)}
                    >
                      {minute}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
        
        {timeError && <div className={styles.errorMessage}>{timeError}</div>}
        
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
            disabled={!title.trim() || !!timeError}
          >
            儲存
          </button>
        </div>
      </div>
      
      {showConfirmNotification && (
        <ConfirmNotification 
          message="確定要刪除此行程嗎？"
          onConfirm={handleConfirmDelete}
          onCancel={handleCancelDelete}
        />
      )}
    </div>
  );
};

export default AddSchedule; 