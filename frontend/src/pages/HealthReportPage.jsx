import React, { useState, useEffect } from 'react';
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

const HealthReportPage = () => {
  const [page, setPage] = useState('list');
  const [reports, setReports] = useState([]);              
  const [current, setCurrent] = useState(null);
  const [notification, setNotification] = useState('');
  const [currentPetId, setCurrentPetId] = useState(null);

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
          setCurrentPetId(pets[0].pet_id); // 使用第一隻寵物
        }
      } catch (error) {
        console.error('獲取寵物資料失敗:', error);
        showNotification('無法獲取寵物資料');
      }
    };
    fetchCurrentPet();
  }, []);

  const toUpload = () => {
    setCurrent({ date: '', cat: 'CBC', values: {}, note: '', check_location: '' });
    setPage('upload');
  };

  const confirmUpload = () => {
    setPage('list'); // 只負責切換頁面，新增到資料庫由 handleSubmit 做
  };

  const viewReport = (rep) => {
    setCurrent({
      id: rep.id,
      cat: convertCheckType(rep.check_type),
      date: rep.check_date,
      values: rep.data || {},
      note: rep.notes,
      check_location: rep.check_location || ''
    });
    setPage('view');
  };

  // 把後端回來的 check_type 中文轉成 CATEGORIES key
  const convertCheckType = (type) => {
    if (type.includes('全血')) return 'CBC';
    if (type.includes('生化')) return 'BIO';
    if (type.includes('尿液')) return 'URINE';
    return 'CBC'; // 預設
  };

  const deleteReport = (id) => {
    setReports(reports.filter((r) => r.id !== id));
    setPage('list');
  };

  return (
    <NotificationProvider>
      <div className={styles.container}>
        <TopNavbar />
        <div className={styles.content}>
          {page === 'list' && (
            <ListPage 
              reports={reports} 
              setReports={setReports} 
              onUpload={toUpload} 
              onRowClick={viewReport} 
              showNotification={showNotification}
            />
          )}
          {page === 'upload' && (
            <UploadPage
              draft={current}
              setDraft={setCurrent}
              onConfirm={confirmUpload}
              showNotification={showNotification}
              currentPetId={currentPetId}
            />
          )}
          {page === 'view' && (
            <ViewPage
              data={current}
              onBack={() => setPage('list')}
              onDelete={() => deleteReport(current.id)}
              showNotification={showNotification}
            />
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

const ListPage = ({ reports, setReports, onUpload, onRowClick, showNotification }) => {
  useEffect(() => {
    axios.get('/ocr/health-reports/')
      .then(res => setReports(res.data))
      .catch(err => {
        console.error('讀取報告失敗', err);
        showNotification('讀取報告失敗');
      });
  }, []);

  const handleRowClick = (r) => {
    console.log("點擊的報告資料：", r);  // Debug
    onRowClick(r);
  };

  return (
    <div className={styles.listContainer}>
      <h1 className={styles.title}>健康報告</h1>
      
      <div className={styles.selectContainer}>
        <select className={styles.select} disabled value="血液檢查報告">
          <option>血液檢查報告</option>
        </select>
      </div>

      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>檢查日期</th>
              <th>上傳日期</th>
              <th>檢查地點</th>
              <th>備註</th>
            </tr>
          </thead>
          <tbody>
            {reports.map((r) => (
              <tr key={r.id} onClick={() => handleRowClick(r)} className={styles.tableRow}>
                <td>{r.check_date}</td>
                <td>{r.created_at}</td>
                <td>{r.check_location || '無'}</td>
                <td>{r.notes.slice(0, 5)}...</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button className={styles.uploadButton} onClick={onUpload}>
        上傳報告
      </button>
    </div>
  );
};

const UploadPage = ({ draft, setDraft, onConfirm, showNotification, currentPetId }) => {
  const { cat, date, values, note, check_location } = draft;
  const fields = CATEGORIES[cat].fields;
  const [uploading, setUploading] = useState(false);
  const [ocrData, setOcrData] = useState(null);

  const handleOCRUpload = async (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('pet_id', currentPetId || 1);
      formData.append('image', selectedFile);

      const res = await axios.post('/ocr/report/upload/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const extracted = res.data.extracted_results || {};
      setOcrData(extracted);

      const newValues = { ...values };
      for (let f of fields) {
        if (extracted[f]?.result) {
          newValues[f] = `${extracted[f].result} ${extracted[f].unit || ''}`;
        }
      }
      setDraft({ ...draft, values: newValues });
      showNotification('圖片辨識成功');
    } catch (err) {
      console.error('OCR 辨識失敗', err);
      showNotification('辨識失敗，請檢查圖片是否清晰或格式正確');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async () => {
    if (!draft.date) {
      showNotification('請選擇檢查日期');
      return;
    }
    
    if (!currentPetId) {
      showNotification('無法獲取寵物資料，請稍後再試');
      return;
    }

    try {
      const mergedValues = { ...ocrData, ...values };

      const payload = {
        pet_id: currentPetId,
        check_date: draft.date,
        check_type: draft.cat.toLowerCase(),
        check_location: draft.check_location || '',
        notes: draft.note || '',
        data: JSON.stringify(mergedValues),
      };

      await axios.post('/ocr/upload/', payload, {
        headers: { 'Content-Type': 'application/json' },
      });

      showNotification('上傳成功');
      onConfirm();
    } catch (error) {
      console.error('上傳失敗', error);
      showNotification('上傳失敗，請檢查表單或伺服器狀態');
    }
  };

  return (
    <div className={styles.uploadContainer}>
      <h1 className={styles.title}>上傳健康報告</h1>
      
      <div className={styles.formGroup}>
        <label className={styles.label}>檢查類型</label>
        <select
          className={styles.select}
          value={cat}
          onChange={(e) => setDraft({ ...draft, cat: e.target.value, values: {} })}
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
          value={draft.date}
          onChange={(e) => setDraft({ ...draft, date: e.target.value })}
        />
      </div>

      <div className={styles.formGroup}>
        <label className={styles.label}>檢查地點</label>
        <input
          type="text"
          className={styles.input}
          value={draft.check_location || ''}
          onChange={(e) => setDraft({ ...draft, check_location: e.target.value })}
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
        {fields.map((f) => (
          <div className={styles.formGroup} key={f}>
            <label className={styles.label}>{f}</label>
            <input
              className={styles.input}
              value={values[f] || ''}
              onChange={(e) =>
                setDraft({ ...draft, values: { ...values, [f]: e.target.value } })
              }
            />
          </div>
        ))}
      </div>

      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>備註</h3>
        <textarea
          className={styles.textarea}
          placeholder="請輸入您想補充的描述"
          value={note}
          onChange={(e) => setDraft({ ...draft, note: e.target.value })}
        />
      </div>

      <div className={styles.buttonContainer}>
        <button className={styles.confirmButton} onClick={handleSubmit}>
          確認上傳
        </button>
        <button className={styles.cancelButton} onClick={() => onConfirm()}>
          返回列表
        </button>
      </div>
    </div>
  );
};

const ViewPage = ({ data, onBack, onDelete, showNotification }) => {
  const { id, cat, date, values: initialValues, note: initialNote, check_location: initialLocation } = data;

  const [values, setValues] = useState(initialValues || {});
  const [note, setNote] = useState(initialNote || '');
  const [checkLocation, setCheckLocation] = useState(initialLocation || '');
  const [showAll, setShowAll] = useState(false);

  const defaultFields = ['紅血球計數', '白血球計數', '血紅蛋白'];

  const extraFields = Object.entries(values || {})
    .filter(([key, val]) => !defaultFields.includes(key) && val !== null)
    .map(([key, val]) => ({ key, val }));

  const handleToggle = () => {
    setShowAll((prev) => !prev);
  };

  const handleInputChange = (key, newValue) => {
    setValues((prev) => ({ ...prev, [key]: newValue }));
  };

  const handleEdit = async () => {
    try {
      const payload = {
        check_date: date,
        check_type: cat.toLowerCase(),
        check_location: checkLocation || '',
        notes: note || '',
        data: JSON.stringify(values),
      };

      await axios.put(`/ocr/health-reports/${id}/`, payload, {
        headers: { 'Content-Type': 'application/json' },
      });

      showNotification('更新成功');
      onBack();
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
      onDelete(id);
    } catch (err) {
      console.error('刪除失敗', err);
      showNotification('刪除失敗，請稍後再試');
    }
  };

  const renderEditableField = (label, value, key) => (
    <div className={styles.formGroup} key={key}>
      <label className={styles.label}>{label}</label>
      <input
        className={styles.input}
        value={typeof value === 'object' ? `${value?.result || ''} ${value?.unit || ''}` : value || ''}
        onChange={(e) => handleInputChange(key, e.target.value)}
      />
    </div>
  );

  return (
    <div className={styles.viewContainer}>
      <h1 className={styles.title}>編輯健康報告</h1>
      
      <div className={styles.infoSection}>
        <div className={styles.infoRow}>
          <span className={styles.infoLabel}>檢查類型：</span>
          <span className={styles.infoValue}>{cat}</span>
        </div>
        <div className={styles.infoRow}>
          <span className={styles.infoLabel}>檢查時間：</span>
          <span className={styles.infoValue}>{date}</span>
        </div>
        <div className={styles.formGroup}>
          <label className={styles.label}>檢查地點</label>
          <input
            className={styles.input}
            value={checkLocation}
            onChange={(e) => setCheckLocation(e.target.value)}
          />
        </div>
      </div>

      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>數值記錄</h3>
        
        {defaultFields.map((f) => renderEditableField(f, values[f], f))}

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
        />
      </div>

      <div className={styles.buttonRow}>
        <button className={styles.editButton} onClick={handleEdit}>修改</button>
        <button className={styles.deleteButton} onClick={handleDelete}>刪除</button>
        <button className={styles.cancelButton} onClick={onBack}>取消</button>
      </div>
    </div>
  );
};

export default HealthReportPage;