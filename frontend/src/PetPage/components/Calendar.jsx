// src/PetPage/components/Calendar.jsx
import React, { useState } from 'react';
import '../DiseaseRecord.css';   // 直接沿用同一份 CSS

const Calendar = ({ onSelect }) => {
  const today = new Date();
  const [current, setCurrent] = useState({ y: 2025, m: 2 }); // 2025/03 (0-index)
  const [selected, setSelected] = useState(null);

  /* 計算本月日期陣列 */
  const firstDay = new Date(current.y, current.m, 1).getDay();    // 0(日)-6(六)
  const daysInMonth = new Date(current.y, current.m + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const handlePick = (d) => {
    const picked = new Date(current.y, current.m, d);
    setSelected(d);
    onSelect && onSelect(picked);
  };

  return (
    <section className="calendar-card">
      <div className="calendar-header">{`${current.y}/${String(current.m + 1).padStart(2, '0')}`}</div>
      <div className="calendar-grid">
        {['日', '一', '二', '三', '四', '五', '六'].map((w) => (
          <span key={w} className="week-label">{w}</span>
        ))}

        {cells.map((d, idx) =>
          d ? (
            <button
              key={idx}
              className={`date-btn ${
                d === selected ? 'sel' : today.getDate() === d &&
                  today.getMonth() === current.m &&
                  today.getFullYear() === current.y
                  ? 'today'
                  : ''
              }`}
              onClick={() => handlePick(d)}
            >
              {d}
            </button>
          ) : (
            <span key={idx} />
          )
        )}
      </div>
    </section>
  );
};

export default Calendar;
