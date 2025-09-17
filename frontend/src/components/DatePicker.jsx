import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import styles from '../styles/DatePicker.module.css';

const DatePicker = ({ isOpen, onClose, selectedDate, onDateSelect }) => {
  const { t, i18n } = useTranslation('posts');
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
    const weekDays = t('datePicker.weekDays', { returnObjects: true });
    const weekDay = weekDays[date.getDay()];

    // Use abbreviated month name for English
    let monthDisplay = String(selectedMonth).padStart(2, '0');
    if (i18n.language === 'en') {
      const monthNames = t('datePicker.monthNames', { returnObjects: true });
      monthDisplay = monthNames[selectedMonth - 1];
    }

    return t('datePicker.dateFormat', {
      year: selectedYear,
      month: monthDisplay,
      day: String(selectedDay).padStart(2, '0'),
      weekDay: weekDay
    });
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
          <h3 className={styles.title}>{t('datePicker.title')}</h3>
        </div>

        <div className={styles.selectorContainer}>
          {/* 日期選擇器 */}
          <div className={styles.dateSelectors}>
            {/* 年份選擇 */}
            <div className={styles.selectorGroup}>
              <label className={styles.selectorLabel}>{t('datePicker.yearLabel')}</label>
              <select
                className={styles.selector}
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              >
                {generateYears().map(year => (
                  <option key={year} value={year}>{t('datePicker.yearOption', { year })}</option>
                ))}
              </select>
            </div>

            {/* 月份選擇 */}
            <div className={styles.selectorGroup}>
              <label className={styles.selectorLabel}>{t('datePicker.monthLabel')}</label>
              <select
                className={styles.selector}
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
              >
                {generateMonths().map(month => {
                  // Use abbreviated month names for English
                  if (i18n.language === 'en') {
                    const monthNames = t('datePicker.monthNames', { returnObjects: true });
                    return (
                      <option key={month} value={month}>
                        {monthNames[month - 1]}
                      </option>
                    );
                  } else {
                    return (
                      <option key={month} value={month}>
                        {t('datePicker.monthOption', { month })}
                      </option>
                    );
                  }
                })}
              </select>
            </div>

            {/* 日期選擇 */}
            <div className={styles.selectorGroup}>
              <label className={styles.selectorLabel}>{t('datePicker.dayLabel')}</label>
              <select
                className={styles.selector}
                value={selectedDay}
                onChange={(e) => setSelectedDay(parseInt(e.target.value))}
              >
                {generateDays().map(day => (
                  <option key={day} value={day}>{t('datePicker.dayOption', { day })}</option>
                ))}
              </select>
            </div>
          </div>

          {/* 選中日期預覽 */}
          <div className={styles.selectedDateDisplay}>
            {t('datePicker.selectedDateLabel')}: {formatSelectedDate()}
          </div>
        </div>

        {/* 操作按鈕 */}
        <div className={styles.footer}>
          <button className={styles.cancelButton} onClick={handleCancel}>
            {t('common.cancel')}
          </button>
          <button className={styles.confirmButton} onClick={handleConfirm}>
            {t('common.confirm')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DatePicker;