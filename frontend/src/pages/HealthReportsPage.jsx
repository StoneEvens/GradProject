import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from '../utils/axios';
import styles from '../styles/HealthReportPage.module.css';
import TopNavbar from '../components/TopNavbar';
import BottomNavbar from '../components/BottomNavigationBar';
import { NotificationProvider } from '../context/NotificationContext';
import { getUserPets } from '../services/petService';

const HealthReportsPage = () => {
  const { t } = useTranslation('health');
  const { petId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [pet, setPet] = useState(null);
  const [reports, setReports] = useState([]);

  // 載入資料
  useEffect(() => {
    loadData();
  }, [petId]);

  const loadData = async () => {
    try {
      setLoading(true);

      // 同時載入寵物資料和健康報告
      const [pets, reportsRes] = await Promise.all([
        getUserPets(),
        axios.get('/ocr/health-reports/')
      ]);

      // 設定當前寵物
      const currentPet = pets.find(p => p.pet_id === parseInt(petId));
      if (currentPet) {
        setPet(currentPet);
      }

      // 過濾出當前寵物的健康報告
      const petReports = reportsRes.data.filter(report =>
        report.pet_name === currentPet?.pet_name
      );
      setReports(petReports);

    } catch (error) {
      console.error('讀取資料失敗', error);
      // 可以加上错誤通知
    } finally {
      setLoading(false);
    }
  };

  const handleReportClick = (report) => {
    // 將報告數據存儲到 sessionStorage 以便在詳情頁面使用
    sessionStorage.setItem('currentReport', JSON.stringify(report));
    navigate(`/pet/${petId}/health-report/${report.id}`);
  };

  const handleUploadClick = () => {
    navigate(`/pet/${petId}/health-report/upload`);
  };

  const formatDate = (dateString) => {
    if (!dateString) return t('fields.unknownDate');
    const date = new Date(dateString);
    return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;
  };

  // 翻譯檢查類型
  const getCheckTypeName = (type) => {
    switch(type) {
      case 'cbc':
        return t('checkTypes.cbc');
      case 'biochemistry':
        return t('checkTypes.biochemistry');
      case 'urinalysis':
        return t('checkTypes.urinalysis');
      case 'other':
        return t('checkTypes.other');
      default:
        return t('checkTypes.unknown');
    }
  };

  if (loading) {
    return (
      <NotificationProvider>
        <div className={styles.container}>
          <TopNavbar />
          <div className={styles.loadingContainer}>
            {t('reports.loading')}
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
              <img
                src={pet?.headshot_url || '/assets/icon/DefaultAvatar.jpg'}
                alt={pet?.pet_name}
                className={styles.petAvatar}
              />
              <span className={styles.title}>{t('reports.title')}</span>
            </div>
            <button className={styles.newButton} onClick={handleUploadClick}>
              {t('reports.upload')}
            </button>
          </div>

          <div className={styles.divider}></div>

          {/* 健康報告列表 */}
          <div className={styles.reportList}>
            {reports.length === 0 ? (
              <div className={styles.emptyState}>
                <img
                  src="/assets/icon/SearchNoResult.png"
                  alt={t('reports.noReports')}
                  className={styles.emptyIcon}
                />
                <p>{t('reports.noReports')}</p>
              </div>
            ) : (
              reports.map((report) => (
                <div
                  key={report.id}
                  className={styles.reportItem}
                  onClick={() => handleReportClick(report)}
                >
                  <div className={styles.reportIcon}>
                    <img
                      src="/assets/icon/PetpageHealthReportButton.png"
                      alt={t('detail.title')}
                    />
                  </div>

                  <div className={styles.reportContent}>
                    <div className={styles.reportTitleRow}>
                      <span className={styles.reportTitle}>
                        {getCheckTypeName(report.check_type)}
                      </span>
                    </div>
                    <div className={styles.reportInfo}>
                      <span className={styles.reportLabel}>{t('fields.checkDate')}：</span>
                      <span className={styles.reportDate}>
                        {formatDate(report.check_date)}
                      </span>
                      {report.check_location && (
                        <>
                          <span className={styles.reportLabel}>｜{t('fields.checkLocation')}：</span>
                          <span className={styles.reportDetail}>{report.check_location}</span>
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
        </div>

        <BottomNavbar />
      </div>
    </NotificationProvider>
  );
};

export default HealthReportsPage;