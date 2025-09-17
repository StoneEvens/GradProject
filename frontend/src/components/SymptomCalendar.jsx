import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useSymptomTranslation } from '../hooks/useSymptomTranslation';
import styles from '../styles/SymptomCalendar.module.css';

const SymptomCalendar = ({ abnormalPostsData = [], symptoms = [] }) => {
  const { t, i18n } = useTranslation('archives');
  const { translateSingleSymptom, formatSymptomsForDisplay } = useSymptomTranslation();
  const [selectedSymptomOption, setSelectedSymptomOption] = useState('');
  const [selectedSymptoms, setSelectedSymptoms] = useState([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [highlightedDates, setHighlightedDates] = useState(new Set());

  // Update highlighted dates
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
          // Single symptom: just need to contain that symptom
          hasMatchingSymptoms = postSymptomNames.some(symptomName => 
            selectedSymptomTexts.includes(symptomName)
          );
        } else {
          // Multiple symptoms: must contain all selected symptoms
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

  // Handle add symptom button
  const handleAddSymptom = () => {
    if (!selectedSymptomOption) return;
    
    // Check if symptom already exists
    if (selectedSymptoms.some(symptom => symptom.text === selectedSymptomOption)) {
      return;
    }
    
    // Add new symptom
    const newSymptom = {
      id: Date.now() + Math.random(),
      text: selectedSymptomOption
    };
    
    setSelectedSymptoms(prev => [...prev, newSymptom]);
    setSelectedSymptomOption('');
  };

  // Remove symptom
  const handleRemoveSymptom = (symptomId) => {
    setSelectedSymptoms(prev => prev.filter(s => s.id !== symptomId));
  };

  // Reset selection
  const handleReset = () => {
    setSelectedSymptomOption('');
    setSelectedSymptoms([]);
    setHighlightedDates(new Set());
  };

  // Get all dates in the month
  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];
    
    // Add end dates of previous month (blank)
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    
    // Add dates of current month
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(i);
    }
    
    return days;
  };

  // Check if date is highlighted
  const isDateHighlighted = (day) => {
    if (!day) return false;
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth() + 1;
    const dateKey = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return highlightedDates.has(dateKey);
  };

  // Navigate to previous month
  const goToPreviousMonth = () => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  // Navigate to next month
  const goToNextMonth = () => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const formatMonthYear = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;

    if (i18n.language === 'en') {
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                          'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return `${monthNames[date.getMonth()]} ${year}`;
    } else if (i18n.language === 'es') {
      const monthNames = ['ene', 'feb', 'mar', 'abr', 'may', 'jun',
                          'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
      return `${monthNames[date.getMonth()]} ${year}`;
    } else if (i18n.language === 'ja') {
      return `${year}年${month}月`;
    } else if (i18n.language === 'ko') {
      return `${year}년 ${month}월`;
    } else {
      // Default to Chinese
      return `${year}年${month}月`;
    }
  };

  const days = getDaysInMonth(currentDate);

  // Multi-language weekday names
  const getWeekDays = () => {
    if (i18n.language === 'en') {
      return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    } else if (i18n.language === 'es') {
      return ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    } else if (i18n.language === 'ja') {
      return ['日', '月', '火', '水', '木', '金', '土'];
    } else if (i18n.language === 'ko') {
      return ['일', '월', '화', '수', '목', '금', '토'];
    } else {
      // Default to Chinese
      return ['日', '一', '二', '三', '四', '五', '六'];
    }
  };

  const weekDays = getWeekDays();

  // Get unique symptoms list
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
        <h3 className={styles.title}>{t('symptomCalendar.title')}</h3>
        <span className={styles.subtitle}>{t('symptomCalendar.subtitle')}</span>
      </div>

      {/* Symptom filter section */}
      <div className={styles.filterSection}>
        {/* Selected symptoms display */}
        {selectedSymptoms.length > 0 && (
          <div className={styles.selectedSymptomsContainer}>
            {selectedSymptoms.map((symptom) => (
              <div key={symptom.id} className={styles.selectedSymptom}>
                <span className={styles.symptomText}>{translateSingleSymptom(symptom.text)}</span>
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
            <option value="">{t('symptomCalendar.selectSymptom')}</option>
            {uniqueSymptoms
              .filter(symptom => !selectedSymptoms.some(s => s.text === symptom))
              .map((symptom, index) => (
                <option key={index} value={symptom}>
                  {translateSingleSymptom(symptom)}
                </option>
              ))
            }
          </select>
          <button 
            className={styles.addButton}
            onClick={handleAddSymptom}
            disabled={!selectedSymptomOption}
          >
{t('symptomCalendar.add')}
          </button>
          <button 
            className={styles.resetButton}
            onClick={handleReset}
          >
{t('symptomCalendar.reset')}
          </button>
        </div>
      </div>

      {/* Calendar section */}
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