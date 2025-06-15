/** 新增多日假資料與互動日曆功能，並根據點選日期顯示對應紀錄 **/
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

// 假資料：有紀錄的日期與內容
const recordsByDate = {
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
    symptoms: ['腹瀉', '流鼻涕', '皮膚紅腫'],
    otherSymptom: '有點發燒',
    water: '0.7',
    temperature: '39.2',
    description: '有點發燒，精神還可以',
  },
};

function CustomCalendar({ selectedDate, onSelectDate }) {
  const today = new Date();
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth() + 1);
  const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
  const firstDay = new Date(currentYear, currentMonth - 1, 1).getDay();
  const calendarDays = Array(firstDay).fill(null);
  for (let i = 1; i <= daysInMonth; i++) {
    calendarDays.push(i);
  }
  // 取得有紀錄的日期集合
  const recordDays = Object.keys(recordsByDate)
    .filter(dateStr => {
      const d = new Date(dateStr);
      return d.getFullYear() === currentYear && d.getMonth() + 1 === currentMonth;
    })
    .map(dateStr => new Date(dateStr).getDate());

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
  // 回到今天
  const backToToday = () => {
    setCurrentYear(today.getFullYear());
    setCurrentMonth(today.getMonth() + 1);
  };

  // 判斷是否為當月
  const isCurrentMonth = currentYear === today.getFullYear() && currentMonth === today.getMonth() + 1;

  return (
    <div className="calendar-container">
      <div className="calendar-title-bar">
        <h3 className="section-title">
          <button name="lastMonth" className="calendar-arrow left" type="button" aria-label="上一月" onClick={lastMonth} />
          {!isCurrentMonth && (
            <button className="calendar-today-btn" type="button" onClick={backToToday}>回到今天</button>
          )}
          <span className={isCurrentMonth ? "calendar-title-text-current" : "calendar-title-text"}>
            {isCurrentMonth
              ? `${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}號（${['日','一','二','三','四','五','六'][today.getDay()]}）`
              : `${currentYear}年${currentMonth}月`}
          </span>
          <button name="nextMonth" className="calendar-arrow right" type="button" aria-label="下一月" onClick={nextMonth} />
        </h3>
      </div>
      <div className="calendar-grid">
        {['日', '一', '二', '三', '四', '五', '六'].map((day, idx) => (
          <div key={idx} className="calendar-day-name">{day}</div>
        ))}
        {calendarDays.map((d, idx) => {
          if (d === null) return <div key={idx} className="calendar-day empty"></div>;
          const dateStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
          const hasRecord = !!recordsByDate[dateStr];
          const isSelected = selectedDate === dateStr;
          const isToday = isCurrentMonth && d === today.getDate();
          return (
            <div
              key={idx}
              className={`calendar-day custom${hasRecord ? ' has-record' : ' no-record'}${isSelected ? ' selected' : ''}${isToday ? ' today' : ''}`}
              style={{
                opacity: hasRecord ? 1 : 0.5,
                background: isSelected ? '#F08651' : hasRecord ? '#fff1db' : '#fff1db',
                cursor: hasRecord ? 'pointer' : 'not-allowed',
              }}
              onClick={() => hasRecord && onSelectDate(dateStr)}
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
  const defaultDate = Object.keys(recordsByDate)[0];
  const [selectedDate, setSelectedDate] = useState(defaultDate);
  const record = recordsByDate[selectedDate];

  return (
    <div className="symptom-record-container">
      <Header showSearchBar={false} />
      <div className="header-row">
        <h2 className="main-title">檢視症狀紀錄</h2>
      </div>
      <div className="section-box calendar-section">
        <CustomCalendar selectedDate={selectedDate} onSelectDate={setSelectedDate} />
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
          {record?.otherSymptom && (
            <label className="symptom-checkbox">
              <input type="checkbox" checked readOnly />
              <span>其他：{record.otherSymptom}</span>
            </label>
          )}
        </div>
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
      <div style={{ height: 16 }} />
      <div className="record-action-btns">
        <button className="upload-btn" style={{marginRight: '12px'}}>編輯記錄</button>
        <button className="upload-btn delete-btn">刪除紀錄</button>
      </div>
      <div style={{ height: 24 }} />
      <BottomNavigationBar />
    </div>
  );
}
