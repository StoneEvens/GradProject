import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import styles from '../styles/HistoryRecordModal.module.css';
import HistoryRecordPreview from './HistoryRecordPreview';
import NotificationComponent from './Notification';
import ConfirmNotification from './ConfirmNotification';
import { getHistoryRecords, clearAllHistoryRecords } from '../utils/historyRecordStorage';

const HistoryRecordModal = ({ isOpen, onClose }) => {
  const { t } = useTranslation('calculator');
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState('');
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadRecords();
    } else {
      // 關閉時清除選中的紀錄
      setSelectedRecord(null);
    }
  }, [isOpen]);

  const loadRecords = () => {
    setLoading(true);
    try {
      const historyRecords = getHistoryRecords();
      setRecords(historyRecords);
    } catch (error) {
      console.error(t('historyModal.loadRecordsFailed'), error);
      setNotification(t('historyModal.loadRecordsFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleRecordClick = (record) => {
    // 在 Modal 內顯示詳細資訊
    setSelectedRecord(record);
  };

  const handleClearAll = () => {
    setShowConfirmModal(true);
  };

  const confirmClearAll = () => {
    const success = clearAllHistoryRecords();
    if (success) {
      setNotification(t('historyModal.allRecordsCleared'));
      setRecords([]);
    } else {
      setNotification(t('historyModal.clearFailed'));
    }
    setShowConfirmModal(false);
  };

  const cancelClearAll = () => {
    setShowConfirmModal(false);
  };

  // 處理點擊遮罩關閉 modal
  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // 格式化日期
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('zh-TW', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // 格式化營養素數值
  const formatNutrientValue = (value, unit = 'g') => {
    if (typeof value === 'number') {
      return `${value.toFixed(2)} ${unit}`;
    }
    return '-';
  };

  const getNutrientName = (key) => {
    const names = {
      protein: t('feedSection.nutrients.protein'),
      fat: t('feedSection.nutrients.fat'),
      calcium: t('feedSection.nutrients.calcium'),
      phosphorus: t('feedSection.nutrients.phosphorus'),
      magnesium: t('feedSection.nutrients.magnesium'),
      sodium: t('feedSection.nutrients.sodium')
    };
    return names[key] || key;
  };

  // 營養素單位
  const getNutrientUnit = (key) => {
    if (['magnesium', 'sodium'].includes(key)) {
      return 'mg';
    }
    return 'g';
  };

  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay} onClick={handleOverlayClick}>
      {notification && (
        <NotificationComponent
          message={notification}
          onClose={() => setNotification('')}
        />
      )}
      <div className={styles.modalContainer}>
        <div className={styles.modalHeader}>
          {selectedRecord ? (
            <button className={styles.backButton} onClick={() => setSelectedRecord(null)}>
              {t('historyModal.backToList')}
            </button>
          ) : (
            <h2>{t('historyModal.title')}</h2>
          )}
        </div>
        
        <div className={styles.modalBody}>
          {selectedRecord ? (
            <div className={styles.recordDetail}>
              {/* 基本資訊 */}
              <div className={styles.detailSection}>
                <h3 className={styles.detailSectionTitle}>{t('historyModal.basicInfo')}</h3>
                <div className={styles.detailInfoGrid}>
                  <div className={styles.detailInfoItem}>
                    <span className={styles.detailLabel}>{t('historyModal.calculationTime')}</span>
                    <span className={styles.detailValue}>{formatDate(selectedRecord.date)}</span>
                  </div>
                  <div className={styles.detailInfoItem}>
                    <span className={styles.detailLabel}>{t('historyModal.petName')}</span>
                    <span className={styles.detailValue}>{selectedRecord.petName}</span>
                  </div>
                  <div className={styles.detailInfoItem}>
                    <span className={styles.detailLabel}>{t('historyModal.feedName')}</span>
                    <span className={styles.detailValue}>{selectedRecord.feedName}</span>
                  </div>
                  {selectedRecord.feedBrand && (
                    <div className={styles.detailInfoItem}>
                      <span className={styles.detailLabel}>{t('historyModal.feedBrand')}</span>
                      <span className={styles.detailValue}>{selectedRecord.feedBrand}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* 計算結果 */}
              {selectedRecord.calculationResult && (
                <div className={styles.detailSection}>
                  <h3 className={styles.detailSectionTitle}>{t('historyModal.calculationResult')}</h3>
                  
                  {/* 每日需求 */}
                  <div className={styles.resultBox}>
                    <h4 className={styles.resultBoxTitle}>{t('historyModal.dailyRequirement')}</h4>
                    <div className={styles.detailInfoGrid}>
                      <div className={styles.detailInfoItem}>
                        <span className={styles.detailLabel}>{t('historyModal.dailyCaloriesNeed')}</span>
                        <span className={styles.detailValue}>
                          {formatNutrientValue(selectedRecord.calculationResult.daily_ME_kcal, 'kcal')}
                        </span>
                      </div>
                      <div className={styles.detailInfoItem}>
                        <span className={styles.detailLabel}>{t('historyModal.dailyFeedRecommendation')}</span>
                        <span className={styles.detailValue}>
                          {formatNutrientValue(selectedRecord.calculationResult.daily_feed_amount_g, 'g')}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 營養素攝取 */}
                  {selectedRecord.calculationResult.actual_intake && (
                    <div className={styles.resultBox}>
                      <h4 className={styles.resultBoxTitle}>{t('historyModal.actualNutritionIntake')}</h4>
                      <div className={styles.nutrientGrid}>
                        {Object.entries(selectedRecord.calculationResult.actual_intake).map(([key, value]) => (
                          <div key={key} className={styles.nutrientItem}>
                            <span className={styles.nutrientName}>{getNutrientName(key)}：</span>
                            <span className={styles.nutrientValue}>
                              {formatNutrientValue(value, getNutrientUnit(key))}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* AI 建議 */}
                  {selectedRecord.calculationResult.description && (
                    <div className={styles.resultBox}>
                      <h4 className={styles.resultBoxTitle}>{t('historyModal.nutritionistAdvice')}</h4>
                      <div className={styles.description}>
                        {selectedRecord.calculationResult.description}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <>
              {loading ? (
                <div className={styles.loadingContainer}>
                  {t('historyModal.loading')}
                </div>
              ) : records.length === 0 ? (
                <div className={styles.emptyState}>
                  <img 
                    src="/assets/icon/SearchNoResult.png" 
                    alt={t('historyModal.emptyStateAlt')} 
                    className={styles.emptyIcon}
                  />
                  <p>{t('historyModal.noRecords')}</p>
                </div>
              ) : (
                <div className={styles.recordList}>
                  {records.map(record => (
                    <HistoryRecordPreview 
                      key={record.id}
                      record={record}
                      onClick={handleRecordClick}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <div className={styles.modalFooter}>
          {!selectedRecord && (
            <>
              <button 
                className={styles.clearButton} 
                onClick={handleClearAll}
                disabled={records.length === 0}
              >
                {t('historyModal.clearAll')}
              </button>
              <button 
                className={styles.closeButton} 
                onClick={onClose}
              >
                {t('historyModal.close')}
              </button>
            </>
          )}
        </div>
      </div>

      {/* 確認清空對話框 */}
      {showConfirmModal && (
        <ConfirmNotification
          message={t('historyModal.confirmClearMessage')}
          onConfirm={confirmClearAll}
          onCancel={cancelClearAll}
        />
      )}
    </div>
  );
};

export default HistoryRecordModal;