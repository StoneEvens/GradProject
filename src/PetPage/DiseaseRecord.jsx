import React, { useState } from 'react';
import Header from '../components/Header';
import BottomNavigationBar from '../components/BottomNavigationBar';
import '../components/Header.css';
import '../components/BottomNavigationBar.css';
import './DiseaseRecord.css';
import Calendar from './components/Calendar';
import SummaryPage from './components/SummaryPage';

const DiseaseRecord = () => {
  const [page, setPage] = useState('form');
  const [petName, setPetName] = useState('胖胖');
  const [aiText, setAiText] = useState('');

  return (
    <>
      <Header />
      <div className="record-page-container">
        <div className="record-header">
          <h1 className="record-title">上傳病程記錄</h1>
          {page === 'form' && (
            <select
              className="record-pet-selector"
              value={petName}
              onChange={(e) => setPetName(e.target.value)}
            >
              <option value="胖胖">胖胖</option>
              <option value="喵喵">喵喵</option>
              <option value="阿福">阿福</option>
            </select>
          )}
        </div>

        {page === 'form' ? (
          <>
            <div className="record-section">
              <div className="record-section-title">撰寫內容</div>
              <input type="text" className="input-box" placeholder="標題" />
              <textarea
                className="input-box"
                placeholder="內文"
                value={aiText}
                onChange={(e) => setAiText(e.target.value)}
              />
            </div>

            <div className="record-status-group">
              <button className="btn selected">已就醫</button>
              <button className="btn">未就醫</button>
            </div>

            <div className="record-section">
              <label className="record-label">病因：</label>
              <input type="text" className="input-box" />
              <div className="record-status-group">
                <button className="btn">已痊癒</button>
                <button className="btn selected">治療中</button>
              </div>
            </div>

            <p className="record-date-instruction">請選擇日期</p>
            <Calendar />

            <button className="record-next-btn" onClick={() => setPage('summary')}>下一頁</button>
          </>
        ) : (
          <SummaryPage petName={petName} aiText={aiText} setAiText={setAiText} />
        )}
      </div>
      <BottomNavigationBar />
    </>
  );
};

export default DiseaseRecord;