import React, { useState, useEffect, useRef, useCallback } from 'react';
import styles from '../styles/TodoSection.module.css';
import AddSchedule from './AddSchedule';
import TodoCard from './TodoCard';
import { 
  getUserSchedules,
  addUserSchedule,
  updateSchedule,
  markScheduleAsCompleted,
  deleteSchedule,
  formatDate
} from '../services/scheduleService';

const TodoSection = () => {
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [editingSchedule, setEditingSchedule] = useState(null);
  const [isAddingSchedule, setIsAddingSchedule] = useState(false);
  const todoGridRef = useRef(null);


  // 獲取待辦事項（未完成的行程）
  const fetchTodos = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getUserSchedules();
      
      // 只顯示未完成的行程，並按時間排序
      const uncompletedSchedules = data
        .filter(schedule => !schedule.is_completed)
        .sort((a, b) => {
          const aTime = `${a.date} ${a.start_time}`;
          const bTime = `${b.date} ${b.start_time}`;
          return new Date(aTime) - new Date(bTime);
        });
      
      setSchedules(uncompletedSchedules);
    } catch (err) {
      setError('無法獲取待辦事項');
      console.error('獲取待辦事項失敗', err);
    } finally {
      setLoading(false);
    }
  };

  // 編輯行程
  const handleEditSchedule = useCallback((schedule) => {
    setEditingSchedule(schedule);
  }, []);

  // 保存行程
  const handleSaveSchedule = useCallback(async (scheduleData, scheduleId) => {
    setLoading(true);
    setError(null);
    try {
      if (scheduleId) {
        await updateSchedule(scheduleId, scheduleData);
      } else {
        await addUserSchedule(scheduleData);
      }
      await fetchTodos();
    } catch (err) {
      setError(scheduleId ? '更新行程失敗' : '新增行程失敗');
      console.error(scheduleId ? '更新行程失敗' : '新增行程失敗', err);
    } finally {
      setLoading(false);
      setEditingSchedule(null);
    }
  }, []);

  // 刪除行程
  const handleDeleteSchedule = useCallback(async (scheduleId) => {
    setLoading(true);
    setError(null);
    try {
      await deleteSchedule(scheduleId);
      await fetchTodos();
    } catch (err) {
      setError('刪除行程失敗');
      console.error('刪除行程失敗', err);
    } finally {
      setLoading(false);
      setEditingSchedule(null);
    }
  }, []);

  // 標記完成
  const handleMarkCompleted = useCallback(async (scheduleId) => {
    setLoading(true);
    setError(null);
    try {
      await markScheduleAsCompleted(scheduleId);
      await fetchTodos();
    } catch (err) {
      setError('標記完成失敗');
      console.error('標記完成失敗', err);
    } finally {
      setLoading(false);
      setEditingSchedule(null);
    }
  }, []);

  // 關閉彈窗
  const handleCloseModal = useCallback(() => {
    setEditingSchedule(null);
    setIsAddingSchedule(false);
  }, []);

  // 新增行程
  const handleAddSchedule = useCallback(() => {
    setIsAddingSchedule(true);
  }, []);


  // 處理水平滾輪
  const handleWheel = (e) => {
    if (todoGridRef.current) {
      e.preventDefault();
      todoGridRef.current.scrollLeft += e.deltaY;
    }
  };

  useEffect(() => {
    fetchTodos();

    // 添加滾輪事件監聽器
    const todoGrid = todoGridRef.current;
    if (todoGrid) {
      todoGrid.addEventListener('wheel', handleWheel, { passive: false });
    }

    return () => {
      if (todoGrid) {
        todoGrid.removeEventListener('wheel', handleWheel);
      }
    };
  }, []);

  return (
    <div className={styles.todoContainer}>
      <div className={styles.titleRow}>
        <h3 className={styles.sectionTitle}>我的待辦事項</h3>
      </div>
      
      <div
        className={`${styles.todoGrid} ${schedules.length > 2 ? styles.horizontal : styles.grid}`}
        ref={todoGridRef}
      >
        {loading && <div className={styles.loadingMessage}>載入中...</div>}
        {error && <div className={styles.errorMessage}>{error}</div>}
        
        {schedules.map((schedule) => (
          <TodoCard
            key={schedule.id}
            schedule={schedule}
            onClick={handleEditSchedule}
          />
        ))}

        {/* 如果便條少於3個，補充空白卡片 */}
        {!loading && !error && schedules.length < 2 && (
          Array(2 - schedules.length).fill(null).map((_, index) => (
            <div key={`empty-${index}`} className={styles.emptyCard} onClick={handleAddSchedule}>
              <div className={styles.tapeLine}></div>
              <div className={styles.emptyContent}>
                <span className={styles.emptyText}>無待辦事項</span>
                <span className={styles.addText}>點此新增</span>
              </div>
            </div>
          ))
        )}

        {/* 永遠在最後添加一個空白卡片 */}
        {!loading && !error && (
          <div className={styles.emptyCard} onClick={handleAddSchedule}>
            <div className={styles.tapeLine}></div>
            <div className={styles.emptyContent}>
              <span className={styles.emptyText}>
                {schedules.length === 0 ? '無待辦事項' : '新增事項'}
              </span>
              <span className={styles.addText}>點此新增</span>
            </div>
          </div>
        )}
      </div>
      
      {/* 編輯行程彈窗 */}
      {editingSchedule && (
        <AddSchedule 
          onClose={handleCloseModal} 
          onSave={handleSaveSchedule}
          onDelete={handleDeleteSchedule}
          onMarkCompleted={handleMarkCompleted}
          initialData={editingSchedule}
          selectedDate={null}
        />
      )}
      
      {/* 新增行程彈窗 */}
      {isAddingSchedule && (
        <AddSchedule 
          onClose={handleCloseModal} 
          onSave={handleSaveSchedule}
          onDelete={handleDeleteSchedule}
          onMarkCompleted={handleMarkCompleted}
          initialData={null}
          selectedDate={null}
        />
      )}
    </div>
  );
};

export default TodoSection;