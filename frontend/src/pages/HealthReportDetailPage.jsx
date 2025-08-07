import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from '../utils/axios';
import styles from '../styles/HealthReportPage.module.css';
import TopNavbar from '../components/TopNavbar';
import BottomNavbar from '../components/BottomNavigationBar';
import Notification from '../components/Notification';
import { NotificationProvider } from '../context/NotificationContext';

const HealthReportDetailPage = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [notification, setNotification] = useState('');
  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState(null);
  
  // 編輯狀態
  const [values, setValues] = useState({});
  const [note, setNote] = useState('');
  const [checkLocation, setCheckLocation] = useState('');
  const [showAll, setShowAll] = useState(false);

  // 顯示通知
  const showNotification = (msg) => {
    setNotification(msg);
  };

  // 隱藏通知
  const hideNotification = () => {
    setNotification('');
  };

  // 載入報告資料
  useEffect(() => {
    const loadReportData = async () => {
      try {
        setLoading(true);
        
        // 先嘗試從 sessionStorage 獲取資料
        const cachedData = sessionStorage.getItem('currentReport');
        if (cachedData) {
          const data = JSON.parse(cachedData);
          setReportData(data);
          setValues(data.data || {});
          setNote(data.notes || '');
          setCheckLocation(data.check_location || '');
          setLoading(false);
          return;
        }

        // 如果沒有快取資料，從 API 獲取
        const res = await axios.get(`/ocr/health-reports/${id}/`);
        const data = res.data;
        setReportData(data);
        setValues(data.data || {});
        setNote(data.notes || '');
        setCheckLocation(data.check_location || '');
      } catch (err) {
        console.error('載入報告失敗', err);
        showNotification('載入報告失敗');
        navigate('/health-reports');
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      loadReportData();
    }
  }, [id, navigate]);

  // 把後端回來的 check_type 中文轉成顯示名稱
  const getCheckTypeName = (type) => {
    if (type.includes('全血') || type === 'cbc') return '全血計數';
    if (type.includes('生化') || type === 'bio') return '血液生化檢查';
    if (type.includes('尿液') || type === 'urine') return '尿液分析';
    return type;
  };

  const defaultFields = ['紅血球計數', '白血球計數', '血紅蛋白'];

  const extraFields = Object.entries(values || {})
    .filter(([key, val]) => !defaultFields.includes(key) && val !== null && val !== '')
    .map(([key, val]) => ({ key, val }));

  const handleToggle = () => {
    setShowAll((prev) => !prev);
  };

  const handleInputChange = (key, newValue) => {
    setValues((prev) => ({ ...prev, [key]: newValue }));
  };

  const handleEdit = async () => {
    if (!reportData) return;

    try {
      const payload = {
        check_date: reportData.check_date,
        check_type: reportData.check_type,
        check_location: checkLocation || '',
        notes: note || '',
        data: JSON.stringify(values),
      };

      await axios.put(`/ocr/health-reports/${id}/`, payload, {
        headers: { 'Content-Type': 'application/json' },
      });

      showNotification('更新成功');
      
      // 延遲後返回列表頁
      setTimeout(() => {
        sessionStorage.removeItem('currentReport');
        navigate('/health-reports');
      }, 1500);
    } catch (err) {
      console.error('更新失敗', err);
      showNotification('更新失敗，請檢查伺服器或資料格式');
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('確定要刪除此健康報告嗎？')) return;

    try {
      await axios.delete(`/ocr/health-reports/${id}/`);
      showNotification('刪除成功');
      
      // 延遲後返回列表頁
      setTimeout(() => {
        sessionStorage.removeItem('currentReport');
        navigate('/health-reports');
      }, 1500);
    } catch (err) {
      console.error('刪除失敗', err);
      showNotification('刪除失敗，請稍後再試');
    }
  };

  const handleBack = () => {
    sessionStorage.removeItem('currentReport');
    navigate('/health-reports');
  };

  const renderEditableField = (label, value, key) => (
    <div className={styles.formGroup} key={key}>
      <label className={styles.label}>{label}</label>
      <input
        className={styles.input}
        value={typeof value === 'object' ? `${value?.result || ''} ${value?.unit || ''}` : value || ''}
        onChange={(e) => handleInputChange(key, e.target.value)}
        placeholder="請輸入數值"
      />
    </div>
  );

  if (loading) {
    return (
      <NotificationProvider>
        <div className={styles.container}>
          <TopNavbar />
          <div className={styles.content}>
            <div className={styles.loadingContainer}>
              <p>載入中...</p>
            </div>
          </div>
          <BottomNavbar />
        </div>
      </NotificationProvider>
    );
  }

  if (!reportData) {
    return (
      <NotificationProvider>
        <div className={styles.container}>
          <TopNavbar />
          <div className={styles.content}>
            <div className={styles.errorContainer}>
              <p>找不到報告資料</p>
              <button onClick={handleBack} className={styles.cancelButton}>
                返回列表
              </button>
            </div>
          </div>
          <BottomNavbar />
        </div>
      </NotificationProvider>
    );
  }

  return (
    <NotificationProvider>
      <div className={styles.container}>
        <TopNavbar />
        <div className={styles.content}>
          {/* 標題列 */}
          <div className={styles.header}>
            <div className={styles.titleSection}>
              <h1 className={styles.title}>編輯健康報告</h1>
            </div>
          </div>
          
          <div className={styles.divider}></div>

          <div className={styles.viewContainer}>
            
            <div className={styles.infoSection}>
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>檢查類型：</span>
                <span className={styles.infoValue}>{getCheckTypeName(reportData.check_type)}</span>
              </div>
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>檢查時間：</span>
                <span className={styles.infoValue}>{reportData.check_date}</span>
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>檢查地點</label>
                <input
                  className={styles.input}
                  value={checkLocation}
                  onChange={(e) => setCheckLocation(e.target.value)}
                  placeholder="請輸入檢查地點"
                />
              </div>
            </div>

            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>數值記錄</h3>
              
              {defaultFields.map((field) => renderEditableField(field, values[field], field))}

              {showAll &&
                extraFields.map(({ key, val }) => renderEditableField(key, val, key))}

              {extraFields.length > 0 && (
                <div className={styles.toggleContainer}>
                  <button
                    onClick={handleToggle}
                    className={styles.toggleButton}
                  >
                    {showAll ? '▲ 查看部分' : '▼ 查看全部'}
                  </button>
                </div>
              )}
            </div>

            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>備註</h3>
              <textarea
                className={styles.textarea}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="請輸入您想補充的描述"
              />
            </div>

            <div className={styles.buttonRow}>
              <button className={styles.editButton} onClick={handleEdit}>修改</button>
              <button className={styles.deleteButton} onClick={handleDelete}>刪除</button>
              <button className={styles.cancelButton} onClick={handleBack}>取消</button>
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

export default HealthReportDetailPage;