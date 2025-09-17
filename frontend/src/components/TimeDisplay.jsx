import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import styles from '../styles/TodoSection.module.css';

const TimeDisplay = React.memo(({ schedule }) => {
  const { t } = useTranslation('main');

  // 計算時間差
  const getTimeRemaining = useCallback((schedule) => {
    const now = new Date();
    const [year, month, day] = schedule.date.split('-').map(Number);
    const [startHours, startMinutes] = schedule.start_time.split(':').map(Number);
    const scheduleTime = new Date(year, month - 1, day, startHours, startMinutes);

    const diff = scheduleTime - now;
    const isPast = diff < 0;
    const absDiff = Math.abs(diff);

    const days = Math.floor(absDiff / (1000 * 60 * 60 * 24));
    const remainingHours = Math.floor((absDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const remainingMinutes = Math.floor((absDiff % (1000 * 60 * 60)) / (1000 * 60));

    if (days > 0) {
      if (remainingHours > 0) {
        return {
          value: days,
          unit: t('timeDisplay.days'),
          subValue: remainingHours,
          subUnit: t('timeDisplay.hours'),
          isPast
        };
      }
      return {
        value: days,
        unit: t('timeDisplay.days'),
        isPast
      };
    } else if (remainingHours > 0) {
      if (remainingMinutes > 0) {
        return {
          value: remainingHours,
          unit: t('timeDisplay.hours'),
          subValue: remainingMinutes,
          subUnit: t('timeDisplay.minutes'),
          isPast
        };
      }
      return {
        value: remainingHours,
        unit: t('timeDisplay.hours'),
        isPast
      };
    } else {
      return {
        value: remainingMinutes || 1,
        unit: t('timeDisplay.minutes'),
        isPast
      };
    }
  }, [t]);

  const [timeInfo, setTimeInfo] = useState(() => getTimeRemaining(schedule));

  useEffect(() => {
    // 更新時間信息
    const updateTime = () => {
      setTimeInfo(getTimeRemaining(schedule));
    };

    updateTime(); // 立即更新一次

    // 每分鐘更新一次時間
    const interval = setInterval(updateTime, 60000);

    return () => clearInterval(interval);
  }, [schedule, getTimeRemaining]);

  return (
    <div className={styles.timeInfo}>
      <div className={styles.timeDisplay}>
        <span className={styles.timeNumber}>{timeInfo.value}</span>
        <span className={styles.timeUnit}>{timeInfo.unit}</span>
        {timeInfo.subValue && (
          <>
            <span className={styles.timeNumber}>{timeInfo.subValue}</span>
            <span className={styles.timeUnit}>{timeInfo.subUnit}</span>
          </>
        )}
        <span className={styles.timeSuffix}>
          {timeInfo.isPast ? t('timeDisplay.ago') : t('timeDisplay.later')}
        </span>
      </div>
    </div>
  );
});

TimeDisplay.displayName = 'TimeDisplay';

export default TimeDisplay;