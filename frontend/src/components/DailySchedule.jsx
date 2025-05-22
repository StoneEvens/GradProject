import React, { useState, useEffect } from 'react';
import styles from '../styles/DailySchedule.module.css';
import AddSchedule from './AddSchedule';
import { getUserSchedules, addUserSchedule, markScheduleAsCompleted, deleteSchedule } from '../services/scheduleService';

const DailySchedule = () => {
  const [schedules, setSchedules] = useState([]);
  const [isAddingSchedule, setIsAddingSchedule] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // 格式化時間顯示
  const formatTimeDisplay = (dateString) => {
    const date = new Date(dateString);
    const hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  // 格式化事件顯示
  const formatEvent = (schedule) => {
    return schedule.title;
  };

  // 獲取所有行程
  const fetchSchedules = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getUserSchedules();
      // 排序行程按時間先後順序
      const sortedSchedules = data.sort((a, b) => 
        new Date(a.date) - new Date(b.date)
      );
      setSchedules(sortedSchedules);
    } catch (err) {
      setError('無法獲取行程，請稍後再試');
      console.error('獲取行程失敗', err);
    } finally {
      setLoading(false);
    }
  };

  // 保存新的行程
  const handleSaveSchedule = async (scheduleData) => {
    setLoading(true);
    setError(null);
    try {
      await addUserSchedule(scheduleData);
      await fetchSchedules(); // 重新獲取行程
    } catch (err) {
      setError('新增行程失敗，請稍後再試');
      console.error('新增行程失敗', err);
    } finally {
      setLoading(false);
    }
  };

  // 標記行程為已完成
  const handleMarkCompleted = async (scheduleId) => {
    setLoading(true);
    setError(null);
    try {
      await markScheduleAsCompleted(scheduleId);
      await fetchSchedules(); // 重新獲取行程
    } catch (err) {
      setError('更新行程狀態失敗，請稍後再試');
      console.error('標記行程完成失敗', err);
    } finally {
      setLoading(false);
    }
  };

  // 刪除行程
  const handleDeleteSchedule = async (scheduleId) => {
    if (window.confirm('確定要刪除此行程嗎？')) {
      setLoading(true);
      setError(null);
      try {
        await deleteSchedule(scheduleId);
        await fetchSchedules(); // 重新獲取行程
      } catch (err) {
        setError('刪除行程失敗，請稍後再試');
        console.error('刪除行程失敗', err);
      } finally {
        setLoading(false);
      }
    }
  };

  // 組件載入時獲取行程
  useEffect(() => {
    fetchSchedules();
  }, []);

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>當日行程</h2>
      <div className={styles.scheduleList}>
        {loading && <div className={styles.message}>載入中...</div>}
        {error && <div className={styles.errorMessage}>{error}</div>}
        {!loading && !error && schedules.length === 0 && (
          <div className={styles.message}>今日暫無行程</div>
        )}
        {schedules.map((schedule) => (
          <div key={schedule.id} className={`${styles.scheduleItem} ${schedule.is_completed ? styles.completed : ''}`}>
            <div className={styles.scheduleContent}>
              <div className={styles.time}>{formatTimeDisplay(schedule.date)}</div>
              <div className={styles.event}>{formatEvent(schedule)}</div>
            </div>
            <div className={styles.scheduleActions}>
              {!schedule.is_completed && (
                <button 
                  className={styles.completeButton}
                  onClick={() => handleMarkCompleted(schedule.id)}
                  title="標記為已完成"
                >
                  ✓
                </button>
              )}
              <button 
                className={styles.deleteButton}
                onClick={() => handleDeleteSchedule(schedule.id)}
                title="刪除行程"
              >
                ×
              </button>
            </div>
          </div>
        ))}
      </div>
      <button className={styles.addButton} onClick={() => setIsAddingSchedule(true)}>
        新增行程
      </button>

      {isAddingSchedule && (
        <AddSchedule 
          onClose={() => setIsAddingSchedule(false)} 
          onSave={handleSaveSchedule}
        />
      )}
    </div>
  );
};

export default DailySchedule; 