import React, { useState, useEffect } from 'react';
import styles from '../styles/SymptomCalendar.module.css';

const SymptomCalendar = ({ abnormalPostsData = [], symptoms = [] }) => {
  const [selectedSymptomOption, setSelectedSymptomOption] = useState('');
  const [selectedSymptoms, setSelectedSymptoms] = useState([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [highlightedDates, setHighlightedDates] = useState(new Set());

  // 更新高亮日期
  useEffect(() => {
    if (!selectedSymptoms.length || !abnormalPostsData.length) {
      setHighlightedDates(new Set());
      return;
    }

    const matchingDates = new Set();
    const selectedSymptomTexts = selectedSymptoms.map(s => s.text);
    
    abnormalPostsData.forEach(post => {
      if (post.symptoms && Array.isArray(post.symptoms)) {
        const postSymptomNames = post.symptoms.map(symptom => 
          typeof symptom === 'string' ? symptom : symptom.symptom_name
        );
        
        let hasMatchingSymptoms;
        
        if (selectedSymptoms.length === 1) {
          // 單一症狀：只要包含該症狀即可
          hasMatchingSymptoms = postSymptomNames.some(symptomName => 
            selectedSymptomTexts.includes(symptomName)
          );
        } else {
          // 多個症狀：必須同時包含所有選中的症狀
          hasMatchingSymptoms = selectedSymptomTexts.every(selectedSymptom => 
            postSymptomNames.includes(selectedSymptom)
          );
        }
        
        if (hasMatchingSymptoms && post.record_date) {
          const postDate = new Date(post.record_date);
          const dateKey = `${postDate.getUTCFullYear()}-${String(postDate.getUTCMonth() + 1).padStart(2, '0')}-${String(postDate.getUTCDate()).padStart(2, '0')}`;
          matchingDates.add(dateKey);
        }
      }
    });

    setHighlightedDates(matchingDates);
  }, [selectedSymptoms, abnormalPostsData]);

  // 添加症狀按鈕處理
  const handleAddSymptom = () => {
    if (!selectedSymptomOption) return;
    
    // 檢查症狀是否已存在
    if (selectedSymptoms.some(symptom => symptom.text === selectedSymptomOption)) {
      return;
    }
    
    // 添加新症狀
    const newSymptom = {
      id: Date.now() + Math.random(),
      text: selectedSymptomOption
    };
    
    setSelectedSymptoms(prev => [...prev, newSymptom]);
    setSelectedSymptomOption('');
  };

  // 移除症狀
  const handleRemoveSymptom = (symptomId) => {
    setSelectedSymptoms(prev => prev.filter(s => s.id !== symptomId));
  };

  // 重置選擇
  const handleReset = () => {
    setSelectedSymptomOption('');
    setSelectedSymptoms([]);
    setHighlightedDates(new Set());
  };

  // 獲取月份的所有日期
  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];
    
    // 添加上個月的末尾日期（空白）
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    
    // 添加本月的日期
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(i);
    }
    
    return days;
  };

  // 檢查日期是否高亮
  const isDateHighlighted = (day) => {
    if (!day) return false;
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth() + 1;
    const dateKey = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return highlightedDates.has(dateKey);
  };

  // 導航到上個月
  const goToPreviousMonth = () => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  // 導航到下個月
  const goToNextMonth = () => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const formatMonthYear = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    return `${year}年${month}月`;
  };

  const days = getDaysInMonth(currentDate);
  const weekDays = ['日', '一', '二', '三', '四', '五', '六'];

  // 獲取唯一症狀列表
  const uniqueSymptoms = [...new Set(
    abnormalPostsData.flatMap(post => 
      (post.symptoms || []).map(symptom => 
        typeof symptom === 'string' ? symptom : symptom.symptom_name
      )
    ).filter(Boolean)
  )];

  return (
    <div className={styles.symptomCalendar}>
      <div className={styles.header}>
        <h3 className={styles.title}>症狀日曆</h3>
        <span className={styles.subtitle}>在這裡查看各症狀持續時間</span>
      </div>

      {/* 症狀篩選區域 */}
      <div className={styles.filterSection}>
        {/* 已選擇的症狀顯示 */}
        {selectedSymptoms.length > 0 && (
          <div className={styles.selectedSymptomsContainer}>
            {selectedSymptoms.map((symptom) => (
              <div key={symptom.id} className={styles.selectedSymptom}>
                <span className={styles.symptomText}>{symptom.text}</span>
                <button 
                  className={styles.removeSymptomBtn}
                  onClick={() => handleRemoveSymptom(symptom.id)}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
        
        <div className={styles.filterRow}>
          <select 
            className={styles.symptomSelect}
            value={selectedSymptomOption}
            onChange={(e) => setSelectedSymptomOption(e.target.value)}
          >
            <option value="">症狀</option>
            {uniqueSymptoms
              .filter(symptom => !selectedSymptoms.some(s => s.text === symptom))
              .map((symptom, index) => (
                <option key={index} value={symptom}>
                  {symptom}
                </option>
              ))
            }
          </select>
          <button 
            className={styles.addButton}
            onClick={handleAddSymptom}
            disabled={!selectedSymptomOption}
          >
            加入
          </button>
          <button 
            className={styles.resetButton}
            onClick={handleReset}
          >
            重設
          </button>
        </div>
      </div>

      {/* 日曆區域 */}
      <div className={styles.calendarContainer}>
        <div className={styles.calendarHeader}>
          <button 
            className={styles.navButton}
            onClick={goToPreviousMonth}
          >
            ◀
          </button>
          <span className={styles.monthYear}>
            {formatMonthYear(currentDate)}
          </span>
          <button 
            className={styles.navButton}
            onClick={goToNextMonth}
          >
            ▶
          </button>
        </div>

        <div className={styles.calendar}>
          <div className={styles.weekDays}>
            {weekDays.map(day => (
              <div key={day} className={styles.weekDay}>
                {day}
              </div>
            ))}
          </div>
          
          <div className={styles.daysGrid}>
            {days.map((day, index) => (
              <div
                key={index}
                className={`${styles.dayCell} ${
                  day ? styles.validDay : styles.emptyDay
                } ${
                  isDateHighlighted(day) ? styles.highlightedDay : ''
                }`}
              >
                {day}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SymptomCalendar;