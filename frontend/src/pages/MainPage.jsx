import React, { useState } from 'react';
import styles from '../styles/MainPage.module.css';
import TopNavbar from '../components/TopNavbar';
import BottomNavbar from '../components/BottomNavBar';
import Calendar from '../components/Calendar';
import DailySchedule from '../components/DailySchedule';
import DailyMissions from '../components/DailyMissions';
import ArticleRecommendations from '../components/ArticleRecommendations';
import DayDisplay from '../components/DayDisplay';

const MainPage = () => {
  // 控制日曆視圖類型 (月視圖/週視圖)
  const [showMonthView, setShowMonthView] = useState(true);
  
  // 選中的日期
  const [selectedDate, setSelectedDate] = useState(null);
  
  // 日曆視圖切換
  const toggleCalendarView = () => {
    setShowMonthView(!showMonthView);
  };
  
  // 處理日期選擇
  const handleDateSelect = (date) => {
    setSelectedDate(date);
  };
  
  // 重設為今天
  const resetToToday = () => {
    setSelectedDate(null);
  };
  
  // 處理新增行程後的更新
  const handleScheduleAdded = () => {
    // 如果需要在新增行程後更新日曆上的標記，可以在這裡處理
  };
  
  return (
    <div className={styles.container}>
      <TopNavbar />
      <main className={styles.content}>
        <div className={styles.topSection}>
          <div className={styles.column}>
            <DailyMissions />
          </div>
          <div className={styles.column}>
            <DailySchedule 
              selectedDate={selectedDate} 
              onAddSchedule={handleScheduleAdded}
            />
          </div>
        </div>
        <div className={styles.calendarSection}>
          {showMonthView ? 
            <Calendar 
              onDateSelect={handleDateSelect} 
              selectedDate={selectedDate}
            /> : 
            <DayDisplay toggleView={toggleCalendarView} />
          }
        </div>
        <div className={styles.recommendationsSection}>
          <ArticleRecommendations />
        </div>
      </main>
      <BottomNavbar />
    </div>
  );
};

export default MainPage; 