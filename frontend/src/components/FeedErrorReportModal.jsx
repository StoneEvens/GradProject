import React, { useState, useEffect } from 'react';
import styles from '../styles/EditProfileModal.module.css';
import Notification from './Notification';

const FeedErrorReportModal = ({ feed, isOpen, onClose, onSubmit }) => {
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState('');
  const [errorTypes, setErrorTypes] = useState([]);
  const [correctedData, setCorrectedData] = useState({});
  const [description, setDescription] = useState('');

  // 錯誤類型選項
  const ERROR_TYPE_OPTIONS = [
    { value: 'name', label: '名稱錯誤' },
    { value: 'brand', label: '品牌錯誤' },
    { value: 'price', label: '價格錯誤' },
    { value: 'nutrition', label: '營養成分錯誤' },
    { value: 'image', label: '圖片錯誤' },
    { value: 'other', label: '其他錯誤' }
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
      showNotification('請選擇至少一個錯誤類型');
      return;
    }

    if (!description.trim()) {
      showNotification('請描述錯誤內容');
      return;
    }

    const modifiedFields = getModifiedFields();
    
    // 檢查是否有選擇特定錯誤類型但沒有修改對應的資料
    const needsValidation = [];
    
    if (errorTypes.includes('name') || errorTypes.includes('multiple')) {
      if (!modifiedFields.name || modifiedFields.name === feed.name) {
        needsValidation.push('飼料名稱');
      }
    }
    
    if (errorTypes.includes('brand') || errorTypes.includes('multiple')) {
      if (!modifiedFields.brand || modifiedFields.brand === feed.brand) {
        needsValidation.push('飼料品牌');
      }
    }
    
    if (errorTypes.includes('price') || errorTypes.includes('multiple')) {
      if (!modifiedFields.price || modifiedFields.price === feed.price) {
        needsValidation.push('飼料價格');
      }
    }
    
    if (errorTypes.includes('nutrition') || errorTypes.includes('multiple')) {
      const nutritionFields = ['protein', 'fat', 'carbohydrate', 'calcium', 'phosphorus', 'magnesium', 'sodium'];
      const hasNutritionChange = nutritionFields.some(field => 
        modifiedFields[field] !== undefined && modifiedFields[field] !== feed[field]
      );
      if (!hasNutritionChange) {
        needsValidation.push('營養成分');
      }
    }
    
    // 如果選擇了特定錯誤類型但沒有修改對應資料
    if (needsValidation.length > 0 && !errorTypes.includes('other')) {
      showNotification(`您選擇了錯誤類型，但未修正以下資料：${needsValidation.join('、')}。請修正資料或選擇「其他錯誤」。`);
      return;
    }
    
    // 如果沒有任何修改且不是「其他錯誤」或「圖片錯誤」
    if (Object.keys(modifiedFields).length === 0 && !errorTypes.includes('other') && !errorTypes.includes('image')) {
      showNotification('請至少修正一項資料，或選擇「其他錯誤」類型');
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
      showNotification('回報錯誤失敗，請稍後再試');
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
          <h2>回報飼料錯誤</h2>
        </div>
        
        <div className={styles.modalBody}>
          {/* 錯誤類型選擇 */}
          <div className={styles.formSection}>
            <div className={styles.inputGroup}>
              <label>錯誤類型（可多選）</label>
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
              <label>錯誤描述</label>
              <textarea
                className={styles.formTextarea}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="請描述您發現的錯誤..."
                rows={3}
              />
            </div>

            {/* 基本資訊修正 */}
            {(errorTypes.includes('name') || errorTypes.includes('brand') || errorTypes.includes('price') || errorTypes.includes('multiple')) && (
              <>
                <h3 style={{ marginTop: '20px', marginBottom: '10px' }}>修正資料</h3>
                
                {(errorTypes.includes('name') || errorTypes.includes('multiple')) && (
                  <div className={styles.inputGroup}>
                    <label>飼料名稱</label>
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
                    <label>飼料品牌</label>
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
                    <label>飼料價錢</label>
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
                <h3 style={{ marginTop: '20px', marginBottom: '10px' }}>營養成分修正</h3>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div className={styles.inputGroup}>
                    <label>蛋白質 (%)</label>
                    <input
                      type="number"
                      className={styles.formInput}
                      value={correctedData.protein}
                      onChange={(e) => handleInputChange('protein', parseFloat(e.target.value) || 0)}
                      step="0.1"
                    />
                  </div>

                  <div className={styles.inputGroup}>
                    <label>脂肪 (%)</label>
                    <input
                      type="number"
                      className={styles.formInput}
                      value={correctedData.fat}
                      onChange={(e) => handleInputChange('fat', parseFloat(e.target.value) || 0)}
                      step="0.1"
                    />
                  </div>

                  <div className={styles.inputGroup}>
                    <label>碳水化合物 (%)</label>
                    <input
                      type="number"
                      className={styles.formInput}
                      value={correctedData.carbohydrate}
                      onChange={(e) => handleInputChange('carbohydrate', parseFloat(e.target.value) || 0)}
                      step="0.1"
                    />
                  </div>

                  <div className={styles.inputGroup}>
                    <label>鈣 (%)</label>
                    <input
                      type="number"
                      className={styles.formInput}
                      value={correctedData.calcium}
                      onChange={(e) => handleInputChange('calcium', parseFloat(e.target.value) || 0)}
                      step="0.1"
                    />
                  </div>

                  <div className={styles.inputGroup}>
                    <label>磷 (%)</label>
                    <input
                      type="number"
                      className={styles.formInput}
                      value={correctedData.phosphorus}
                      onChange={(e) => handleInputChange('phosphorus', parseFloat(e.target.value) || 0)}
                      step="0.1"
                    />
                  </div>

                  <div className={styles.inputGroup}>
                    <label>鎂 (%)</label>
                    <input
                      type="number"
                      className={styles.formInput}
                      value={correctedData.magnesium}
                      onChange={(e) => handleInputChange('magnesium', parseFloat(e.target.value) || 0)}
                      step="0.1"
                    />
                  </div>

                  <div className={styles.inputGroup}>
                    <label>鈉 (%)</label>
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
            取消
          </button>
          <button 
            className={styles.saveButton} 
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? '提交中...' : '提交回報'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default FeedErrorReportModal;