import React, { useState } from 'react';
import Header from '../components/Header';
import BottomNavigationBar from '../components/BottomNavigationBar';
import '../components/Header.css';
import '../components/BottomNavigationBar.css';
import './HealthReport.css';

const CATEGORIES = {
  CBC: {
    label: '全血計數',
    fields: ['紅血球', '血色素', '血球容積比']
  },
  BIO: {
    label: '血液生化檢查',
    fields: ['白蛋白', '球蛋白', '總蛋白']
  },
  URINE: {
    label: '尿液分析',
    fields: ['尿比重', '尿液酸鹼值', '尿中紅血球']
  }
};

const HealthReport = () => {
  /* 當前頁：list | upload | view */
  const [page, setPage] = useState('list');
  const [reports, setReports] = useState([]);              // 所有報告
  const [current, setCurrent] = useState(null);           // 正在查看的報告

  // ➜ 進入上傳頁
  const toUpload = () => {
    setCurrent({ date: '', cat: 'CBC', values: {}, note: '', file: null });
    setPage('upload');
  };

  // ➜ 確認上傳
  const confirmUpload = () => {
    setReports([...reports, { ...current, id: Date.now() }]);
    setPage('list');
  };

  // ➜ 查看頁
  const viewReport = (rep) => {
    setCurrent(rep);
    setPage('view');
  };

  // ➜ 刪除
  const deleteReport = (id) => {
    setReports(reports.filter((r) => r.id !== id));
    setPage('list');
  };

  /* ────── Render 區 ────── */
  return (
    <>
      <Header />
      <div className="hr-container">
        {page === 'list' && (
          <ListPage reports={reports} onUpload={toUpload} onRowClick={viewReport} />
        )}
        {page === 'upload' && (
          <UploadPage
            draft={current}
            setDraft={setCurrent}
            onCancel={() => setPage('list')}
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

/* ────────────────────────────────────────────────  列表頁  */
const ListPage = ({ reports, onUpload, onRowClick }) => (
  <>
    <h1 className="hr-title">健康報告</h1>
    <select className="hr-select" disabled value="血液檢查報告" /> {/* 目前僅示範一類，可拓展 */}

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
            <tr key={r.id} onClick={() => onRowClick(r)}>
              <td>{r.date}</td>
              <td>{new Date(r.id).toLocaleDateString()}</td>
              <td>獸醫醫院</td>
              <td>{r.note.slice(0, 5)}...</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>

    <button className="hr-upload-btn" onClick={onUpload}>上傳</button>
  </>
);

/* ────────────────────────────────────────────────  上傳頁  */
const UploadPage = ({ draft, setDraft, onCancel, onConfirm }) => {
  const { cat, date, values, note } = draft;
  const fields = CATEGORIES[cat].fields;
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

      <div className="hr-date-row">
        檢查時間：{' '}
        <input
          type="date"
          value={date}
          onChange={(e) => setDraft({ ...draft, date: e.target.value })}
        />
      </div>

      <div className="hr-section">
        <div className="hr-section-title">數值記錄</div>
        {fields.map((f) => (
          <div className="hr-field-row" key={f}>
            <span className="hr-field-label">{f}：</span>
            <input
              className="hr-field-input"
              value={values[f] || ''}
              onChange={(e) => setDraft({ ...draft, values: { ...values, [f]: e.target.value } })}
            />
          </div>
        ))}
      </div>

      <div className="hr-section">
        <div className="hr-section-title">檔案上傳</div>
        <textarea
          className="hr-note"
          placeholder="請輸入您想補充的描述"
          value={note}
          onChange={(e) => setDraft({ ...draft, note: e.target.value })}
        />
      </div>

      <div className="hr-btn-row">
        <button className="btn confirm" onClick={onConfirm}>確認</button>
      </div>
    </>
  );
};

/* ────────────────────────────────────────────────  查看頁  */
const ViewPage = ({ data, onBack, onDelete }) => {
  const { cat, date, values, note } = data;
  const fields = CATEGORIES[cat].fields;

  return (
    <>
      <h1 className="hr-title">察看健康報告</h1>
      <div className="record-pet-subtitle wide">{CATEGORIES[cat].label}</div>
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
        <div className="hr-section-title">檔案上傳</div>
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