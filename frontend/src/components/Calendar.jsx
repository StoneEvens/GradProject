import React, { useState } from 'react';
import styles from '../styles/Calendar.module.css';
import { formatDate } from '../services/scheduleService';

const Calendar = ({ onDateSelect, selectedDate }) => {
  const weekDays = ['日', '一', '二', '三', '四', '五', '六'];
  const [currentDate, setCurrentDate] = useState(new Date());
  const today = new Date();
  
  // 判斷是否為當前月份
  const isCurrentMonth = 
    currentDate.getMonth() === today.getMonth() && 
    currentDate.getFullYear() === today.getFullYear();

  // 判斷選擇的日期是否是今天
  const isSelectedToday = selectedDate && 
    selectedDate.getDate() === today.getDate() && 
    selectedDate.getMonth() === today.getMonth() && 
    selectedDate.getFullYear() === today.getFullYear();

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
    if (onDateSelect) {
      onDateSelect(new Date());
    }
  };

  // 處理日期點擊
  const handleDayClick = (day) => {
    if (day === 0) return; // 不處理空白格
    
    const selectedDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    if (onDateSelect) {
      onDateSelect(selectedDate);
    }
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

  // 判斷日期是否為過去日期（相對於今天）
  const isPastDate = (day) => {
    if (day === 0) return false;
    const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    return date < new Date(today.getFullYear(), today.getMonth(), today.getDate());
  };
  
  // 判斷日期是否為未來日期（相對於今天）
  const isFutureDate = (day) => {
    if (day === 0) return false;
    const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    return date > new Date(today.getFullYear(), today.getMonth(), today.getDate());
  };

  // 判斷日期是否被選中
  const isSelectedDate = (day) => {
    if (!selectedDate || day === 0) return false;
    const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    return date.getDate() === selectedDate.getDate() && 
           date.getMonth() === selectedDate.getMonth() && 
           date.getFullYear() === selectedDate.getFullYear();
  };

  // 判斷是否為今天且沒有選擇其他日期
  const isTodayAndHighlighted = (day) => {
    if (day === 0) return false;
    const isToday = day === today.getDate() &&
                    currentDate.getMonth() === today.getMonth() &&
                    currentDate.getFullYear() === today.getFullYear();
    
    // 如果沒有選擇日期或選擇的就是今天，才高亮顯示今天
    return isToday && (!selectedDate || isSelectedDate(day));
  };

  // 判斷是否需要顯示回到今天按鈕
  const shouldShowTodayButton = (!isCurrentMonth || (selectedDate && !isSelectedToday));

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
      
      {shouldShowTodayButton && (
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
              className={`${styles.day} 
                ${day === 0 ? styles.empty : ''} 
                ${isTodayAndHighlighted(day) ? styles.today : ''}
                ${isPastDate(day) ? styles.pastDate : ''}
                ${isFutureDate(day) ? styles.futureDate : ''}
                ${isSelectedDate(day) ? styles.selectedDate : ''}
              `}
              onClick={() => handleDayClick(day)}
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