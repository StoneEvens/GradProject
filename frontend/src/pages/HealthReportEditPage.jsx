import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from '../utils/axios';
import styles from '../styles/HealthReportPage.module.css';
import TopNavbar from '../components/TopNavbar';
import BottomNavbar from '../components/BottomNavigationBar';
import Notification from '../components/Notification';
import { NotificationProvider } from '../context/NotificationContext';
import { getUserPets } from '../services/petService';

const HealthReportEditPage = () => {
  const { t, i18n } = useTranslation('health');
  const navigate = useNavigate();
  const { id, petId } = useParams();
  const [notification, setNotification] = useState('');
  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState(null);
  const [pet, setPet] = useState(null);

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

  // 載入寵物資料
  useEffect(() => {
    const loadPetData = async () => {
      try {
        const pets = await getUserPets();
        const currentPet = pets.find(p => p.pet_id === parseInt(petId));
        if (currentPet) {
          setPet(currentPet);
        }
      } catch (error) {
        console.error('載入寵物資料失敗', error);
        showNotification(t('reports.petDataFailed'));
      }
    };

    if (petId) {
      loadPetData();
    }
  }, [petId]);

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
        showNotification(t('reports.loadFailed'));
        navigate(`/pet/${petId}/health-reports`);
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      loadReportData();
    }
  }, [id, petId, navigate]);

  // 把後端回來的 check_type 中文轉成顯示名稱
  const getCheckTypeName = (type) => {
    if (type.includes('全血') || type === 'cbc') return t('checkTypes.cbc');
    if (type.includes('生化') || type === 'bio') return t('checkTypes.biochemistry');
    if (type.includes('尿液') || type === 'urine') return t('checkTypes.urinalysis');
    return type;
  };

  const defaultFields = ['紅血球計數', '白血球計數', '血紅蛋白', '血比容', '平均紅血球體積', '平均紅血球血紅蛋白量', '平均紅血球血紅蛋白濃度', '紅血球分布寬度', '嗜中性球計數', '淋巴球計數', '單核球計數', '嗜酸性球計數', '嗜鹼性球計數', '血小板計數', '網狀紅血球計數'];

  // 翻譯血液檢測項目
  const translateFieldName = (fieldName) => {
    return t(`bloodFields.${fieldName}`, { defaultValue: fieldName });
  };

  const extraFields = Object.entries(values || {})
    .filter(([key, val]) => !defaultFields.includes(key) && val !== null && val !== '')
    .map(([key, val]) => ({ key, val }));

  const handleToggle = () => {
    setShowAll((prev) => !prev);
  };

  // 格式化日期為 MM/DD 格式
  const formatDate = (dateString) => {
    if (!dateString) return '';

    // 如果是 YYYY-MM-DD 格式，直接解析避免時區問題
    if (typeof dateString === 'string' && dateString.match(/^\d{4}-\d{2}-\d{2}/)) {
      const [year, month, day] = dateString.split('T')[0].split('-');
      return `${month.padStart(2, '0')}/${day.padStart(2, '0')}`;
    }

    // 其他格式使用 Date 對象處理
    const date = new Date(dateString);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${month}/${day}`;
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

      const response = await axios.put(`/ocr/health-reports/${id}/`, payload, {
        headers: { 'Content-Type': 'application/json' },
      });

      showNotification(t('edit.updateSuccess'));

      // 延遲後返回詳情頁
      setTimeout(() => {
        sessionStorage.removeItem('currentReport');
        navigate(`/pet/${petId}/health-report/${id}`);
      }, 1500);
    } catch (err) {
      console.error('更新失敗', err);
      showNotification(t('edit.updateFailed'));
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(t('detail.confirmDelete'))) return;

    try {
      await axios.delete(`/ocr/health-reports/${id}/`);
      showNotification(t('detail.deleteSuccess'));
      
      // 延遲後返回列表頁
      setTimeout(() => {
        sessionStorage.removeItem('currentReport');
        navigate(`/pet/${petId}/health-reports`);
      }, 1500);
    } catch (err) {
      console.error('刪除失敗', err);
      showNotification(t('detail.deleteFailed'));
    }
  };

  const handleBack = () => {
    navigate(`/pet/${petId}/health-report/${id}`);
  };

  const renderEditableField = (label, value, key) => {
    const isEnglish = i18n.language === 'en';

    return (
      <div className={`${styles.formInlineGroup} ${isEnglish ? styles.formStackedGroup : ''}`} key={key}>
        <label className={styles.valueLabel}>{translateFieldName(label)}</label>
        <input
          className={styles.valueInput}
          value={typeof value === 'object' ? `${value?.result || ''} ${value?.unit || ''}` : value || ''}
          onChange={(e) => handleInputChange(key, e.target.value)}
          placeholder={t('edit.enterValue')}
        />
      </div>
    );
  };

  if (loading) {
    return (
      <NotificationProvider>
        <div className={styles.container}>
          <TopNavbar />
          <div className={styles.content}>
            <div className={styles.loadingContainer}>
              <p>{t('reports.loading')}</p>
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
              <p>{t('reports.notFound')}</p>
              <button onClick={handleBack} className={styles.cancelButton}>
                {t('reports.backToList')}
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
              <span className={styles.title}>{t('edit.title')} {formatDate(reportData?.check_date)} {t('detail.title')}</span>
            </div>
          </div>

          <div className={styles.divider}></div>

          <div className={styles.uploadContainer}>

            {/* 基本資訊區塊 */}
            <div className={styles.formInlineContainer}>
              <div className={`${styles.formInlineGroup} ${i18n.language === 'en' ? styles.formStackedGroup : ''}`}>
                <label className={styles.inlineLabel}>{t('fields.checkType')}</label>
                <span className={styles.inlineValue}>{getCheckTypeName(reportData.check_type)}</span>
              </div>

              <div className={`${styles.formInlineGroup} ${i18n.language === 'en' ? styles.formStackedGroup : ''}`}>
                <label className={styles.inlineLabel}>{t('fields.checkDate')}</label>
                <span className={styles.inlineValue}>{reportData.check_date}</span>
              </div>

              <div className={`${styles.formInlineGroup} ${i18n.language === 'en' ? styles.formStackedGroup : ''}`}>
                <label className={styles.inlineLabel}>{t('fields.checkLocation')}</label>
                <input
                  type="text"
                  className={styles.inlineInput}
                  value={checkLocation}
                  onChange={(e) => setCheckLocation(e.target.value)}
                  placeholder={t('edit.enterLocation')}
                />
              </div>
            </div>

            {/* 數值記錄區域 */}
            <div className={styles.valuesContainer}>
              <div className={styles.valuesInlineContainer}>
                {defaultFields
                  .filter((field) => {
                    const value = values[field];
                    return value !== null && value !== undefined && value !== '';
                  })
                  .map((field) => renderEditableField(field, values[field], field))}

                {showAll &&
                  extraFields.map(({ key, val }) => renderEditableField(key, val, key))}
              </div>

              {extraFields.length > 0 && (
                <div className={styles.toggleContainer}>
                  <button
                    onClick={handleToggle}
                    className={styles.toggleButton}
                  >
                    <span>{showAll ? t('detail.viewPartial') : t('detail.viewAll')}</span>
                    <span>{showAll ? '▲' : '▼'}</span>
                  </button>
                </div>
              )}
            </div>

            {/* 備註區域 */}
            <div className={styles.notesContainer}>
              <div className={styles.notesInlineGroup}>
                <textarea
                  className={styles.notesTextarea}
                  placeholder={t('edit.enterNotes')}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </div>
            </div>

            <div className={styles.actionButtons}>
              <button className={styles.cancelButton} onClick={handleBack}>{t('edit.back')}</button>
              <button className={styles.createButton} onClick={handleEdit}>{t('edit.update')}</button>
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

export default HealthReportEditPage;