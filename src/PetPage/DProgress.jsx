import React from 'react';
import '.DProgress.css';
import '../components/Header.css';
import '../components/BottomNavigationBar.css';
import Header from '../components/Header';
import BottomNavigationBar from '../components/BottomNavigationBar';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Tooltip,
} from 'chart.js';

import React, { useState } from 'react';
import './MedicalRecordUploader.css';

const NotificationIcon = () => <span role="img" aria-label="notifications">🔔</span>;
const HomeIcon = () => <span role="img" aria-label="home">🏠</span>;
const CalculatorIcon = () => <span role="img" aria-label="calculator">🧮</span>;
const PawIcon = () => <span role="img" aria-label="paw">🐾</span>;
const PlusIcon = () => <span role="img" aria-label="add">➕</span>;
const ListIcon = () => <span role="img" aria-label="list">📋</span>;
const SettingsIcon = () => <span role="img" aria-label="settings">⚙️</span>;


const MedicalRecordUploader = () => {
    // 使用 state 來切換步驟 (頁面1 或 頁面2)
    const [step, setStep] = useState(1);

    // 表單輸入的 state
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [medicalStatus, setMedicalStatus] = useState('已就醫'); // '已就醫' or '未就醫'
    const [illnessCause, setIllnessCause] = useState('');
    const [treatmentStatus, setTreatmentStatus] = useState('治療中'); // '已痊癒' or '治療中'

    // 日曆選擇的 state，預設值為圖片中選取的日期
    const [selectedDates, setSelectedDates] = useState([5, 6, 7, 9, 10, 11, 12, 13]);

    const handleDateClick = (day) => {
        if (!day) return;
        // 點擊日期時，如果已選中則取消，反之則加入
        setSelectedDates(prev =>
            prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
        );
    };

    // 2025年3月的日曆數據 (null 代表空白格子)
    const calendarDays = [
        null, null, null, null, null, null, 1,
        2, 3, 4, 5, 6, 7, 8,
        9, 10, 11, 12, 13, 14, 15,
        16, 17, 18, 19, 20, 21, 22,
        23, 24, 25, 26, 27, 28, 29
    ];
    
    // 處理上傳事件的函數
    const handleUpload = () => {
        const formData = {
            title,
            content,
            medicalStatus,
            illnessCause,
            treatmentStatus,
            selectedDates,
        };
        console.log('Uploading data to Django backend:', formData);
        // 在這裡，您將使用 fetch 或 axios 將 formData 發送到您的 Django API 端點
        alert('資料已送出（請查看主控台）');
    };


    return (
        <div className="uploader-container">
            {/* --- 頁首 --- */}
            <header className="uploader-header">
                <img src="https://i.imgur.com/yXOvdJv.png" alt="Avatar" className="avatar" />
                <div className="search-bar"></div>
                <div className="header-icons">
                    <div className="icon-bg"><NotificationIcon /></div>
                    <div className="icon-bg"><HomeIcon /></div>
                </div>
            </header>

            <main className="uploader-main">
                <h1 className="main-title">上傳病程記錄</h1>
                <div className="pet-selector">
                    胖胖 <span className="dropdown-arrow">▼</span>
                </div>

                {/* --- 步驟 1: 表單輸入 --- */}
                {step === 1 && (
                    <div className="form-step-1">
                        <div className="content-box">
                            <div className="content-header-btn">撰寫內容</div>
                            <div className="input-fields">
                                <input
                                    type="text"
                                    placeholder="標題："
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                />
                                <textarea
                                    placeholder="內文："
                                    value={content}
                                    onChange={(e) => setContent(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="status-section">
                            <button
                                className={`toggle-btn ${medicalStatus === '已就醫' ? 'active' : ''}`}
                                onClick={() => setMedicalStatus('已就醫')}
                            >
                                已就醫
                            </button>
                            <button
                                className={`toggle-btn ${medicalStatus === '未就醫' ? 'active' : ''}`}
                                onClick={() => setMedicalStatus('未就醫')}
                            >
                                未就醫
                            </button>
                        </div>
                        <input
                            type="text"
                            className="illness-cause-input"
                            placeholder="病因"
                            value={illnessCause}
                            onChange={(e) => setIllnessCause(e.target.value)}
                        />

                        <div className="status-section">
                             <button
                                className={`toggle-btn ${treatmentStatus === '已痊癒' ? 'active' : ''}`}
                                onClick={() => setTreatmentStatus('已痊癒')}
                            >
                                已痊癒
                            </button>
                            <button
                                className={`toggle-btn ${treatmentStatus === '治療中' ? 'active' : ''}`}
                                onClick={() => setTreatmentStatus('治療中')}
                            >
                                治療中
                            </button>
                        </div>
                        
                        <div className="calendar-section">
                            <h2 className="calendar-title">請選擇日期</h2>
                            <div className="calendar-box">
                                <div className="calendar-header">2025/03</div>
                                <div className="calendar-grid">
                                    {['日', '一', '二', '三', '四', '五', '六'].map(d => <div key={d} className="day-name">{d}</div>)}
                                    {calendarDays.map((day, index) => (
                                        <div
                                            key={index}
                                            className={`day-cell ${day ? '' : 'empty'} ${selectedDates.includes(day) ? 'selected' : ''}`}
                                            onClick={() => handleDateClick(day)}
                                        >
                                            {day}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <button className="main-action-btn next-btn" onClick={() => setStep(2)}>
                            下一頁
                        </button>
                    </div>
                )}

                {/* --- 步驟 2: AI 統整預覽 --- */}
                {step === 2 && (
                    <div className="summary-step-2">
                        <div className="summary-box">
                            <div className="summary-header-btn">AI 病程統整</div>
                            <div className="summary-content">
                                <p>在這段期間內，胖胖罹患支氣管炎，整體病程歷時約九天。以下為綜合統整：</p>
                                <p>在症狀方面，胖胖主要出現了咳嗽與嘔吐兩種明顯的不適表現。咳嗽的情況從3月5日開始，持續至3月12日之間時好時壞；而嘔吐的情形則發生於3月6日、7日、11日與13日。其中有幾天這兩種症狀同時出現，特別是在3月7日和3月11日，顯示有重疊發作的狀況。</p>
                                <p>除了咳嗽與嘔吐，3月7日當天也觀察到牠出現情緒焦慮與精神不佳的表現，這是在這段期間中，唯一出現多重不適反應集中的一天。</p>
                                <p>飼料方面，維持與平常相同的餵食量，並沒有特別更動。從第4天（3月8日）開始，額外補充了活力錠，作為營養支持，協助胖胖恢復體力與活力，也確實有成效。</p>
                                <p>總結來說，胖胖的症狀在這九天內有起伏與交錯，並非單一形式持續出現，而是呈現間歇性發作的狀況。</p>
                            </div>
                        </div>
                        <div className="summary-actions">
                            <button className="secondary-action-btn" onClick={() => setStep(1)}>
                                編輯
                            </button>
                            <button className="primary-action-btn" onClick={handleUpload}>
                                上傳
                            </button>
                        </div>
                    </div>
                )}
            </main>

            {/* --- 頁尾導航 --- */}
            <footer className="uploader-footer">
                <div className="footer-icon"><CalculatorIcon/></div>
                <div className="footer-icon active"><PawIcon/></div>
                <div className="footer-icon plus-icon"><PlusIcon/></div>
                <div className="footer-icon"><ListIcon/></div>
                <div className="footer-icon"><SettingsIcon/></div>
            </footer>
        </div>
    );
};

export default MedicalRecordUploader;