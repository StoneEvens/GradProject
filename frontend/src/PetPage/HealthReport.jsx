import React, { useState } from 'react';
import { useEffect } from 'react';
import axios from 'axios';
import Header from '../components/Header';
import BottomNavigationBar from '../components/BottomNavigationBar';
import '../styles/Header.css'
import '../styles/BottomNavbar.module.css';
import './HealthReport.css';

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

const HealthReport = () => {
  const [page, setPage] = useState('list');
  const [reports, setReports] = useState([]);              
  const [current, setCurrent] = useState(null);           

  const toUpload = () => {
    setCurrent({ date: '', cat: 'CBC', values: {}, note: '', check_location: '' });
    setPage('upload');
  };

  const confirmUpload = () => {
    setPage('list'); // 只負責切換頁面，新增到資料庫由 handleSubmit 做
  };

  const viewReport = (rep) => {
    // setCurrent(rep);
    setCurrent({
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
    <>
      <Header />
      <div className="hr-container">
        {page === 'list' && (
          <ListPage reports={reports} setReports={setReports} onUpload={toUpload} onRowClick={viewReport} />
        )}
        {page === 'upload' && (
          <UploadPage
            draft={current}
            setDraft={setCurrent}
            onConfirm={confirmUpload}
          />
        )}
        {page === 'view' && (
          <ViewPage
            data={current}
            onBack={() => setPage('list')}
            onDelete={() => deleteReport(current.id)}
          />
        )}
      </div>
      <BottomNavigationBar />
    </>
  );
};

const ListPage = ({ reports, setReports, onUpload, onRowClick }) => {
  useEffect(() => {
    axios.get('http://127.0.0.1:8000/api/v1/ocr/health-reports/')
      .then(res => setReports(res.data))
      .catch(err => console.error('讀取報告失敗', err));
  }, []);

  const handleRowClick = (r) => {
    console.log("點擊的報告資料：", r);  // Debug
    onRowClick(r);
  };

  return (
    <>
      <h1 className="hr-title">健康報告</h1>
      <select className="hr-select" disabled value="血液檢查報告" />

      <div className="hr-table-wrapper">
        <table className="hr-table">
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
              <tr key={r.id} onClick={() => handleRowClick(r)}>
                <td>{r.check_date}</td>
                <td>{r.created_at}</td>
                <td>{r.check_location || '無'}</td>
                <td>{r.notes.slice(0, 5)}...</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button className="hr-upload-btn" onClick={onUpload}>上傳</button>
    </>
  );
};


// const ListPage = ({ reports, onUpload, onRowClick }) => (
//   <>
//     <h1 className="hr-title">健康報告</h1>
//     <select className="hr-select" disabled value="血液檢查報告" /> 

//     <div className="hr-table-wrapper">
//       <table className="hr-table">
//         <thead>
//           <tr>
//             <th>檢查日期</th>
//             <th>上傳日期</th>
//             <th>檢查地點</th>
//             <th>備註</th>
//           </tr>
//         </thead>
//         <tbody>
//           {reports.map((r) => (
//             <tr key={r.id} onClick={() => onRowClick(r)}>
//               <td>{r.date}</td>
//               <td>{new Date(r.id).toLocaleDateString()}</td>
//               <td>{r.check_location || '獸醫醫院'}</td>
//               <td>{r.note.slice(0, 5)}...</td>
//             </tr>
//           ))}
//         </tbody>
//       </table>
//     </div>

//     <button className="hr-upload-btn" onClick={onUpload}>上傳</button>
//   </>
// );

const UploadPage = ({ draft, setDraft, onConfirm }) => {
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
      formData.append('pet_id', 1);
      formData.append('image', selectedFile);

      const res = await axios.post('http://127.0.0.1:8000/api/v1/ocr/report/upload/', formData, {
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
    } catch (err) {
      console.error('OCR 辨識失敗', err);
      alert('辨識失敗，請檢查圖片是否清晰或格式正確');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async () => {
    try {
      // 把 OCR 擷取與手動輸入的 values 合併
      const mergedValues = { ...ocrData, ...values };

      const payload = {
        pet_id: 1,
        check_date: draft.date,
        check_type: draft.cat.toLowerCase(),
        check_location: draft.check_location || '',
        notes: draft.note || '',
        data: JSON.stringify(mergedValues),
      };

      // 只呼叫正式 API
      await axios.post('http://127.0.0.1:8000/api/v1/ocr/upload/', payload, {
        headers: { 'Content-Type': 'application/json' },
      });

      alert('上傳成功');
      onConfirm();  // 回到列表
    } catch (error) {
      console.error('上傳失敗', error);
      alert('上傳失敗，請檢查表單或伺服器狀態');
    }
  };


  return (
    <>
      <h1 className="hr-title">上傳健康報告</h1>
      <select
        className="hr-select"
        value={cat}
        onChange={(e) => setDraft({ ...draft, cat: e.target.value, values: {} })}
      >
        {Object.entries(CATEGORIES).map(([key, obj]) => (
          <option value={key} key={key}>{obj.label}</option>
        ))}
      </select>

      <div className="hr-field-row">
        <span className="hr-field-label">檢查時間：</span>
        <input
          type="date"
          className="hr-field-input"
          value={draft.date}
          onChange={(e) => setDraft({ ...draft, date: e.target.value })}
        />
      </div>

      <div className="hr-field-row">
        <span className="hr-field-label">檢查地點：</span>
        <input
          type="text"
          className="hr-field-input"
          value={draft.check_location || ''}
          onChange={(e) => setDraft({ ...draft, check_location: e.target.value })}
          placeholder="請輸入檢查地點"
        />
      </div>

      <div className="hr-ocr-upload-row">
        <input
          id="ocr-upload-input"
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleOCRUpload}
        />
        <button
          type="button"
          className="hr-ocr-upload-btn"
          onClick={() => document.getElementById('ocr-upload-input').click()}
        >
          上傳健康報告圖片辨識
        </button>
        {uploading && <div className="hr-ocr-loading">辨識中...</div>}
      </div>

      <div className="hr-section">
        <div className="hr-section-title">數值記錄</div>
        {fields.map((f) => (
          <div className="hr-field-row" key={f}>
            <span className="hr-field-label">{f}：</span>
            <input
              className="hr-field-input"
              value={values[f] || ''}
              onChange={(e) =>
                setDraft({ ...draft, values: { ...values, [f]: e.target.value } })
              }
            />
          </div>
        ))}
      </div>

      <div className="hr-section">
        <div className="hr-section-title">備註</div>
        <textarea
          className="hr-note"
          placeholder="請輸入您想補充的描述"
          value={note}
          onChange={(e) => setDraft({ ...draft, note: e.target.value })}
        />
      </div>

      <div className="hr-btn-row">
        <button className="btn confirm" onClick={handleSubmit}>確認</button>
      </div>
    </>
  );
};

const ViewPage = ({ data, onBack, onDelete }) => {
  const { cat, date, values, note } = data;
  const fields = CATEGORIES[cat].fields;

  return (
    <>
      <h1 className="hr-title">察看健康報告</h1>
      <div className="hr-date-row">{CATEGORIES[cat].label}</div>
      <div className="hr-date-row">檢查時間： {date}</div>

      <div className="hr-section">
        <div className="hr-section-title">數值記錄</div>
        {fields.map((f) => (
          <div className="hr-field-row" key={f}>
            <span className="hr-field-label">{f}：</span>
            <span>{values[f]}</span>
          </div>
        ))}
      </div>

      <div className="hr-section">
        <div className="hr-section-title">備註</div>
        <textarea className="hr-note" readOnly value={note} />
      </div>

      <div className="hr-btn-col">
        <button className="btn edit" onClick={onBack}>修改</button>
        <button className="btn delete" onClick={onDelete}>刪除</button>
      </div>
    </>
  );
};

export default HealthReport;
