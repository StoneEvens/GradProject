import React, { useState } from 'react';
import Header from '../components/Header';
import BottomNavigationBar from '../components/BottomNavigationBar';
import '../components/Header.css';
import '../components/BottomNavigationBar.css';
import './DiseaseRecord.css';
import Calendar from './components/Calendar';
import SummaryPage from './components/SummaryPage';

const DiseaseRecord = () => {
  const [page, setPage] = useState('form'); // 或 'summary'

  return (
    <>
    <Header />
    <div className="record-container">

      <h1 className="title">上傳病程記錄</h1>

      {page === 'form' ? (
        <>
          <div className="form-section">
            <div className="form-switch">
              <span>疾病內容</span>
            </div>
            <label>
              <input type="text" className="input-box" placeholder='標題'/>
            </label>
            <label>
              <textarea className="input-box" rows="2" placeholder='請填入詳細內容'/>
            </label>
            <div className="status-group">
              <button className="btn selected">已就醫</button>
              <button className="btn">未就醫</button>
            </div>
            <label>
              病因：
              <input type="text" className="input-box" />
            </label>
            <div className="status-group">
              <button className="btn">已痊癒</button>
              <button className="btn selected">治療中</button>
            </div>
          </div>

          <Calendar />

          <button className="next-btn" onClick={() => setPage('summary')}>下一頁</button>
        </>
      ) : (
        <SummaryPage goBack={() => setPage('form')} />
      )}
    </div>
    <BottomNavigationBar />
    </>
  );
};

export default DiseaseRecord;
