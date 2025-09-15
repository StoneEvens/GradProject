import React, { useMemo } from 'react';
import styles from '../styles/TodoSection.module.css';
import TimeDisplay from './TimeDisplay';

const TodoCard = React.memo(({ schedule, onClick }) => {
  const handleClick = () => {
    onClick(schedule);
  };

  // 計算是否過期
  const isOverdue = useMemo(() => {
    const now = new Date();
    const [year, month, day] = schedule.date.split('-').map(Number);
    const [startHours, startMinutes] = schedule.start_time.split(':').map(Number);
    const scheduleTime = new Date(year, month - 1, day, startHours, startMinutes);
    return scheduleTime < now;
  }, [schedule.date, schedule.start_time]);

  return (
    <div
      className={`${styles.todoCard} ${isOverdue ? styles.overdue : ''}`}
      onClick={handleClick}
    >
      <div className={styles.tapeLine}></div>

      <div className={styles.noteContent}>
        <h4 className={styles.todoTitle}>{schedule.title}</h4>
        <TimeDisplay schedule={schedule} />
      </div>
    </div>
  );
});

TodoCard.displayName = 'TodoCard';

export default TodoCard;