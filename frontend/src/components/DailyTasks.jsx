import React from 'react';
import { useNavigate } from 'react-router-dom';
import styles from '../styles/DailyTasks.module.css';

const DailyTasks = () => {
  const navigate = useNavigate();

  const tasks = [
    {
      id: 1,
      title: '發布一篇貼文',
      icon: '/assets/icon/SettingIcon.png',
      route: '/create-post',
      completed: false
    },
    {
      id: 2,
      title: '使用一次營養計算機',
      icon: '/assets/icon/SettingIcon.png',
      route: '/calculator',
      completed: false
    }
  ];

  const handleTaskClick = (route) => {
    navigate(route);
  };

  return (
    <div className={styles.dailyTasksContainer}>
      <h3 className={styles.sectionTitle}>我的每日任務</h3>

      <div className={styles.tasksGrid}>
        {tasks.map((task) => (
          <div key={task.id} className={styles.taskCard}>
            <div className={styles.taskContent}>
              <div className={styles.taskInfo}>
                <img
                  src={task.icon}
                  alt="task icon"
                  className={styles.taskIcon}
                />
                <span className={styles.taskTitle}>{task.title}</span>
              </div>

              <button
                className={styles.completeButton}
                onClick={() => handleTaskClick(task.route)}
              >
                去完成
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DailyTasks;