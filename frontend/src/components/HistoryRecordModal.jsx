import React, { useState, useEffect } from 'react';
import styles from '../styles/HistoryRecordModal.module.css';
import HistoryRecordPreview from './HistoryRecordPreview';
import NotificationComponent from './Notification';
import ConfirmNotification from './ConfirmNotification';
import { getHistoryRecords, clearAllHistoryRecords } from '../utils/historyRecordStorage';

const HistoryRecordModal = ({ isOpen, onClose }) => {
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
      console.error('載入歷史紀錄失敗:', error);
      setNotification('載入歷史紀錄失敗');
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
      setNotification('所有紀錄已清空');
      setRecords([]);
    } else {
      setNotification('清空失敗');
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

  // 營養素名稱對照
  const getNutrientName = (key) => {
    const names = {
      protein: '蛋白質',
      fat: '脂肪',
      calcium: '鈣',
      phosphorus: '磷',
      magnesium: '鎂',
      sodium: '鈉'
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
              ❮ 返回列表
            </button>
          ) : (
            <h2>歷史紀錄</h2>
          )}
        </div>
        
        <div className={styles.modalBody}>
          {selectedRecord ? (
            <div className={styles.recordDetail}>
              {/* 基本資訊 */}
              <div className={styles.detailSection}>
                <h3 className={styles.detailSectionTitle}>基本資訊</h3>
                <div className={styles.detailInfoGrid}>
                  <div className={styles.detailInfoItem}>
                    <span className={styles.detailLabel}>計算時間：</span>
                    <span className={styles.detailValue}>{formatDate(selectedRecord.date)}</span>
                  </div>
                  <div className={styles.detailInfoItem}>
                    <span className={styles.detailLabel}>寵物名稱：</span>
                    <span className={styles.detailValue}>{selectedRecord.petName}</span>
                  </div>
                  <div className={styles.detailInfoItem}>
                    <span className={styles.detailLabel}>飼料名稱：</span>
                    <span className={styles.detailValue}>{selectedRecord.feedName}</span>
                  </div>
                  {selectedRecord.feedBrand && (
                    <div className={styles.detailInfoItem}>
                      <span className={styles.detailLabel}>飼料品牌：</span>
                      <span className={styles.detailValue}>{selectedRecord.feedBrand}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* 計算結果 */}
              {selectedRecord.calculationResult && (
                <div className={styles.detailSection}>
                  <h3 className={styles.detailSectionTitle}>計算結果</h3>
                  
                  {/* 每日需求 */}
                  <div className={styles.resultBox}>
                    <h4 className={styles.resultBoxTitle}>每日需求</h4>
                    <div className={styles.detailInfoGrid}>
                      <div className={styles.detailInfoItem}>
                        <span className={styles.detailLabel}>每日熱量需求：</span>
                        <span className={styles.detailValue}>
                          {formatNutrientValue(selectedRecord.calculationResult.daily_ME_kcal, 'kcal')}
                        </span>
                      </div>
                      <div className={styles.detailInfoItem}>
                        <span className={styles.detailLabel}>每日飼料建議量：</span>
                        <span className={styles.detailValue}>
                          {formatNutrientValue(selectedRecord.calculationResult.daily_feed_amount_g, 'g')}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 營養素攝取 */}
                  {selectedRecord.calculationResult.actual_intake && (
                    <div className={styles.resultBox}>
                      <h4 className={styles.resultBoxTitle}>實際營養攝取</h4>
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
                      <h4 className={styles.resultBoxTitle}>營養師建議</h4>
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
                  載入中...
                </div>
              ) : records.length === 0 ? (
                <div className={styles.emptyState}>
                  <img 
                    src="/assets/icon/SearchNoResult.png" 
                    alt="空狀態" 
                    className={styles.emptyIcon}
                  />
                  <p>尚無計算紀錄</p>
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
                清空
              </button>
              <button 
                className={styles.closeButton} 
                onClick={onClose}
              >
                關閉
              </button>
            </>
          )}
        </div>
      </div>

      {/* 確認清空對話框 */}
      {showConfirmModal && (
        <ConfirmNotification
          message="確定要清空所有歷史紀錄嗎？此操作無法復原"
          onConfirm={confirmClearAll}
          onCancel={cancelClearAll}
        />
      )}
    </div>
  );
};

export default HistoryRecordModal;