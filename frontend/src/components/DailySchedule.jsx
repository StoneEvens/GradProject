import React, { useState, useEffect } from 'react';
import styles from '../styles/DailySchedule.module.css';
import AddSchedule from './AddSchedule';
import { 
  getUserSchedules, 
  getUserSchedulesByDate,
  addUserSchedule, 
  updateSchedule, 
  markScheduleAsCompleted, 
  deleteSchedule,
  formatDate
} from '../services/scheduleService';
import Notification from './Notification';

const DailySchedule = ({ selectedDate, onAddSchedule }) => {
  const [schedules, setSchedules] = useState([]);
  const [isAddingSchedule, setIsAddingSchedule] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [notification, setNotification] = useState('');
  
  // 當前是否為今天
  const isToday = selectedDate ? 
    new Date(selectedDate).toDateString() === new Date().toDateString() : 
    true;

  // 格式化日期顯示
  const getDateDisplay = () => {
    if (!selectedDate) return '今日行程';
    
    const date = new Date(selectedDate);
    if (isToday) return '今日行程';
    
    // 格式化為 DD/MM/YY 行程
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = String(date.getFullYear()).slice(-2);
    return `${day}/${month}/${year} 行程`;
  };

  // 檢查是否為過去日期
  const isPastDate = () => {
    if (!selectedDate) return false;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const compareDate = new Date(selectedDate);
    compareDate.setHours(0, 0, 0, 0);
    
    return compareDate < today;
  };

  // 格式化時間顯示
  const formatTimeDisplay = (timeString) => {
    const [hours, minutes] = timeString.split(':');
    return `${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}`;
  };

  // 格式化事件顯示
  const formatEvent = (schedule) => {
    return schedule.title;
  };

  // 檢查是否已超過排定時間
  const isOverdue = (schedule) => {
    const now = new Date();
    const [hours, minutes] = schedule.end_time.split(':').map(Number);
    const scheduleEndTime = new Date();
    scheduleEndTime.setHours(hours, minutes, 0, 0);
    
    return !schedule.is_completed && now > scheduleEndTime;
  };

  // 獲取行程項目的狀態類別
  const getScheduleStatusClass = (schedule) => {
    if (schedule.is_completed) {
      return styles.statusCompleted; // 已完成
    } else if (isOverdue(schedule)) {
      return styles.statusOverdue; // 超過時間且未完成
    } else {
      return styles.statusPending; // 未超過時間且未完成
    }
  };

  // 顯示通知
  const showNotification = (message) => {
    setNotification(message);
    // 自動關閉通知
    setTimeout(() => {
      setNotification('');
    }, 3000);
  };
  
  // 隱藏通知
  const hideNotification = () => {
    setNotification('');
  };

  // 獲取所有行程
  const fetchSchedules = async () => {
    setLoading(true);
    setError(null);
    try {
      let data;
      
      if (!selectedDate || isToday) {
        // 獲取今天的行程
        data = await getUserSchedules();
      } else {
        // 獲取選定日期的行程
        data = await getUserSchedulesByDate(selectedDate);
      }
      
      const sortedSchedules = data.sort((a, b) => {
        if (a.is_completed !== b.is_completed) {
          return a.is_completed ? 1 : -1;
        }
        const aTime = `${a.date} ${a.start_time}`;
        const bTime = `${b.date} ${b.start_time}`;
        return new Date(aTime) - new Date(bTime);
      });
      setSchedules(sortedSchedules);
    } catch (err) {
      setError('無法獲取行程，請稍後再試');
      console.error('獲取行程失敗', err);
    } finally {
      setLoading(false);
    }
  };

  // 保存新的行程
  const handleSaveSchedule = async (scheduleData, scheduleId) => {
    setLoading(true);
    setError(null);
    try {
      // 如果是選定日期，將其添加到行程數據中
      if (selectedDate) {
        scheduleData.date = formatDate(new Date(selectedDate));
      }
      
      if (scheduleId) {
        await updateSchedule(scheduleId, scheduleData);
      } else {
        await addUserSchedule(scheduleData);
      }
      await fetchSchedules();
      if (onAddSchedule) {
        onAddSchedule();
      }
    } catch (err) {
      setError(scheduleId ? '更新行程失敗，請稍後再試' : '新增行程失敗，請稍後再試');
      console.error(scheduleId ? '更新行程失敗' : '新增行程失敗', err);
    } finally {
      setLoading(false);
      setEditingSchedule(null);
    }
  };

  // 編輯行程
  const handleEditSchedule = (schedule) => {
    setEditingSchedule(schedule);
  };

  // 標記行程為已完成
  const handleMarkCompleted = async (scheduleId) => {
    setLoading(true);
    setError(null);
    try {
      await markScheduleAsCompleted(scheduleId);
      await fetchSchedules();
    } catch (err) {
      setError('標記行程完成失敗，請稍後再試');
      console.error('標記行程完成失敗', err);
    } finally {
      setLoading(false);
    }
  };

  // 刪除行程
  const handleDeleteSchedule = async (scheduleId) => {
    setLoading(true);
    setError(null);
    try {
      await deleteSchedule(scheduleId);
      await fetchSchedules();
      showNotification('行程已刪除');
    } catch (err) {
      setError('刪除行程失敗，請稍後再試');
      console.error('刪除行程失敗', err);
    } finally {
      setLoading(false);
    }
  };

  // 組件載入時或選定日期變更時獲取行程
  useEffect(() => {
    fetchSchedules();
  }, [selectedDate]);

  // 關閉模態框
  const handleCloseModal = () => {
    setIsAddingSchedule(false);
    setEditingSchedule(null);
  };

  return (
    <div className={styles.container}>
      {notification && (
        <Notification 
          message={notification} 
          onClose={hideNotification} 
        />
      )}
      <h2 className={styles.title}>{getDateDisplay()}</h2>
      <div className={styles.scheduleList}>
        {loading && <div className={styles.message}>載入中...</div>}
        {error && <div className={styles.errorMessage}>{error}</div>}
        {!loading && !error && schedules.length === 0 && (
          <div className={styles.message}>
            {isToday ? '今日暫無行程' : '所選日期暫無行程'}
          </div>
        )}
        {schedules.map((schedule) => (
          <div 
            key={schedule.id} 
            className={styles.scheduleItem}
            onClick={() => handleEditSchedule(schedule)}
          >
            <div className={`${styles.scheduleHeader} ${getScheduleStatusClass(schedule)}`}>
              <div className={styles.timeDisplay}>
                {formatTimeDisplay(schedule.start_time)}-{formatTimeDisplay(schedule.end_time)}
              </div>
            </div>
            <div className={styles.scheduleContent}>
              {formatEvent(schedule)}
            </div>
          </div>
        ))}
      </div>
      
      <button 
        className={styles.addButton} 
        onClick={() => setIsAddingSchedule(true)}
        disabled={isPastDate()}
      >
        新增行程
      </button>

      {(isAddingSchedule || editingSchedule) && (
        <AddSchedule 
          onClose={handleCloseModal} 
          onSave={handleSaveSchedule}
          onDelete={handleDeleteSchedule}
          onMarkCompleted={handleMarkCompleted}
          initialData={editingSchedule}
          selectedDate={selectedDate}
        />
      )}
    </div>
  );
};

export default DailySchedule; 