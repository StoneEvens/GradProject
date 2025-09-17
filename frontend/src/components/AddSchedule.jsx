import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import styles from '../styles/AddSchedule.module.css';
import { formatDate } from '../services/scheduleService';
import ConfirmNotification from './ConfirmNotification';

const AddSchedule = ({ onClose, onSave, initialData, onDelete, onMarkCompleted, selectedDate }) => {
  const { t } = useTranslation('main');
  // 是否為編輯模式
  const isEditMode = !!initialData;
  
  // 狀態設置
  const [title, setTitle] = useState(initialData?.title || '');
  const [showConfirmNotification, setShowConfirmNotification] = useState(false);
  const [description, setDescription] = useState(initialData?.description || '');
  
  // 日期相關狀態
  const [selectedScheduleDate, setSelectedScheduleDate] = useState(() => {
    if (initialData?.date) {
      return initialData.date;
    }
    if (selectedDate) {
      return formatDate(new Date(selectedDate));
    }
    return formatDate(new Date());
  });
  
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
    const date = new Date(selectedScheduleDate);
    if (date.toDateString() === new Date().toDateString()) return t('addSchedule.today');

    return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;
  };

  // 格式化日期為 input[type="date"] 格式
  const formatDateForInput = (dateStr) => {
    const date = new Date(dateStr);
    return date.getFullYear() + '-' + 
           String(date.getMonth() + 1).padStart(2, '0') + '-' + 
           String(date.getDate()).padStart(2, '0');
  };

  // 處理日期變更
  const handleDateChange = (e) => {
    const dateValue = e.target.value; // YYYY-MM-DD format
    setSelectedScheduleDate(formatDate(new Date(dateValue)));
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
      setTimeError(t('addSchedule.timeError'));
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
    
    // 添加選定的日期
    scheduleData.date = selectedScheduleDate;
    
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
    if (initialData.is_completed) return t('addSchedule.completed');
    return t('addSchedule.complete');
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
            {isEditMode ? t('addSchedule.editMode') : t('addSchedule.addMode')}
          </div>
          {isEditMode && (
            <div className={styles.headerButtons}>
              <button
                className={styles.deleteButton}
                onClick={handleDelete}
                title={t('addSchedule.deleteTitle')}
              >
                {t('addSchedule.delete')}
              </button>
              <button
                className={getStatusButtonClass()}
                onClick={handleStatusChange}
                disabled={initialData?.is_completed}
                title={initialData?.is_completed ? t('addSchedule.completed') : t('addSchedule.markCompletedTitle')}
              >
                {getStatusButtonText()}
              </button>
            </div>
          )}
        </div>
        
        <div className={styles.timeSection}>
          <div className={styles.timeLabel}>{t('addSchedule.date')}</div>
          <div className={styles.timeInputContainer}>
            <input
              type="date"
              className={styles.dateInput}
              value={formatDateForInput(selectedScheduleDate)}
              onChange={handleDateChange}
            />
          </div>
        </div>
        
        <div className={styles.timeSection}>
          <div className={styles.timeLabel}>{t('addSchedule.startTime')}</div>
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
          <div className={styles.timeLabel}>{t('addSchedule.endTime')}</div>
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
          placeholder={t('addSchedule.titlePlaceholder')}
        />
        
        <textarea
          className={styles.descriptionInput}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t('addSchedule.descriptionPlaceholder')}
          rows={4}
        />
        
        <div className={styles.buttonSection}>
          <button className={styles.cancelButton} onClick={onClose}>
            {t('addSchedule.cancel')}
          </button>
          <button
            className={styles.saveButton}
            onClick={handleSubmit}
            disabled={!title.trim() || !!timeError}
          >
            {t('addSchedule.save')}
          </button>
        </div>
      </div>
      
      {showConfirmNotification && (
        <ConfirmNotification 
          message={t('addSchedule.deleteConfirm')}
          onConfirm={handleConfirmDelete}
          onCancel={handleCancelDelete}
        />
      )}
    </div>
  );
};

export default AddSchedule; 