import React, { useState } from 'react';
import DatePicker from './DatePicker';
import styles from '../styles/AbnormalPostFilter.module.css';

const AbnormalPostFilter = ({ onFilterChange, symptoms = [] }) => {
  const [filterType, setFilterType] = useState('symptom'); // 'symptom', 'date', 'both'
  const [selectedSymptomOption, setSelectedSymptomOption] = useState('');
  const [selectedSymptoms, setSelectedSymptoms] = useState([]);
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);

  // 格式化日期顯示
  const formatDate = (date) => {
    if (!date) return '';
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${year} 年 ${month} 月 ${day} 日`;
  };

  // 重置篩選條件
  const handleReset = () => {
    setSelectedSymptomOption('');
    setSelectedSymptoms([]);
    setStartDate(null);
    setEndDate(null);
    // 重置後立即通知父組件
    onFilterChange({
      type: 'all',
      symptoms: [],
      startDate: null,
      endDate: null
    });
  };

  // 執行篩選
  const handleFilter = () => {
    const filters = {
      type: filterType,
      symptoms: (filterType === 'symptom' || filterType === 'both') ? selectedSymptoms : [],
      startDate: (filterType === 'date' || filterType === 'both') ? startDate : null,
      endDate: (filterType === 'date' || filterType === 'both') ? endDate : null
    };
    onFilterChange(filters);
  };

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
    
    const newSymptoms = [...selectedSymptoms, newSymptom];
    setSelectedSymptoms(newSymptoms);
    setSelectedSymptomOption('');
    
    // 立即觸發篩選
    const filters = {
      type: filterType,
      symptoms: (filterType === 'symptom' || filterType === 'both') ? newSymptoms : [],
      startDate: (filterType === 'date' || filterType === 'both') ? startDate : null,
      endDate: (filterType === 'date' || filterType === 'both') ? endDate : null
    };
    onFilterChange(filters);
  };

  // 移除症狀
  const handleRemoveSymptom = (symptomId) => {
    const newSymptoms = selectedSymptoms.filter(s => s.id !== symptomId);
    setSelectedSymptoms(newSymptoms);
    
    // 立即觸發篩選
    const filters = {
      type: filterType,
      symptoms: (filterType === 'symptom' || filterType === 'both') ? newSymptoms : [],
      startDate: (filterType === 'date' || filterType === 'both') ? startDate : null,
      endDate: (filterType === 'date' || filterType === 'both') ? endDate : null
    };
    onFilterChange(filters);
  };

  return (
    <div className={styles.filterContainer}>
      {/* 篩選類型選擇 */}
      <div className={styles.filterTypeRow}>
        <span className={styles.filterLabel}>依</span>
        <select 
          value={filterType} 
          onChange={(e) => setFilterType(e.target.value)}
          className={styles.filterTypeSelect}
        >
          <option value="symptom">症狀</option>
          <option value="date">日期</option>
          <option value="both">症狀 + 日期</option>
        </select>
        <span className={styles.filterLabel}>篩選</span>
      </div>

      {/* 症狀篩選區域 */}
      {(filterType === 'symptom' || filterType === 'both') && (
        <div className={styles.symptomFilterSection}>
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
                    X
                  </button>
                </div>
              ))}
            </div>
          )}
          
          <div className={styles.symptomSelectRow}>
            <select 
              value={selectedSymptomOption} 
              onChange={(e) => setSelectedSymptomOption(e.target.value)}
              className={styles.symptomSelect}
            >
              <option value="">選擇</option>
              {symptoms
                .filter(symptom => !selectedSymptoms.some(s => s.text === symptom))
                .map((symptom, index) => (
                  <option key={index} value={symptom}>{symptom}</option>
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
          </div>
        </div>
      )}

      {/* 日期篩選區域 */}
      {(filterType === 'date' || filterType === 'both') && (
        <div className={styles.dateFilterSection}>
          <div className={styles.dateRangeRow}>
            <button 
              className={styles.dateInput}
              onClick={() => setShowStartDatePicker(true)}
            >
              {formatDate(startDate) || '2025 年 1 月 1 日'}
            </button>
            <span className={styles.dateSeparator}>-</span>
            <button 
              className={styles.dateInput}
              onClick={() => setShowEndDatePicker(true)}
            >
              {formatDate(endDate) || '2025 年 1 月 22 日'}
            </button>
          </div>
        </div>
      )}

      {/* 操作按鈕 */}
      <div className={styles.actionButtons}>
        <button className={styles.resetButton} onClick={handleReset}>
          重置
        </button>
        <button className={styles.filterButton} onClick={handleFilter}>
          篩選
        </button>
      </div>

      {/* 日期選擇器 */}
      <DatePicker
        isOpen={showStartDatePicker}
        onClose={() => setShowStartDatePicker(false)}
        selectedDate={startDate}
        onDateSelect={(date) => {
          setStartDate(date);
          setShowStartDatePicker(false);
        }}
      />
      
      <DatePicker
        isOpen={showEndDatePicker}
        onClose={() => setShowEndDatePicker(false)}
        selectedDate={endDate}
        onDateSelect={(date) => {
          setEndDate(date);
          setShowEndDatePicker(false);
        }}
        minDate={startDate}
      />
    </div>
  );
};

export default AbnormalPostFilter;