import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from '../utils/axios';
import styles from '../styles/HealthReportPage.module.css';
import TopNavbar from '../components/TopNavbar';
import BottomNavbar from '../components/BottomNavigationBar';
import Notification from '../components/Notification';
import { NotificationProvider } from '../context/NotificationContext';

const HealthReportsPage = () => {
  const navigate = useNavigate();
  const [reports, setReports] = useState([]);
  const [notification, setNotification] = useState('');
  const [loading, setLoading] = useState(true);

  // 顯示通知
  const showNotification = (msg) => {
    setNotification(msg);
  };

  // 隱藏通知
  const hideNotification = () => {
    setNotification('');
  };

  // 獲取健康報告列表
  useEffect(() => {
    const fetchReports = async () => {
      try {
        setLoading(true);
        const res = await axios.get('/ocr/health-reports/');
        setReports(res.data);
      } catch (err) {
        console.error('讀取報告失敗', err);
        showNotification('讀取報告失敗');
      } finally {
        setLoading(false);
      }
    };
    
    fetchReports();
  }, []);

  // 查看報告詳情
  const handleViewReport = (report) => {
    // 將報告數據存儲到 sessionStorage 以便在詳情頁面使用
    sessionStorage.setItem('currentReport', JSON.stringify(report));
    navigate(`/health-report/${report.id}`);
  };

  // 前往上傳頁面
  const handleUploadClick = () => {
    navigate('/health-report/upload');
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return `${date.getMonth() + 1}月${date.getDate()}日`;
  };

  return (
    <NotificationProvider>
      <div className={styles.container}>
        <TopNavbar />
        
        <div className={styles.content}>
          {/* 標題列 */}
          <div className={styles.header}>
            <div className={styles.titleSection}>
              <h1 className={styles.title}>健康報告</h1>
            </div>
          </div>
          
          <div className={styles.divider}></div>

          {/* 檢查類型選擇 */}
          <div className={styles.selectContainer}>
            <select className={styles.select} disabled value="血液檢查報告">
              <option>血液檢查報告</option>
            </select>
          </div>

          {loading ? (
            <div className={styles.loadingContainer}>
              載入中...
            </div>
          ) : (
            <>
              {/* 健康報告列表 */}
              <div className={styles.reportList}>
                {reports.length === 0 ? (
                  <div className={styles.emptyState}>
                    <img 
                      src="/assets/icon/PetpageHealthReportButton.png" 
                      alt="空狀態" 
                      className={styles.emptyIcon}
                    />
                    <p>尚無健康報告記錄</p>
                  </div>
                ) : (
                  reports.map((report) => (
                    <div 
                      key={report.id} 
                      className={styles.reportItem}
                      onClick={() => handleViewReport(report)}
                    >
                      <div className={styles.reportIcon}>
                        <img 
                          src="/assets/icon/PetpageHealthReportButton.png" 
                          alt="健康報告"
                        />
                      </div>
                      
                      <div className={styles.reportContent}>
                        <div className={styles.reportDateRow}>
                          <span className={styles.reportDate}>{formatDate(report.check_date)}</span>
                        </div>
                        <div className={styles.reportInfo}>
                          <span className={styles.reportLabel}>地點：</span>
                          <span className={styles.reportDetail}>{report.check_location || '無'}</span>
                          {report.notes && (
                            <>
                              <span className={styles.reportLabel}>｜備註：</span>
                              <span className={styles.reportDetail}>{report.notes.slice(0, 10)}...</span>
                            </>
                          )}
                        </div>
                      </div>
                      
                      <div className={styles.reportArrow}>
                        ❯
                      </div>
                    </div>
                  ))
                )}
              </div>

              <button className={styles.uploadButton} onClick={handleUploadClick}>
                上傳報告
              </button>
            </>
          )}
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

export default HealthReportsPage;