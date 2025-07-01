import React, { useState } from 'react';
import './CreateForumPost.css';
import Header from '../components/Header';
import BottomNavigationBar from '../components/BottomNavigationBar';

const SYMPTOMS = [
  '嘔吐', '打噴嚏', '腹瀉', '咳嗽',
  '掉毛', '流鼻涕', '軟便', '血便',
  '皮膚紅腫', '呼吸急促', '眼睛紅腫',
  '行動不便', '頻繁喝水', '食慾不振',
  '抽搐顫抖', '焦躁不安', '過度舔咬'
];


// 假資料：紀錄日期為 2025/6/14、2025/6/17、2025/6/20-2025/6/26
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
  '2025-06-20': {
    date: '2025/06/20',
    symptoms: ['打噴嚏', '流鼻涕'],
    otherSymptom: '',
    water: '0.6',
    temperature: '38.8',
    description: '開始打噴嚏，鼻子有點濕濕的，可能是感冒初期',
  },
  '2025-06-21': {
    date: '2025/06/21',
    symptoms: ['流鼻涕', '咳嗽'],
    otherSymptom: '鼻塞',
    water: '0.7',
    temperature: '39.1',
    description: '鼻涕變多，開始咳嗽，精神還不錯',
  },
  '2025-06-22': {
    date: '2025/06/22',
    symptoms: ['咳嗽', '食慾不振'],
    otherSymptom: '',
    water: '0.5',
    temperature: '39.3',
    description: '咳嗽加重，不太想吃東西，體溫稍微升高',
  },
  '2025-06-23': {
    date: '2025/06/23',
    symptoms: ['咳嗽', '眼睛紅腫'],
    otherSymptom: '精神不太好',
    water: '0.8',
    temperature: '39.5',
    description: '咳嗽持續，眼睛有點紅腫，精神明顯變差',
  },
  '2025-06-24': {
    date: '2025/06/24',
    symptoms: ['流鼻涕', '掉毛'],
    otherSymptom: '鼻塞嚴重',
    water: '0.9',
    temperature: '39.2',
    description: '鼻涕很多，開始掉毛，鼻塞很嚴重',
  },
  '2025-06-25': {
    date: '2025/06/25',
    symptoms: ['咳嗽', '呼吸急促'],
    otherSymptom: '呼吸困難',
    water: '0.4',
    temperature: '39.8',
    description: '咳嗽很嚴重，呼吸急促，需要立即就醫',
  },
  '2025-06-26': {
    date: '2025/06/26',
    symptoms: ['流鼻涕', '打噴嚏'],
    otherSymptom: '症狀改善',
    water: '0.7',
    temperature: '38.9',
    description: '症狀開始改善，鼻涕減少，精神恢復一些',
  },
};


function CustomCalendar({ records, selectedDates, onSelectDate }) {
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
          const isSelected = selectedDates.includes(dateKey);
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

export default function CreateForumPost() {
  // 預設選中有紀錄的第一天
  const firstRecordDate = Object.keys(symptomRecords)[0];
  const [selectedDates, setSelectedDates] = useState([firstRecordDate]);
  const record = symptomRecords[selectedDates[0]];

  // 處理日期選擇
  const handleDateSelect = (dateKey) => {
    setSelectedDates(prev => {
      if (prev.includes(dateKey)) {
        // 如果日期已經被選中，則移除它
        return prev.filter(date => date !== dateKey);
      } else {
        // 如果日期未被選中，則添加它
        return [...prev, dateKey];
      }
    });
  };

  // 計算症狀在選中日期中出現的天數
  const getSymptomCount = (symptom) => {
    return selectedDates.filter(dateKey => 
      symptomRecords[dateKey]?.symptoms?.includes(symptom)
    ).length;
  };

  // 計算選中日期的平均喝水量
  const getAverageWater = () => {
    const waterValues = selectedDates
      .map(dateKey => parseFloat(symptomRecords[dateKey]?.water || 0))
      .filter(value => !isNaN(value));
    
    if (waterValues.length === 0) return 0;
    return (waterValues.reduce((sum, value) => sum + value, 0) / waterValues.length).toFixed(1);
  };

  // 計算選中日期的平均體溫
  const getAverageTemperature = () => {
    const tempValues = selectedDates
      .map(dateKey => parseFloat(symptomRecords[dateKey]?.temperature || 0))
      .filter(value => !isNaN(value));
    
    if (tempValues.length === 0) return 0;
    return (tempValues.reduce((sum, value) => sum + value, 0) / tempValues.length).toFixed(1);
  };

  return (
    <div className="symptom-record-container">
      <Header showSearchBar={false} />
      <div className="header-row">
        <h2 className="main-title">上傳病程紀錄</h2>
      </div>
      <div className="section-box calendar-section">
        <div className="section-label">選擇日期</div>
        <CustomCalendar
          records={symptomRecords}
          selectedDates={selectedDates}
          onSelectDate={handleDateSelect}
        />
      </div>
      {/* 症狀區塊 */}
      <div className="section-box">
        <div className="section-label">症狀</div>
        <div className="symptom-grid">
          {SYMPTOMS.map((symptom) => {
            const count = getSymptomCount(symptom);
            return (
              <div key={symptom} className="symptom-count-item">
                <span className="symptom-name">{symptom}</span>
                <span className={`symptom-count ${count === 0 ? 'zero' : ''}`}>
                  {count === 0 ? '0' : count}
                </span>
              </div>
            );
          })}
        </div>
        {/* 暫時隱藏其他症狀標籤
        {record?.otherSymptom && (
          <div style={{ textAlign: 'center' }}>
            <div className="other-symptom-container">
              <span className="other-symptom-label">其他：</span>
              <span>{record.otherSymptom}</span>
            </div>
          </div>
        )}
        */}
      </div>
      {/* 身體數值區塊 */}
      <div className="section-box">
        <div className="section-label">健康數值紀錄</div>
        <div className="body-record-row">
          <label>平均喝水量：</label>
          <input
            className="body-input"
            type="number"
            value={getAverageWater()}
            readOnly
          />
          <span>公升</span>
        </div>
        <div className="body-record-row">
          <label>平均體溫：</label>
          <input
            className="body-input"
            type="number"
            value={getAverageTemperature()}
            readOnly
          />
          <span>度</span>
        </div>
      </div>
      {/* 補充描述區塊 */}
      <div className="section-box">
        <div className="section-label">補充描述</div>
        <div className="desc-input">
          <div className="description-list">
            {selectedDates.map(dateKey => {
              const record = symptomRecords[dateKey];
              if (!record?.description) return null;
              
              // 將日期格式從 YYYY-MM-DD 轉換為 M/D
              const dateParts = dateKey.split('-');
              const displayDate = `${parseInt(dateParts[1])}/${parseInt(dateParts[2])}`;
              
              return (
                <div key={dateKey} className="description-item">
                  <span className="description-date">{displayDate}：</span>
                  <span className="description-text">{record.description}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      {/* 操作按鈕區塊 */}
      <div className="action-buttons-container">
        <button className="upload-record-btn">上傳病程紀錄</button>
      </div>
      {/* 預留空間 */}
      <div style={{ height: 40 }} />
      <BottomNavigationBar />
    </div>
  );
}
