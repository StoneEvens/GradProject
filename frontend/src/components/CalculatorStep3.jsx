import React, { useEffect, useState } from 'react';
import styles from '../styles/CalculatorStep3.module.css';
import NotificationComponent from './Notification';
import HistoryRecordModal from './HistoryRecordModal';
import { saveHistoryRecord } from '../utils/historyRecordStorage';


// 文字格式化函數
const formatResultText = (text) => {
  if (!text) return ['無資料'];
  
  // 清理文字：移除 markdown 和特殊字元
  let formattedText = text
    .replace(/\*\*/g, '') // 移除 markdown 粗體
    .replace(/\*/g, '') // 移除 markdown 斜體
    .replace(/#{1,6}\s/g, '') // 移除 markdown 標題
    .replace(/\|[-|\s]*\|/g, '') // 移除表格線
    .replace(/\|/g, '') // 移除表格符號
    .replace(/-{3,}/g, '') // 移除水平線
    .replace(/```[\s\S]*?```/g, '') // 移除代碼區塊
    .replace(/`([^`]+)`/g, '$1') // 移除行內代碼
    .replace(/\\n/g, '\n') // 處理轉義的換行
    .replace(/\s{3,}/g, '  ') // 多餘空格
    .trim();
  
  // 分割成段落
  const paragraphs = formattedText
    .split(/\n\s*\n/)
    .filter(paragraph => paragraph.trim().length > 0)
    .map(paragraph => paragraph.trim());
  
  return paragraphs.length > 0 ? paragraphs : ['無資料'];
};

// 結果顯示組件
const ResultDisplay = ({ text }) => {
  const paragraphs = formatResultText(text);
  
  return (
    <div className={styles.formattedResult}>
      {paragraphs.map((paragraph, index) => {
        // 處理不同類型的內容
        
        // 1. 檢查是否包含清單項目
        if (paragraph.includes('\n-') || (paragraph.includes('-') && paragraph.includes(':'))) {
          const lines = paragraph.split('\n');
          const title = lines[0].replace(/^-\s*/, '').trim();
          const items = lines.slice(1)
            .filter(line => line.trim().startsWith('-'))
            .map(line => line.replace(/^-\s*/, '').trim())
            .filter(item => item.length > 0);
          
          return (
            <div key={index} className={styles.listSection}>
              {title && !title.startsWith('-') && (
                <div className={styles.sectionTitle}>{title}</div>
              )}
              {items.length > 0 ? (
                items.map((item, itemIndex) => (
                  <div key={itemIndex} className={styles.listItem}>
                    {item}
                  </div>
                ))
              ) : (
                <div className={styles.paragraph}>{paragraph}</div>
              )}
            </div>
          );
        }
        
        // 2. 檢查是否為標題段落（包含「結果」、「建議」等關鍵字）
        if (/^[一-鿿\w\s]*[：:]\s*$/.test(paragraph) || 
            paragraph.includes('結果') || 
            paragraph.includes('建議') || 
            paragraph.includes('摘要') ||
            paragraph.includes('結論')) {
          return (
            <div key={index} className={styles.sectionTitle}>
              {paragraph.replace(/[：:]\s*$/, '')}
            </div>
          );
        }
        
        // 3. 處理包含數值的行（營養資訊）
        if (paragraph.includes('g') || paragraph.includes('kcal') || 
            paragraph.includes('公克') || paragraph.includes('大卡')) {
          return (
            <div key={index} className={styles.nutritionInfo}>
              {paragraph}
            </div>
          );
        }
        
        // 4. 預設為一般段落
        return (
          <div key={index} className={styles.paragraph}>
            {paragraph}
          </div>
        );
      })}
    </div>
  );
};

function CalculatorStep3({ onPrev, onComplete, selectedFeed, selectedPet, calculationResult }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [isSaved, setIsSaved] = useState(false);
  const [notification, setNotification] = useState('');
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  
  // 過去紀錄按鈕點擊事件
  const handleHistoryClick = () => {
    setShowHistoryModal(true);
  };

  useEffect(() => {
    // 檢查是否為計算中狀態
    if (calculationResult?.isCalculating) {
      setLoading(true);
      setError(null);
      setResult(null);
    } else if (calculationResult?.error) {
      setLoading(false);
      setError(calculationResult.error);
      setResult(null);
    } else if (calculationResult?.calculationResult) {
      setLoading(false);
      setError(null);
      setResult(calculationResult.calculationResult);
    } else if (calculationResult && !calculationResult.isCalculating) {
      // 舊格式直接傳遞結果
      setLoading(false);
      setError(null);
      setResult(calculationResult);
    }
  }, [calculationResult]);

  // 本地存儲功能
  const saveResultToLocalStorage = () => {
    if (!result || !selectedPet || !selectedFeed) {
      setNotification('無法儲存，資料不完整');
      return;
    }

    // 準備要儲存的資料
    const recordData = {
      petId: selectedPet.id,
      petName: selectedPet.pet_name || selectedPet.name,
      feedId: selectedFeed.id,
      feedName: selectedFeed.name,
      feedBrand: selectedFeed.brand,
      calculationResult: {
        description: result.description,
        daily_ME_kcal: result.daily_ME_kcal,
        daily_feed_amount_g: result.daily_feed_amount_g,
        recommended_nutrients: result.recommended_nutrients,
        actual_intake: result.actual_intake
      }
    };

    // 儲存歷史紀錄
    const newRecord = saveHistoryRecord(recordData);
    
    if (newRecord) {
      setIsSaved(true);
      setNotification('計算結果已儲存！');
      console.log('儲存成功:', newRecord);
      
      // 延遲 1.5 秒後跳轉回首頁
      setTimeout(() => {
        if (onComplete) {
          onComplete();
        }
      }, 1500);
    } else {
      console.error('儲存失敗');
      setNotification('儲存失敗，請稍後再試');
    }
  };

  return (
    <>
      <div className={styles.titleSection}>
        <h2 className={styles.title}>營養計算機</h2>
        <button className={styles.historyButton} onClick={handleHistoryClick}>
          過去紀錄
        </button>
      </div>
      <div className={styles.divider}></div>
      
      <div className={styles.section}>
        <label className={styles.sectionLabel}>計算結果:</label>
        <div className={styles.resultSection}>
          {loading ? (
            <div className={styles.loadingContainer}>
              <div className={styles.loadingSpinner}></div>
              <div className={styles.aiLoading}>計算中，請稍候...</div>
              <div className={styles.loadingSubtext}>正在分析寵物營養需求</div>
            </div>
          ) : error ? (
            <div className={styles.errorContainer}>
              <div className={styles.errorIcon}>⚠️</div>
              <div className={styles.errorTitle}>計算失敗</div>
              <div className={styles.errorMessage}>{error}</div>
              <button className={styles.retryButton} onClick={() => window.location.reload()}>
                重新計算
              </button>
            </div>
          ) : (
            <div className={styles.resultContent}>
              <div className={styles.resultBox}>
                <div className={styles.resultTitle}>
                  {selectedPet?.isTemporary && <span className={styles.temporaryPetHint}>(臨時寵物)</span>}
                  計算結果：
                </div>

                {/* 🔹 在這裡先顯示 feed_hint */}
                {result?.feed_hint && <ResultDisplay text={result.feed_hint} />}


                <ResultDisplay text={result?.description} />
              </div>

            </div>
          )}
        </div>
      </div>
      
      <div className={styles.actionButtons}>
        <button className={styles.prevButton} onClick={onPrev}>上一步</button>
        <button 
          className={styles.completeButton}
          onClick={saveResultToLocalStorage}
          disabled={loading || error || isSaved}
        >
          {isSaved ? '已儲存' : '完成'}
        </button>
      </div>
      
      <HistoryRecordModal
        isOpen={showHistoryModal}
        onClose={() => setShowHistoryModal(false)}
      />
      
      {notification && (
        <NotificationComponent 
          message={notification} 
          onClose={() => setNotification('')} 
        />
      )}
    </>
  );
}

export default CalculatorStep3;
