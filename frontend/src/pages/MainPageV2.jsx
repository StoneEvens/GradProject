import React from 'react';
import styles from '../styles/MainPageV2.module.css';
import TopNavbar from '../components/TopNavbar';
import BottomNavbar from '../components/BottomNavigationbar';
import AINavigator from '../components/AINavigator';
import TodoSection from '../components/TodoSection';
import DailyTasks from '../components/DailyTasks';
import { useUser } from '../context/UserContext';

const MainPageV2 = () => {
  const { userData } = useUser();
  return (
    <div className={styles.container}>
      <TopNavbar />
      
      <main className={styles.mainContent}>
        {/* AI 系統導覽區域 */}
        <section className={styles.aiSection}>
          <AINavigator user={userData} />
        </section>
        
        {/* 待辦事項區域 */}
        <section className={styles.todoSection}>
          <TodoSection />
        </section>
        
        {/* 每日任務區域 */}
        <section className={styles.dailyTaskSection}>
          <DailyTasks />
        </section>
      </main>
      
      <BottomNavbar />
    </div>
  );
};

export default MainPageV2;