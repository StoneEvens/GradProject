import React, { useState } from 'react';
import styles from '../styles/Calendar.module.css';

const Calendar = () => {
  const weekDays = ['日', '一', '二', '三', '四', '五', '六'];
  const [currentDate, setCurrentDate] = useState(new Date());
  const today = new Date();
  
  // 判斷是否為當前月份
  const isCurrentMonth = 
    currentDate.getMonth() === today.getMonth() && 
    currentDate.getFullYear() === today.getFullYear();

  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDay = firstDay.getDay();
    
    return { daysInMonth, startingDay };
  };

  const formatMonth = (date) => {
    return `${date.getFullYear()}年${date.getMonth() + 1}月`;
  };

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };
  
  const handleBackToToday = () => {
    setCurrentDate(new Date());
  };

  // 計算最小和最大可瀏覽日期（前後兩年）
  const minDate = new Date(today.getFullYear() - 2, 0, 1);
  const maxDate = new Date(today.getFullYear() + 2, 11, 31);
  
  // 檢查是否可以向前或向後導航
  const canNavigatePrev = currentDate > minDate;
  const canNavigateNext = currentDate < maxDate;

  const { daysInMonth, startingDay } = getDaysInMonth(currentDate);
  
  // 只生成當前月份的日期，不顯示上月和下月的日期
  const days = Array.from({ length: 42 }, (_, i) => {
    const dayNumber = i - startingDay + 1;
    if (dayNumber > 0 && dayNumber <= daysInMonth) {
      return dayNumber;
    }
    return 0;
  });

  return (
    <div className={styles.calendarContainer}>
      <div className={styles.header}>
        {canNavigatePrev && (
          <button className={styles.navButton} onClick={handlePrevMonth}>
            ◀
          </button>
        )}
        <span className={styles.monthDisplay}>{formatMonth(currentDate)}</span>
        {canNavigateNext && (
          <button className={styles.navButton} onClick={handleNextMonth}>
            ▶
          </button>
        )}
      </div>
      
      {!isCurrentMonth && (
        <button className={styles.todayButton} onClick={handleBackToToday}>
          回到今天
        </button>
      )}
      
      <div className={styles.calendar}>
        <div className={styles.weekdays}>
          {weekDays.map((day, index) => (
            <div key={index} className={styles.weekday}>
              {day}
            </div>
          ))}
        </div>
        <div className={styles.days}>
          {days.map((day, index) => (
            <div
              key={index}
              className={`${styles.day} ${day === 0 ? styles.empty : ''} ${
                day === today.getDate() &&
                currentDate.getMonth() === today.getMonth() &&
                currentDate.getFullYear() === today.getFullYear()
                  ? styles.today
                  : ''
              }`}
            >
              {day !== 0 && day}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Calendar; 