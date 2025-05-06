import React, { useEffect, useState } from 'react';
import './DailySchedule.css';

const DailySchedule = () => {
  // 假資料：正式版改從後端取得
  const initialSchedule = [
    { time: '10:00-12:00', task: '公園散步', start: '10:00', end: '12:00' },
    { time: '14:00-16:00', task: '看醫生', start: '14:00', end: '16:00' },
    { time: '18:00-19:00', task: '晚餐＋吃藥', start: '18:00', end: '19:00' }
  ];

  const [currentTime, setCurrentTime] = useState(new Date());

  // 每分鐘更新一次時間
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // 判斷是否已過該行程
  const isPast = (endTime) => {
    const [hour, minute] = endTime.split(':').map(Number);
    const scheduleTime = new Date(currentTime);
    scheduleTime.setHours(hour, minute, 0, 0);
    return currentTime > scheduleTime;
  };

  return (
    <div className="schedule-container">
      <h3 className="section-title">當日行程</h3>

      {initialSchedule.map((item, index) => (
        <div className="schedule-card" key={index}>
          <div className="time">{item.time}</div>
          <div className={`task ${isPast(item.end) ? 'past' : ''}`}>{item.task}</div>
        </div>
      ))}

      <button className="add-button">新增行程</button>
    </div>
  );
};

export default DailySchedule;
