import React, { useState } from 'react';
import styles from '../styles/MainPage.module.css';
import TopNavbar from '../components/TopNavbar';
import BottomNavbar from '../components/BottomNavbar';
import DailyMissions from '../components/DailyMissions';
import DailySchedule from '../components/DailySchedule';
import Calendar from '../components/Calendar';
import DayDisplay from '../components/DayDisplay';
import ArticleRecommendations from '../components/ArticleRecommendations';

const MainPage = () => {
  const [showMonthView, setShowMonthView] = useState(true);
  
  const toggleCalendarView = () => {
    setShowMonthView(!showMonthView);
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
            <DailySchedule />
          </div>
        </div>
        <div className={styles.calendarSection}>
          {showMonthView ? 
            <Calendar /> : 
            <DayDisplay toggleView={toggleCalendarView} />
          }
        </div>
        <div className={styles.recommendationsSection}>
          <ArticleRecommendations />
        </div>
        {/* 其他主頁面內容 */}
      </main>
      <BottomNavbar />
    </div>
  );
};

export default MainPage; 