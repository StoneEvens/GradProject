import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from '../utils/axios';
import styles from '../styles/HealthReportPage.module.css';
import TopNavbar from '../components/TopNavbar';
import BottomNavbar from '../components/BottomNavigationBar';
import Notification from '../components/Notification';
import ConfirmNotification from '../components/ConfirmNotification';
import { NotificationProvider } from '../context/NotificationContext';
import { getUserPets } from '../services/petService';

const HealthReportDetailPage = () => {
  const { t, i18n } = useTranslation('health');
  const navigate = useNavigate();
  const { id, petId } = useParams();
  const [notification, setNotification] = useState('');
  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState(null);
  const [pet, setPet] = useState(null);
  const [showMenu, setShowMenu] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [showConfirmNotification, setShowConfirmNotification] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState('');
  const [confirmAction, setConfirmAction] = useState(null);

  // 顯示通知
  const showNotification = (msg) => {
    setNotification(msg);
  };

  // 隱藏通知
  const hideNotification = () => {
    setNotification('');
  };

  // 顯示確認對話框
  const showConfirmDialog = (message, onConfirm) => {
    setConfirmMessage(message);
    setConfirmAction(() => onConfirm);
    setShowConfirmNotification(true);
  };

  // 處理確認對話框的確認按鈕
  const handleConfirmAction = () => {
    if (confirmAction) {
      confirmAction();
    }
    setShowConfirmNotification(false);
    setConfirmAction(null);
  };

  // 處理確認對話框的取消按鈕
  const handleCancelAction = () => {
    setShowConfirmNotification(false);
    setConfirmAction(null);
  };

  // 點擊外部關閉菜單
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showMenu && !event.target.closest(`.${styles.menuContainer}`)) {
        setShowMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showMenu]);

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
          setLoading(false);
          return;
        }

        // 如果沒有快取資料，從 API 獲取
        const res = await axios.get(`/ocr/health-reports/${id}/`);
        const data = res.data;
        setReportData(data);
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

  const extraFields = Object.entries(reportData?.data || {})
    .filter(([key, val]) => !defaultFields.includes(key) && val !== null && val !== '')
    .map(([key, val]) => ({ key, val }));

  const handleToggle = () => {
    setShowAll((prev) => !prev);
  };

  // 格式化日期為 MM/DD 格式
  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${month}/${day}`;
  };

  const toggleMenu = () => {
    setShowMenu(!showMenu);
  };

  const handleEdit = () => {
    setShowMenu(false);
    navigate(`/pet/${petId}/health-report/${id}/edit`);
  };

  const handleDelete = () => {
    setShowMenu(false);
    showConfirmDialog(
      t('detail.confirmDelete'),
      async () => {
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
      }
    );
  };

  const handleBack = () => {
    sessionStorage.removeItem('currentReport');
    navigate(`/pet/${petId}/health-reports`);
  };

  const renderValueField = (label, value, key) => {
    const isEnglish = i18n.language === 'en';

    return (
      <div className={`${styles.formInlineGroup} ${isEnglish ? styles.formStackedGroup : ''}`} key={key}>
        <label className={styles.valueLabel}>{translateFieldName(label)}</label>
        <span className={styles.inlineValue}>
          {typeof value === 'object' ? `${value?.result || ''} ${value?.unit || ''}` : value || ''}
        </span>
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

        {/* 通知組件 */}
        {notification && (
          <Notification message={notification} onClose={hideNotification} />
        )}

        {/* 確認對話框 */}
        {showConfirmNotification && (
          <ConfirmNotification
            message={confirmMessage}
            onConfirm={handleConfirmAction}
            onCancel={handleCancelAction}
          />
        )}

        <div className={styles.content}>
          {/* 標題區域 */}
          <div className={styles.header}>
            <button className={styles.backButton} onClick={handleBack}>
              ❮
            </button>
            <div className={styles.titleSection}>
              <span className={styles.title}>{formatDate(reportData.check_date)} {t('detail.title')}</span>
            </div>
            <div className={styles.menuContainer}>
              <button className={styles.menuButton} onClick={toggleMenu}>
                <img src="/assets/icon/PostMoreInfo.png" alt={t('button.more', { defaultValue: '更多選項' })} />
              </button>
              {showMenu && (
                <div className={styles.menuDropdown}>
                  <button className={styles.menuItem} onClick={handleEdit}>
                    {t('detail.edit')}
                  </button>
                  <button className={styles.menuItem} onClick={handleDelete}>
                    {t('detail.delete')}
                  </button>
                </div>
              )}
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
                <span className={styles.inlineValue}>{reportData.check_location || t('fields.notFilled')}</span>
              </div>
            </div>

            {/* 數值記錄區域 */}
            <div className={styles.valuesContainer}>
              <div className={styles.valuesInlineContainer}>
                {defaultFields
                  .filter((field) => {
                    const value = reportData.data?.[field];
                    return value !== null && value !== undefined && value !== '';
                  })
                  .map((field) => renderValueField(field, reportData.data?.[field], field))}

                {showAll &&
                  extraFields.map(({ key, val }) => renderValueField(key, val, key))}
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
                <div className={styles.notesDisplay}>
                  {reportData.notes || t('detail.noNotes')}
                </div>
              </div>
            </div>
          </div>
        </div>
        <BottomNavbar />
      </div>
    </NotificationProvider>
  );
};

export default HealthReportDetailPage;