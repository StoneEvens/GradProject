import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from '../utils/axios';
import styles from '../styles/HealthReportPage.module.css';
import TopNavbar from '../components/TopNavbar';
import BottomNavbar from '../components/BottomNavigationBar';
import Notification from '../components/Notification';
import { NotificationProvider } from '../context/NotificationContext';
import { getUserPets } from '../services/petService';

const CATEGORIES = {
  CBC: {
    label: '全血計數',
    fields: ['紅血球計數', '白血球計數', '血紅蛋白']
  },
  BIO: {
    label: '血液生化檢查',
    fields: ['血比容', '平均紅血球體積', '紅血球分布寬度']
  },
  URINE: {
    label: '尿液分析',
    fields: ['尿比重', '尿液酸鹼值', '尿中紅血球']
  }
};

const HealthReportUploadPage = () => {
  const navigate = useNavigate();
  const [notification, setNotification] = useState('');
  const [currentPetId, setCurrentPetId] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [ocrData, setOcrData] = useState(null);
  
  // 表單資料
  const [formData, setFormData] = useState({
    category: 'CBC',
    date: '',
    location: '',
    values: {},
    note: ''
  });

  // 顯示通知
  const showNotification = (msg) => {
    setNotification(msg);
  };

  // 隱藏通知
  const hideNotification = () => {
    setNotification('');
  };

  // 獲取當前寵物ID
  useEffect(() => {
    const fetchCurrentPet = async () => {
      try {
        const pets = await getUserPets();
        if (pets && pets.length > 0) {
          setCurrentPetId(pets[0].pet_id);
        }
      } catch (error) {
        console.error('獲取寵物資料失敗:', error);
        showNotification('無法獲取寵物資料');
      }
    };
    fetchCurrentPet();
  }, []);

  // 處理 OCR 上傳
  const handleOCRUpload = async (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    setUploading(true);
    try {
      const uploadFormData = new FormData();
      uploadFormData.append('pet_id', currentPetId || 1);
      uploadFormData.append('image', selectedFile);

      const res = await axios.post('/ocr/report/upload/', uploadFormData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const extracted = res.data.extracted_results || {};
      setOcrData(extracted);

      // 更新表單數值
      const fields = CATEGORIES[formData.category].fields;
      const newValues = { ...formData.values };
      
      for (let field of fields) {
        if (extracted[field]?.result) {
          newValues[field] = `${extracted[field].result} ${extracted[field].unit || ''}`;
        }
      }
      
      setFormData({ ...formData, values: newValues });
      showNotification('圖片辨識成功');
    } catch (err) {
      console.error('OCR 辨識失敗', err);
      showNotification('辨識失敗，請檢查圖片是否清晰或格式正確');
    } finally {
      setUploading(false);
    }
  };

  // 處理類別改變
  const handleCategoryChange = (e) => {
    setFormData({
      ...formData,
      category: e.target.value,
      values: {} // 清空數值
    });
  };

  // 處理數值輸入
  const handleValueChange = (field, value) => {
    setFormData({
      ...formData,
      values: {
        ...formData.values,
        [field]: value
      }
    });
  };

  // 提交表單
  const handleSubmit = async () => {
    if (!formData.date) {
      showNotification('請選擇檢查日期');
      return;
    }
    
    if (!currentPetId) {
      showNotification('無法獲取寵物資料，請稍後再試');
      return;
    }

    try {
      const mergedValues = { ...ocrData, ...formData.values };

      const payload = {
        pet_id: currentPetId,
        check_date: formData.date,
        check_type: formData.category.toLowerCase(),
        check_location: formData.location || '',
        notes: formData.note || '',
        data: JSON.stringify(mergedValues),
      };

      await axios.post('/ocr/upload/', payload, {
        headers: { 'Content-Type': 'application/json' },
      });

      showNotification('上傳成功');
      
      // 延遲後返回列表頁
      setTimeout(() => {
        navigate('/health-reports');
      }, 1500);
    } catch (error) {
      console.error('上傳失敗', error);
      showNotification('上傳失敗，請檢查表單或伺服器狀態');
    }
  };

  // 返回列表頁
  const handleCancel = () => {
    navigate('/health-reports');
  };

  const currentFields = CATEGORIES[formData.category].fields;

  return (
    <NotificationProvider>
      <div className={styles.container}>
        <TopNavbar />
        <div className={styles.content}>
          {/* 標題列 */}
          <div className={styles.header}>
            <div className={styles.titleSection}>
              <h1 className={styles.title}>上傳健康報告</h1>
            </div>
          </div>
          
          <div className={styles.divider}></div>

          <div className={styles.uploadContainer}>
            
            <div className={styles.formGroup}>
              <label className={styles.label}>檢查類型</label>
              <select
                className={styles.select}
                value={formData.category}
                onChange={handleCategoryChange}
              >
                {Object.entries(CATEGORIES).map(([key, obj]) => (
                  <option value={key} key={key}>{obj.label}</option>
                ))}
              </select>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>檢查時間</label>
              <input
                type="date"
                className={styles.input}
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>檢查地點</label>
              <input
                type="text"
                className={styles.input}
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                placeholder="請輸入檢查地點"
              />
            </div>

            <div className={styles.ocrUploadSection}>
              <input
                id="ocr-upload-input"
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handleOCRUpload}
              />
              <button
                type="button"
                className={styles.ocrButton}
                onClick={() => document.getElementById('ocr-upload-input').click()}
                disabled={uploading}
              >
                {uploading ? '辨識中...' : '上傳健康報告圖片辨識'}
              </button>
            </div>

            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>數值記錄</h3>
              {currentFields.map((field) => (
                <div className={styles.formGroup} key={field}>
                  <label className={styles.label}>{field}</label>
                  <input
                    className={styles.input}
                    value={formData.values[field] || ''}
                    onChange={(e) => handleValueChange(field, e.target.value)}
                    placeholder="請輸入數值"
                  />
                </div>
              ))}
            </div>

            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>備註</h3>
              <textarea
                className={styles.textarea}
                placeholder="請輸入您想補充的描述"
                value={formData.note}
                onChange={(e) => setFormData({ ...formData, note: e.target.value })}
              />
            </div>

            <div className={styles.buttonContainer}>
              <button className={styles.confirmButton} onClick={handleSubmit}>
                確認上傳
              </button>
              <button className={styles.cancelButton} onClick={handleCancel}>
                返回列表
              </button>
            </div>
          </div>
        </div>
        <BottomNavbar />
        {notification && (
          <Notification 
            message={notification} 
            onClose={hideNotification} 
          />
        )}
      </div>
    </NotificationProvider>
  );
};

export default HealthReportUploadPage;