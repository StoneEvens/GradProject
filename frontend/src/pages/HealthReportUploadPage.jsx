import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from '../utils/axios';
import styles from '../styles/HealthReportPage.module.css';
import TopNavbar from '../components/TopNavbar';
import BottomNavbar from '../components/BottomNavigationBar';
import Notification from '../components/Notification';
import { NotificationProvider } from '../context/NotificationContext';
import { getUserPets } from '../services/petService';

const CATEGORIES = {
  cbc: {
    key: 'cbc',
    fields: ['紅血球計數', '白血球計數', '血紅蛋白', '血比容', '平均紅血球體積', '平均紅血球血紅蛋白量', '平均紅血球血紅蛋白濃度', '紅血球分布寬度', '嗜中性球計數', '淋巴球計數', '單核球計數', '嗜酸性球計數', '嗜鹼性球計數', '血小板計數', '網狀紅血球計數']
  },
  biochemistry: {
    key: 'biochemistry',
    fields: ['白蛋白', '球蛋白', '總蛋白', '丙氨酸轉氨酶', '天門冬酸轉氨酶', '鹼性磷酸酶', '血中尿素氮', '肌酸酐', '葡萄糖', '磷']
  },
  urinalysis: {
    key: 'urinalysis',
    fields: ['尿比重', '尿液酸鹼值', '尿中紅血球', '尿中白血球', '尿蛋白／肌酐比值']
  },
  other: {
    key: 'other',
    fields: []
  }
};

