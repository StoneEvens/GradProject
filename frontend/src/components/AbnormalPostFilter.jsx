import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSymptomTranslation } from '../hooks/useSymptomTranslation';
import styles from '../styles/AbnormalPostFilter.module.css';

const AbnormalPostFilter = ({ onFilterChange, symptoms = [] }) => {
  const { t } = useTranslation('posts');
  const { translateSingleSymptom, reverseTranslateSymptom } = useSymptomTranslation();
  const [filterType, setFilterType] = useState('symptom'); // 'symptom', 'date', 'both'
  const [selectedSymptomOption, setSelectedSymptomOption] = useState('');
  const [selectedSymptoms, setSelectedSymptoms] = useState([]);
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);

  // 格式化日期顯示
  const formatDate = (date) => {
    if (!date) return '';
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return t('abnormalPostFilter.dateFormat', { year, month, day });
  };

  // 將 Date 物件轉換為 YYYY-MM-DD 格式
  const formatDateForInput = (date) => {
    if (!date) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // 處理開始日期變更
  const handleStartDateChange = (e) => {
    const dateValue = e.target.value;
    if (dateValue) {
      const newDate = new Date(dateValue);
      setStartDate(newDate);
      // 立即觸發篩選
      const filters = {
        type: filterType,
        symptoms: (filterType === 'symptom' || filterType === 'both') ?
          selectedSymptoms.map(s => ({ ...s, text: reverseTranslateSymptom(s.text) })) : [],
        startDate: (filterType === 'date' || filterType === 'both') ? newDate : null,
        endDate: (filterType === 'date' || filterType === 'both') ? endDate : null
      };
      onFilterChange(filters);
    }
  };

  // 處理結束日期變更
  const handleEndDateChange = (e) => {
    const dateValue = e.target.value;
    if (dateValue) {
      const newDate = new Date(dateValue);
      setEndDate(newDate);
      // 立即觸發篩選
      const filters = {
        type: filterType,
        symptoms: (filterType === 'symptom' || filterType === 'both') ?
          selectedSymptoms.map(s => ({ ...s, text: reverseTranslateSymptom(s.text) })) : [],
        startDate: (filterType === 'date' || filterType === 'both') ? startDate : null,
        endDate: (filterType === 'date' || filterType === 'both') ? newDate : null
      };
      onFilterChange(filters);
    }
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
      symptoms: (filterType === 'symptom' || filterType === 'both') ?
        selectedSymptoms.map(s => ({ ...s, text: reverseTranslateSymptom(s.text) })) : [],
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
      symptoms: (filterType === 'symptom' || filterType === 'both') ?
        newSymptoms.map(s => ({ ...s, text: reverseTranslateSymptom(s.text) })) : [],
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
      symptoms: (filterType === 'symptom' || filterType === 'both') ?
        newSymptoms.map(s => ({ ...s, text: reverseTranslateSymptom(s.text) })) : [],
      startDate: (filterType === 'date' || filterType === 'both') ? startDate : null,
      endDate: (filterType === 'date' || filterType === 'both') ? endDate : null
    };
    onFilterChange(filters);
  };

  return (
    <div className={styles.filterContainer}>
      {/* 篩選類型選擇 */}
      <div className={styles.filterTypeRow}>
        <span className={styles.filterLabel}>{t('abnormalPostFilter.filterByLabel')}</span>
        <select 
          value={filterType} 
          onChange={(e) => setFilterType(e.target.value)}
          className={styles.filterTypeSelect}
        >
          <option value="symptom">{t('abnormalPostFilter.filterOptions.symptom')}</option>
          <option value="date">{t('abnormalPostFilter.filterOptions.date')}</option>
          <option value="both">{t('abnormalPostFilter.filterOptions.both')}</option>
        </select>
        <span className={styles.filterLabel}>{t('abnormalPostFilter.filterLabel')}</span>
      </div>

      {/* 症狀篩選區域 */}
      {(filterType === 'symptom' || filterType === 'both') && (
        <div className={styles.symptomFilterSection}>
          {/* 已選擇的症狀顯示 */}
          {selectedSymptoms.length > 0 && (
            <div className={styles.selectedSymptomsContainer}>
              {selectedSymptoms.map((symptom) => (
                <div key={symptom.id} className={styles.selectedSymptom}>
                  <span className={styles.symptomText}>{translateSingleSymptom(symptom.text)}</span>
                  <button 
                    className={styles.removeSymptomBtn}
                    onClick={() => handleRemoveSymptom(symptom.id)}
                  >
                    {t('abnormalPostFilter.removeSymptomButton')}
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
              <option value="">{t('abnormalPostFilter.selectOption')}</option>
              {symptoms
                .filter(symptom => !selectedSymptoms.some(s => s.text === symptom))
                .map((symptom, index) => (
                  <option key={index} value={symptom}>{translateSingleSymptom(symptom)}</option>
                ))
              }
            </select>
            <button 
              className={styles.addButton}
              onClick={handleAddSymptom}
              disabled={!selectedSymptomOption}
            >
              {t('abnormalPostFilter.addButton')}
            </button>
          </div>
        </div>
      )}

      {/* 日期篩選區域 */}
      {(filterType === 'date' || filterType === 'both') && (
        <div className={styles.dateFilterSection}>
          <div className={styles.dateRangeRow}>
            <div className={styles.dateInputWrapper}>
              <input
                type="date"
                className={styles.dateInput}
                value={formatDateForInput(startDate)}
                onChange={handleStartDateChange}
                max={formatDateForInput(endDate) || undefined}
              />
              <span className={styles.datePlaceholder}>
                {startDate ? formatDate(startDate) : t('common.selectDate')}
              </span>
            </div>
            <span className={styles.dateSeparator}>-</span>
            <div className={styles.dateInputWrapper}>
              <input
                type="date"
                className={styles.dateInput}
                value={formatDateForInput(endDate)}
                onChange={handleEndDateChange}
                min={formatDateForInput(startDate) || undefined}
              />
              <span className={styles.datePlaceholder}>
                {endDate ? formatDate(endDate) : t('common.selectDate')}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 操作按鈕 */}
      <div className={styles.actionButtons}>
        <button className={styles.resetButton} onClick={handleReset}>
          {t('abnormalPostFilter.resetButton')}
        </button>
        <button className={styles.filterButton} onClick={handleFilter}>
          {t('abnormalPostFilter.filterButton')}
        </button>
      </div>

    </div>
  );
};

export default AbnormalPostFilter;