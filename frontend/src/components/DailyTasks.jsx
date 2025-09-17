import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import styles from '../styles/DailyTasks.module.css';

const DailyTasks = () => {
  const { t } = useTranslation('main');
  const navigate = useNavigate();

  const tasks = [
    {
      id: 1,
      titleKey: 'dailyTasks.tasks.createPost',
      icon: '/assets/icon/SettingIcon.png',
      route: '/create-post',
      completed: false
    },
    {
      id: 2,
      titleKey: 'dailyTasks.tasks.useCalculator',
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
      <h3 className={styles.sectionTitle}>{t('dailyTasks.title')}</h3>

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
                <span className={styles.taskTitle}>{t(task.titleKey)}</span>
              </div>

              <button
                className={styles.completeButton}
                onClick={() => handleTaskClick(task.route)}
              >
                {t('dailyTasks.completeButton')}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DailyTasks;