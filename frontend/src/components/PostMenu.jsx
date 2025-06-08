import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from '../styles/PostMenu.module.css';

const PostMenu = ({ isOpen, onClose, menuItems }) => {
  const navigate = useNavigate();
  
  // 點擊 ESC 鍵關閉選單
  useEffect(() => {
    const handleEscKey = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    
    window.addEventListener('keydown', handleEscKey);
    return () => {
      window.removeEventListener('keydown', handleEscKey);
    };
  }, [isOpen, onClose]);
  
  // 點擊外部區域關閉選單
  useEffect(() => {
    if (!isOpen) return;
    
    const handleOutsideClick = (e) => {
      // 如果點擊的是選單容器以外的區域，關閉選單
      if (!e.target.closest(`.${styles.menuContainer}`) && 
          !e.target.closest(`.${styles.createPost}`)) {
        onClose();
      }
    };
    
    document.addEventListener('click', handleOutsideClick, true);
    return () => {
      document.removeEventListener('click', handleOutsideClick, true);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <>
      {/* 背景遮罩 */}
      <div className={styles.overlay} onClick={onClose} />
      
      {/* 選單內容 */}
      <div className={styles.menuContainer}>
        {menuItems.map((item, index) => (
          <button
            key={index}
            className={`${styles.menuItem} ${styles.buttonElement}`}
            onClick={() => {
              navigate(item.path);
              onClose();
            }}
          >
            {item.label}
          </button>
        ))}
        {/*
        <button 
          className={`${styles.menuItem} ${styles.dailyRecord}`}
          onClick={() => {
            navigate('/daily-record');
            onClose();
          }}
        >
          日常紀錄
        </button>
        
        <button 
          className={`${styles.menuItem} ${styles.symptomRecord}`}
          onClick={() => {
            navigate('/symptom-record');
            onClose();
          }}
        >
          症狀紀錄
        </button>
        */}
      </div>
    </>
  );
};

export default PostMenu; 