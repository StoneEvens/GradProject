import React, { useState, useEffect } from 'react';
import styles from '../styles/DayDisplay.module.css';
import { getUserSchedules } from '../services/scheduleService';

const DayDisplay = ({ toggleView }) => {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const weekDays = ['日', '一', '二', '三', '四', '五', '六'];
  
  const formatDate = (date) => {
    return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')} (${weekDays[date.getDay()]})`;
  };

  // 獲取當前週的起始日和結束日
  const startOfWeek = new Date(selectedDate);
  startOfWeek.setDate(selectedDate.getDate() - selectedDate.getDay());
  
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  
  // 產生當前週的所有日期
  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(startOfWeek);
    date.setDate(startOfWeek.getDate() + i);
    return date;
  });

  // 檢查兩個日期是否為同一天
  const isSameDay = (date1, date2) => {
    return date1.getDate() === date2.getDate() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getFullYear() === date2.getFullYear();
  };

  // 選擇日期
  const handleSelectDay = (date) => {
    setSelectedDate(date);
  };

  // 獲取行程
  const fetchSchedules = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getUserSchedules();
      // 只保留選定日期的行程
      const filteredSchedules = data.filter(schedule => {
        const scheduleDate = new Date(schedule.date);
        return isSameDay(scheduleDate, selectedDate);
      });
      
      // 按時間排序
      const sortedSchedules = filteredSchedules.sort((a, b) => 
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

  // 格式化時間顯示
  const formatTimeDisplay = (dateString) => {
    const date = new Date(dateString);
    const hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  // 當選定日期變更時，重新獲取行程
  useEffect(() => {
    fetchSchedules();
  }, [selectedDate]);

  // 前一週按鈕
  const goToPreviousWeek = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(selectedDate.getDate() - 7);
    setSelectedDate(newDate);
  };

  // 下一週按鈕
  const goToNextWeek = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(selectedDate.getDate() + 7);
    setSelectedDate(newDate);
  };

  // 今天按鈕
  const goToToday = () => {
    setSelectedDate(new Date());
  };

  const isToday = (date) => {
    const today = new Date();
    return isSameDay(date, today);
  };

  return (
    <div className={styles.container}>
      <div className={styles.dateDisplay} onClick={toggleView}>
        {formatDate(selectedDate)}
      </div>

      <div className={styles.weekNavigation}>
        <button className={styles.navButton} onClick={goToPreviousWeek}>◀ 上週</button>
        <button className={styles.todayButton} onClick={goToToday}>今天</button>
        <button className={styles.navButton} onClick={goToNextWeek}>下週 ▶</button>
      </div>
      
      <div className={styles.weekGrid}>
        {weekDates.map((date, index) => (
          <div 
            key={index}
            className={`${styles.dayCell} ${
              isSameDay(date, selectedDate) ? styles.selected : ''
            } ${
              isToday(date) ? styles.today : ''
            }`}
            onClick={() => handleSelectDay(date)}
          >
            <div className={styles.weekday}>{weekDays[index]}</div>
            <div className={styles.date}>{date.getDate()}</div>
          </div>
        ))}
      </div>

      <div className={styles.scheduleSection}>
        <h3 className={styles.scheduleTitle}>{formatDate(selectedDate)} 行程</h3>
        <div className={styles.scheduleList}>
          {loading && <div className={styles.message}>載入中...</div>}
          {error && <div className={styles.errorMessage}>{error}</div>}
          {!loading && !error && schedules.length === 0 && (
            <div className={styles.message}>當日暫無行程</div>
          )}
          {schedules.map((schedule) => (
            <div 
              key={schedule.id} 
              className={`${styles.scheduleItem} ${schedule.is_completed ? styles.completed : ''}`}
            >
              <div className={styles.scheduleTime}>
                {formatTimeDisplay(schedule.date)}
              </div>
              <div className={styles.scheduleContent}>
                <div className={styles.scheduleTitle}>{schedule.title}</div>
                {schedule.description && (
                  <div className={styles.scheduleDescription}>
                    {schedule.description}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default DayDisplay; 