const HealthReportUploadPage = () => {
  const { t, i18n } = useTranslation('health');
  const { petId } = useParams();
  const navigate = useNavigate();
  const [notification, setNotification] = useState('');
  const [pet, setPet] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [ocrData, setOcrData] = useState(null);
  const [loading, setLoading] = useState(true);

  // 表單資料
  const [formData, setFormData] = useState({
    category: 'cbc',
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

  // 翻譯血液檢測項目
  const translateFieldName = (fieldName) => {
    return t(`bloodFields.${fieldName}`, { defaultValue: fieldName });
  };

  // 格式化日期顯示
  const formatDateDisplay = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${month}/${day}`;
  };

  // 載入寵物資料
  useEffect(() => {
    loadPetData();
  }, [petId]);

  const loadPetData = async () => {
    try {
      setLoading(true);
      const pets = await getUserPets();
      const currentPet = pets.find(p => p.pet_id === parseInt(petId));
      if (currentPet) {
        setPet(currentPet);
      }
    } catch (error) {
      console.error('載入寵物資料失敗', error);
      showNotification(t('reports.petDataFailed'));
    } finally {
      setLoading(false);
    }
  };

  // 處理 OCR 上傳
  const handleOCRUpload = async (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    setUploading(true);
    try {
      const uploadFormData = new FormData();
      uploadFormData.append('pet_id', petId);
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
      showNotification(t('upload.ocrSuccess'));
    } catch (err) {
      console.error('OCR 辨識失敗', err);
      showNotification(t('upload.ocrFailed'));
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
      showNotification(t('upload.selectDate'));
      return;
    }

    try {
      const mergedValues = { ...ocrData, ...formData.values };

      const payload = {
        pet_id: petId,
        check_date: formData.date,
        check_type: formData.category,
        check_location: formData.location || '',
        notes: formData.note || '',
        data: JSON.stringify(mergedValues),
      };

      await axios.post('/ocr/upload/', payload, {
        headers: { 'Content-Type': 'application/json' },
      });

      showNotification(t('upload.uploadSuccess'));

      // 延遲後返回列表頁
      setTimeout(() => {
        navigate(`/pet/${petId}/health-reports`);
      }, 1500);
    } catch (error) {
      console.error('上傳失敗', error);
      showNotification(t('upload.uploadFailed'));
    }
  };

  // 返回列表頁
  const handleCancel = () => {
    navigate(`/pet/${petId}/health-reports`);
  };

  const currentFields = CATEGORIES[formData.category].fields;

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
          {/* 標題列 - 仿照 CreateDiseaseArchivePage */}
          <div className={styles.header}>
            <div className={styles.titleSection}>
              <img
                src={pet?.headshot_url || '/assets/icon/DefaultAvatar.jpg'}
                alt={pet?.pet_name}
                className={styles.petAvatar}
              />
              <span className={styles.title}>{t('upload.title')}</span>
            </div>
          </div>

          <div className={styles.divider}></div>

          <div className={styles.uploadContainer}>

            {/* 基本資訊區塊 - 每個欄位一行，標籤和輸入框在同一行 */}
            <div className={styles.formInlineContainer}>
              <div className={`${styles.formInlineGroup} ${i18n.language === 'en' ? styles.formStackedGroup : ''}`}>
                <label className={styles.inlineLabel}>{t('fields.checkType')}</label>
                <select
                  className={styles.inlineSelect}
                  value={formData.category}
                  onChange={handleCategoryChange}
                >
                  {Object.entries(CATEGORIES).map(([key, obj]) => (
                    <option value={key} key={key}>{t(`checkTypes.${obj.key}`)}</option>
                  ))}
                </select>
              </div>

              <div className={`${styles.formInlineGroup} ${i18n.language === 'en' ? styles.formStackedGroup : ''}`}>
                <label className={styles.inlineLabel}>{t('fields.checkDate')}</label>
                <div className={styles.dateInputWrapper}>
                  <input
                    type="date"
                    className={styles.inlineInput}
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  />
                  <span className={styles.datePlaceholder}>
                    {formData.date ? formatDateDisplay(formData.date) : t('common.selectDate')}
                  </span>
                </div>
              </div>

              <div className={`${styles.formInlineGroup} ${i18n.language === 'en' ? styles.formStackedGroup : ''}`}>
                <label className={styles.inlineLabel}>{t('fields.checkLocation')}</label>
                <input
                  type="text"
                  className={styles.inlineInput}
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  placeholder={t('edit.enterLocation')}
                />
              </div>
            </div>

            {/* OCR 上傳區域與數值記錄合併 */}
            <div className={styles.ocrContainer}>
              <div className={`${styles.ocrInlineGroup} ${i18n.language === 'en' ? styles.formStackedGroup : ''}`}>
                <label className={styles.ocrLabel}>{t('fields.ocrUpload')}</label>
                <div className={styles.ocrButtonWrapper}>
                  <input
                    id="ocr-upload-input"
                    type="file"
                    accept="image/*,application/pdf"
                    style={{ display: 'none' }}
                    onChange={handleOCRUpload}
                  />
                  <button
                    type="button"
                    className={styles.ocrButton}
                    onClick={() => document.getElementById('ocr-upload-input').click()}
                    disabled={uploading}
                  >
                    <span className={styles.ocrButtonText}>
                      {uploading ? t('upload.uploading') : t('upload.uploadReport')}
                    </span>
                  </button>
                </div>
              </div>

              {/* 數值記錄區域（保持標籤） */}
              {currentFields.length > 0 && (
                <div className={styles.valuesInlineContainer}>
                  {currentFields.map((field) => {
                    const isEnglish = i18n.language === 'en';

                    return (
                      <div className={`${styles.formInlineGroup} ${isEnglish ? styles.formStackedGroup : ''}`} key={field}>
                        <label className={styles.valueLabel}>{translateFieldName(field)}</label>
                        <input
                          className={styles.valueInput}
                          value={formData.values[field] || ''}
                          onChange={(e) => handleValueChange(field, e.target.value)}
                          placeholder={t('edit.enterValue')}
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 備註區域 */}
            <div className={styles.notesContainer}>
              <div className={styles.notesInlineGroup}>
                <textarea
                  className={styles.notesTextarea}
                  placeholder={t('edit.enterNotes')}
                  value={formData.note}
                  onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                />
              </div>
            </div>

            <div className={styles.actionButtons}>
              <button className={styles.cancelButton} onClick={handleCancel}>
                {t('upload.cancel')}
              </button>
              <button className={styles.createButton} onClick={handleSubmit}>
                {t('upload.submit')}
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