import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import styles from '../styles/EditProfileModal.module.css';
import Notification from './Notification';

const FeedErrorReportModal = ({ feed, isOpen, onClose, onSubmit }) => {
  const { t } = useTranslation('feed');
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState('');
  const [errorTypes, setErrorTypes] = useState([]);
  const [correctedData, setCorrectedData] = useState({});
  const [description, setDescription] = useState('');

  const ERROR_TYPE_OPTIONS = [
    { value: 'name', label: t('errorReportModal.errorTypes.name') },
    { value: 'brand', label: t('errorReportModal.errorTypes.brand') },
    { value: 'price', label: t('errorReportModal.errorTypes.price') },
    { value: 'nutrition', label: t('errorReportModal.errorTypes.nutrition') },
    { value: 'image', label: t('errorReportModal.errorTypes.image') },
    { value: 'other', label: t('errorReportModal.errorTypes.other') }
  ];

  // 初始化表單資料
  useEffect(() => {
    if (feed && isOpen) {
      setCorrectedData({
        name: feed.name || '',
        brand: feed.brand || '',
        price: feed.price || 0,
        protein: feed.protein || 0,
        fat: feed.fat || 0,
        carbohydrate: feed.carbohydrate || 0,
        calcium: feed.calcium || 0,
        phosphorus: feed.phosphorus || 0,
        magnesium: feed.magnesium || 0,
        sodium: feed.sodium || 0
      });
      setErrorTypes([]);
      setDescription('');
    }
  }, [feed, isOpen]);

  // 顯示通知
  const showNotification = (message) => {
    setNotification(message);
  };

  // 隱藏通知
  const hideNotification = () => {
    setNotification('');
  };

  // 處理錯誤類型變更
  const handleErrorTypeChange = (type) => {
    if (errorTypes.includes(type)) {
      setErrorTypes(errorTypes.filter(t => t !== type));
    } else {
      setErrorTypes([...errorTypes, type]);
    }
  };

  // 處理表單輸入變更
  const handleInputChange = (field, value) => {
    setCorrectedData({
      ...correctedData,
      [field]: value
    });
  };

  // 判斷哪些欄位被修改了
  const getModifiedFields = () => {
    const modified = {};
    Object.keys(correctedData).forEach(key => {
      if (correctedData[key] !== feed[key]) {
        modified[key] = correctedData[key];
      }
    });
    return modified;
  };

  // 處理提交
  const handleSubmit = async () => {
    if (errorTypes.length === 0) {
      showNotification(t('errorReportModal.messages.selectErrorType'));
      return;
    }

    if (!description.trim()) {
      showNotification(t('errorReportModal.messages.enterDescription'));
      return;
    }

    const modifiedFields = getModifiedFields();
    
    // 檢查是否有選擇特定錯誤類型但沒有修改對應的資料
    const needsValidation = [];
    
    if (errorTypes.includes('name') || errorTypes.includes('multiple')) {
      if (!modifiedFields.name || modifiedFields.name === feed.name) {
        needsValidation.push(t('errorReportModal.fields.feedName'));
      }
    }

    if (errorTypes.includes('brand') || errorTypes.includes('multiple')) {
      if (!modifiedFields.brand || modifiedFields.brand === feed.brand) {
        needsValidation.push(t('errorReportModal.fields.feedBrand'));
      }
    }

    if (errorTypes.includes('price') || errorTypes.includes('multiple')) {
      if (!modifiedFields.price || modifiedFields.price === feed.price) {
        needsValidation.push(t('errorReportModal.fields.feedPrice'));
      }
    }

    if (errorTypes.includes('nutrition') || errorTypes.includes('multiple')) {
      const nutritionFields = ['protein', 'fat', 'carbohydrate', 'calcium', 'phosphorus', 'magnesium', 'sodium'];
      const hasNutritionChange = nutritionFields.some(field =>
        modifiedFields[field] !== undefined && modifiedFields[field] !== feed[field]
      );
      if (!hasNutritionChange) {
        needsValidation.push(t('errorReportModal.fields.nutrition'));
      }
    }
    
    if (needsValidation.length > 0 && !errorTypes.includes('other')) {
      showNotification(t('errorReportModal.messages.correctDataRequired', { fields: needsValidation.join('、') }));
      return;
    }

    if (Object.keys(modifiedFields).length === 0 && !errorTypes.includes('other') && !errorTypes.includes('image')) {
      showNotification(t('errorReportModal.messages.modifyDataRequired'));
      return;
    }

    setLoading(true);
    try {
      // 決定錯誤類型
      let finalErrorType = 'other';
      if (errorTypes.length === 1) {
        finalErrorType = errorTypes[0];
      } else if (errorTypes.length > 1) {
        finalErrorType = 'multiple';
      }

      await onSubmit({
        feed_id: feed.id,
        error_type: finalErrorType,
        description: description,
        corrected_data: modifiedFields
      });
      
      onClose();
    } catch (error) {
      console.error('回報錯誤失敗:', error);
      showNotification(t('errorReportModal.messages.submitFailed'));
    } finally {
      setLoading(false);
    }
  };

  // 處理取消
  const handleCancel = () => {
    setNotification('');
    onClose();
  };

  // 處理點擊遮罩關閉 modal
  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget && !loading) {
      handleCancel();
    }
  };

  if (!isOpen || !feed) return null;

  return (
    <div className={styles.modalOverlay} onClick={handleOverlayClick}>
      {notification && (
        <Notification
          message={notification}
          onClose={hideNotification}
        />
      )}
      <div className={styles.modalContainer} style={{ maxHeight: '90vh', overflowY: 'auto' }}>
        <div className={styles.modalHeader}>
          <h2>{t('errorReportModal.title')}</h2>
        </div>
        
        <div className={styles.modalBody}>
          {/* 錯誤類型選擇 */}
          <div className={styles.formSection}>
            <div className={styles.inputGroup}>
              <label>{t('errorReportModal.labels.errorType')}</label>
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                rowGap: '6px',
                columnGap: '10px', 
                marginTop: '10px',
                backgroundColor: '#fff6ea',
                padding: '15px',
                borderRadius: '10px',
                border: '1px solid #ffdbaa'
              }}>
                {ERROR_TYPE_OPTIONS.map(option => (
                  <label key={option.value} style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    cursor: 'pointer',
                    padding: '6px 10px',
                    backgroundColor: errorTypes.includes(option.value) ? '#ffdbaa' : 'transparent',
                    borderRadius: '6px',
                    transition: 'background-color 0.2s ease',
                    whiteSpace: 'nowrap'
                  }}>
                    <input
                      type="checkbox"
                      checked={errorTypes.includes(option.value)}
                      onChange={() => handleErrorTypeChange(option.value)}
                      style={{ 
                        marginRight: '6px',
                        width: '15px',
                        height: '15px',
                        cursor: 'pointer',
                        flexShrink: 0
                      }}
                    />
                    <span style={{ fontSize: '14px', color: '#333' }}>{option.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* 錯誤描述 */}
            <div className={styles.inputGroup}>
              <label>{t('errorReportModal.labels.errorDescription')}</label>
              <textarea
                className={styles.formTextarea}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t('errorReportModal.placeholders.description')}
                rows={3}
              />
            </div>

            {/* 基本資訊修正 */}
            {(errorTypes.includes('name') || errorTypes.includes('brand') || errorTypes.includes('price') || errorTypes.includes('multiple')) && (
              <>
                <h3 style={{ marginTop: '20px', marginBottom: '10px' }}>{t('errorReportModal.labels.correctedData')}</h3>
                
                {(errorTypes.includes('name') || errorTypes.includes('multiple')) && (
                  <div className={styles.inputGroup}>
                    <label>{t('errorReportModal.fields.feedName')}</label>
                    <input
                      type="text"
                      className={styles.formInput}
                      value={correctedData.name}
                      onChange={(e) => handleInputChange('name', e.target.value)}
                    />
                  </div>
                )}

                {(errorTypes.includes('brand') || errorTypes.includes('multiple')) && (
                  <div className={styles.inputGroup}>
                    <label>{t('errorReportModal.fields.feedBrand')}</label>
                    <input
                      type="text"
                      className={styles.formInput}
                      value={correctedData.brand}
                      onChange={(e) => handleInputChange('brand', e.target.value)}
                    />
                  </div>
                )}

                {(errorTypes.includes('price') || errorTypes.includes('multiple')) && (
                  <div className={styles.inputGroup}>
                    <label>{t('errorReportModal.fields.feedPrice')}</label>
                    <input
                      type="number"
                      className={styles.formInput}
                      value={correctedData.price}
                      onChange={(e) => handleInputChange('price', parseFloat(e.target.value) || 0)}
                    />
                  </div>
                )}
              </>
            )}

            {/* 營養成分修正 */}
            {(errorTypes.includes('nutrition') || errorTypes.includes('multiple')) && (
              <>
                <h3 style={{ marginTop: '20px', marginBottom: '10px' }}>{t('errorReportModal.labels.nutritionCorrection')}</h3>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div className={styles.inputGroup}>
                    <label>{t('detailPage.labels.protein')} (%)</label>
                    <input
                      type="number"
                      className={styles.formInput}
                      value={correctedData.protein}
                      onChange={(e) => handleInputChange('protein', parseFloat(e.target.value) || 0)}
                      step="0.1"
                    />
                  </div>

                  <div className={styles.inputGroup}>
                    <label>{t('detailPage.labels.fat')} (%)</label>
                    <input
                      type="number"
                      className={styles.formInput}
                      value={correctedData.fat}
                      onChange={(e) => handleInputChange('fat', parseFloat(e.target.value) || 0)}
                      step="0.1"
                    />
                  </div>

                  <div className={styles.inputGroup}>
                    <label>{t('detailPage.labels.carbohydrate')} (%)</label>
                    <input
                      type="number"
                      className={styles.formInput}
                      value={correctedData.carbohydrate}
                      onChange={(e) => handleInputChange('carbohydrate', parseFloat(e.target.value) || 0)}
                      step="0.1"
                    />
                  </div>

                  <div className={styles.inputGroup}>
                    <label>{t('detailPage.labels.calcium')} (%)</label>
                    <input
                      type="number"
                      className={styles.formInput}
                      value={correctedData.calcium}
                      onChange={(e) => handleInputChange('calcium', parseFloat(e.target.value) || 0)}
                      step="0.1"
                    />
                  </div>

                  <div className={styles.inputGroup}>
                    <label>{t('detailPage.labels.phosphorus')} (%)</label>
                    <input
                      type="number"
                      className={styles.formInput}
                      value={correctedData.phosphorus}
                      onChange={(e) => handleInputChange('phosphorus', parseFloat(e.target.value) || 0)}
                      step="0.1"
                    />
                  </div>

                  <div className={styles.inputGroup}>
                    <label>{t('detailPage.labels.magnesium')} (%)</label>
                    <input
                      type="number"
                      className={styles.formInput}
                      value={correctedData.magnesium}
                      onChange={(e) => handleInputChange('magnesium', parseFloat(e.target.value) || 0)}
                      step="0.1"
                    />
                  </div>

                  <div className={styles.inputGroup}>
                    <label>{t('detailPage.labels.sodium')} (%)</label>
                    <input
                      type="number"
                      className={styles.formInput}
                      value={correctedData.sodium}
                      onChange={(e) => handleInputChange('sodium', parseFloat(e.target.value) || 0)}
                      step="0.1"
                    />
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        <div className={styles.modalFooter}>
          <button 
            className={styles.cancelButton} 
            onClick={handleCancel}
            disabled={loading}
          >
            {t('errorReportModal.buttons.cancel')}
          </button>
          <button
            className={styles.saveButton}
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? t('errorReportModal.buttons.submitting') : t('errorReportModal.buttons.submit')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default FeedErrorReportModal;