import React, { useState, useEffect } from 'react';
import styles from '../styles/DatePicker.module.css';

const DatePicker = ({ isOpen, onClose, selectedDate, onDateSelect }) => {
  const today = new Date();
  const [selectedYear, setSelectedYear] = useState(selectedDate ? selectedDate.getFullYear() : today.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(selectedDate ? selectedDate.getMonth() + 1 : today.getMonth() + 1);
  const [selectedDay, setSelectedDay] = useState(selectedDate ? selectedDate.getDate() : today.getDate());
  
  // 生成年份選項（當前年份往前5年）
  const generateYears = () => {
    const years = [];
    const currentYear = today.getFullYear();
    for (let year = currentYear - 5; year <= currentYear; year++) {
      years.push(year);
    }
    return years;
  };

  // 生成月份選項（只顯示到今天的月份，如果是當年的話）
  const generateMonths = () => {
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1;
    
    if (selectedYear === currentYear) {
      return Array.from({ length: currentMonth }, (_, i) => i + 1);
    } else {
      return Array.from({ length: 12 }, (_, i) => i + 1);
    }
  };

  // 生成日期選項（根據選擇的年月，只顯示到今天）
  const generateDays = () => {
    const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1;
    const currentDay = today.getDate();
    
    if (selectedYear === currentYear && selectedMonth === currentMonth) {
      return Array.from({ length: currentDay }, (_, i) => i + 1);
    } else {
      return Array.from({ length: daysInMonth }, (_, i) => i + 1);
    }
  };

  // 格式化完整日期顯示
  const formatSelectedDate = () => {
    const date = new Date(selectedYear, selectedMonth - 1, selectedDay);
    const weekDays = ['日', '一', '二', '三', '四', '五', '六'];
    const weekDay = weekDays[date.getDay()];
    return `${selectedYear}/${String(selectedMonth).padStart(2, '0')}/${String(selectedDay).padStart(2, '0')} (${weekDay})`;
  };

  // 確認選擇
  const handleConfirm = () => {
    const newDate = new Date(selectedYear, selectedMonth - 1, selectedDay);
    onDateSelect(newDate);
    onClose();
  };

  // 取消選擇
  const handleCancel = () => {
    onClose();
  };

  // 當組件打開時更新選中的值
  useEffect(() => {
    if (isOpen && selectedDate) {
      setSelectedYear(selectedDate.getFullYear());
      setSelectedMonth(selectedDate.getMonth() + 1);
      setSelectedDay(selectedDate.getDate());
    }
  }, [isOpen, selectedDate]);

  // 當年份或月份改變時，確保日期有效且不超過今天
  useEffect(() => {
    const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1;
    const currentDay = today.getDate();
    
    let maxDay = daysInMonth;
    if (selectedYear === currentYear && selectedMonth === currentMonth) {
      maxDay = currentDay;
    }
    
    if (selectedDay > maxDay) {
      setSelectedDay(maxDay);
    }
  }, [selectedYear, selectedMonth]);

  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      {/* 日曆彈窗 */}
      <div className={styles.modalContainer} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h3 className={styles.title}>選擇日期</h3>
        </div>

        <div className={styles.selectorContainer}>
          {/* 日期選擇器 */}
          <div className={styles.dateSelectors}>
            {/* 年份選擇 */}
            <div className={styles.selectorGroup}>
              <label className={styles.selectorLabel}>年份</label>
              <select
                className={styles.selector}
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              >
                {generateYears().map(year => (
                  <option key={year} value={year}>{year}年</option>
                ))}
              </select>
            </div>

            {/* 月份選擇 */}
            <div className={styles.selectorGroup}>
              <label className={styles.selectorLabel}>月份</label>
              <select
                className={styles.selector}
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
              >
                {generateMonths().map(month => (
                  <option key={month} value={month}>{month}月</option>
                ))}
              </select>
            </div>

            {/* 日期選擇 */}
            <div className={styles.selectorGroup}>
              <label className={styles.selectorLabel}>日期</label>
              <select
                className={styles.selector}
                value={selectedDay}
                onChange={(e) => setSelectedDay(parseInt(e.target.value))}
              >
                {generateDays().map(day => (
                  <option key={day} value={day}>{day}日</option>
                ))}
              </select>
            </div>
          </div>

          {/* 選中日期預覽 */}
          <div className={styles.selectedDateDisplay}>
            選中日期: {formatSelectedDate()}
          </div>
        </div>

        {/* 操作按鈕 */}
        <div className={styles.footer}>
          <button className={styles.cancelButton} onClick={handleCancel}>
            取消
          </button>
          <button className={styles.confirmButton} onClick={handleConfirm}>
            確認
          </button>
        </div>
      </div>
    </div>
  );
};

export default DatePicker;