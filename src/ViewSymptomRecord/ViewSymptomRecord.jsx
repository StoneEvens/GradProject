import React, { useState } from 'react';
import './ViewSymptomRecord.css';
import Header from '../components/Header';
import BottomNavigationBar from '../components/BottomNavigationBar';

const SYMPTOMS = [
  '嘔吐', '打噴嚏', '腹瀉', '咳嗽',
  '掉毛', '流鼻涕', '軟便', '血便',
  '皮膚紅腫', '呼吸急促', '眼睛紅腫',
  '行動不便', '頻繁喝水', '食慾不振',
  '抽搐顫抖', '焦躁不安', '過度舔咬'
];


// 假資料：紀錄日期為 2025/6/14、2025/6/17
const symptomRecords = {
  '2025-06-14': {
    date: '2025/06/14',
    symptoms: ['嘔吐', '掉毛'],
    otherSymptom: '',
    water: '0.5',
    temperature: '38.5',
    description: '今天精神不太好',
  },
  '2025-06-17': {
    date: '2025/06/17',
    symptoms: ['腹瀉', '咳嗽', '流鼻涕'],
    otherSymptom: '有點發燒',
    water: '0.7',
    temperature: '39.2',
    description: '有點發燒，精神還可以',
  },
};


function CustomCalendar({ records, selectedDate, onSelectDate }) {
  const [currentYear, setCurrentYear] = useState(2025);
  const [currentMonth, setCurrentMonth] = useState(6);
  const weekNames = ['日', '一', '二', '三', '四', '五', '六'];
  const firstDay = new Date(currentYear, currentMonth - 1, 1).getDay();
  const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
  const calendarDays = Array(firstDay).fill(null);
  for (let i = 1; i <= daysInMonth; i++) {
    calendarDays.push(i);
  }

  const formattedTitle = `${currentYear}年${currentMonth}月`;

  // 取得有紀錄的日期集合
  const recordDates = Object.keys(records);

  // 切換月份
  const lastMonth = () => {
    if (currentMonth === 1) {
      setCurrentYear(currentYear - 1);
      setCurrentMonth(12);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };
  const nextMonth = () => {
    if (currentMonth === 12) {
      setCurrentYear(currentYear + 1);
      setCurrentMonth(1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  // 判斷某天是否有紀錄
  function getDateKey(day) {
    return `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  return (
    <div className="calendar-container symptom-calendar-container">
      <div className="calendar-title-bar">
        <h3 className="section-title">
          <button name="lastMonth" className="calendar-arrow left" type="button" aria-label="上一月" onClick={lastMonth} />
          <span className="calendar-title-text">{formattedTitle}</span>
          <button name="nextMonth" className="calendar-arrow right" type="button" aria-label="下一月" onClick={nextMonth} />
        </h3>
      </div>
      <div className="calendar-grid">
        {weekNames.map((day, index) => (
          <div key={index} className="calendar-day-name">{day}</div>
        ))}
        {calendarDays.map((d, index) => {
          if (d === null) return <div key={index} className="calendar-day empty"></div>;
          const dateKey = getDateKey(d);
          const hasRecord = recordDates.includes(dateKey);
          const isSelected = selectedDate === dateKey;
          return (
            <div
              key={index}
              className={`calendar-day symptom-calendar-day${hasRecord ? ' has-record' : ' no-record'}${isSelected ? ' selected' : ''}`}
              style={{
                opacity: hasRecord ? 1 : 0.5,
                cursor: hasRecord ? 'pointer' : 'not-allowed',
                backgroundColor: isSelected ? '#FFB370' : hasRecord ? '#fff1db' : '#fff1db',
                border: isSelected ? '2px solid #FFB370' : 'none',
              }}
              onClick={() => hasRecord && onSelectDate(dateKey)}
            >
              {d}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function ViewSymptomRecord() {
  // 預設選中有紀錄的第一天
  const firstRecordDate = Object.keys(symptomRecords)[0];
  const [selectedDate, setSelectedDate] = useState(firstRecordDate);
  const record = symptomRecords[selectedDate];

  return (
    <div className="symptom-record-container">
      <Header showSearchBar={false} />
      <div className="header-row">
        <h2 className="main-title">檢視症狀紀錄</h2>
      </div>
      <div className="section-box calendar-section">

        <CustomCalendar
          records={symptomRecords}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
        />
      </div>
      {/* 症狀區塊 */}
      <div className="section-box">
        <div className="section-label">症狀</div>
        <div className="symptom-grid">
          {SYMPTOMS.map((symptom) => (
            <label key={symptom} className="symptom-checkbox">
              <input
                type="checkbox"
                checked={record?.symptoms?.includes(symptom) || false}
                readOnly
              />
              <span>{symptom}</span>
            </label>
          ))}
        </div>
        {record?.otherSymptom && (
          <div className="other-symptom-container">
            <span className="other-symptom-label">其他：</span>
            <span>{record.otherSymptom}</span>
          </div>
        )}
      </div>
      {/* 身體數值區塊 */}
      <div className="section-box">
        <div className="section-label">健康數值紀錄</div>
        <div className="body-record-row">
          <label>喝水量：</label>
          <input
            className="body-input"
            type="number"
            value={record?.water || ''}
            readOnly
          />
          <span>公升</span>
        </div>
        <div className="body-record-row">
          <label>體溫：</label>
          <input
            className="body-input"
            type="number"
            value={record?.temperature || ''}
            readOnly
          />
          <span>度</span>
        </div>
      </div>
      {/* 補充描述區塊 */}
      <div className="section-box">
        <div className="section-label">補充描述</div>
        <textarea
          className="desc-input"
          value={record?.description || ''}
          readOnly
        />
      </div>
      {/* 預留空間 */}
      <div style={{ height: 40 }} />
      <BottomNavigationBar />
    </div>
  );
}
