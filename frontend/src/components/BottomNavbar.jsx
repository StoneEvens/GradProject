import React, { useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import styles from '../styles/BottomNavbar.module.css';
import PostMenu from './PostMenu';

const BottomNavbar = () => {
  const [isPostMenuOpen, setIsPostMenuOpen] = useState(false);
  const postButtonRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();

  function getMenuItem() {
    // 在所有頁面都提供相同的基本紀錄功能
    return [
      {
        label: '日常紀錄',
        path: '/create-post'
      },
      {
        label: '異常紀錄',
        path: '/symptom-record'
      }
    ];
  }

  const handleNavItemClick = (action) => {
    // 如果點擊的是發文按鈕，則切換發文選單的顯示狀態
    if (action === 'post') {
      if (location.pathname === '/community') {
        navigate('/test-community-post-upload');
        return;
      } else if (location.pathname === '/forum') {
        navigate('/forum/create-post');
        return;
      }

      setIsPostMenuOpen(prevState => !prevState);
      return;
    }
    
    // 如果選單是開啟的，點擊其他按鈕時關閉選單
    if (isPostMenuOpen) {
      setIsPostMenuOpen(false);
    }
    
    // 處理其他導航按鈕
    switch (action) {
      case 'social':
        navigate('/social');
        break;
      case 'pet':
        navigate('/pet');
        break;
      case 'calculator':
        navigate('/calculator');
        break;
      case 'settings':
        navigate('/settings');
        break;
      default:
        break;
    }
  };

  return (
    <>
      <PostMenu 
        isOpen={isPostMenuOpen} 
        onClose={() => setIsPostMenuOpen(false)}
        menuItems={getMenuItem()}
      />
      <nav className={styles.navbar}>
        <div className={styles.navItem}>
          <img 
            src="/assets/icon/BottomButton_Forum.png" 
            alt="社群"
            className={styles.icon}
            onClick={() => handleNavItemClick('social')}
          />
        </div>
        <div className={styles.navItem}>
          <img 
            src="/assets/icon/BottomButton_PetPage.png" 
            alt="寵物"
            className={styles.icon}
            onClick={() => handleNavItemClick('pet')}
          />
        </div>
        <div className={styles.navItem}>
          <img 
            src="/assets/icon/BottomButton_CreatePost.png" 
            alt="發文"
            className={`${styles.icon} ${styles.createPost}`}
            onClick={() => handleNavItemClick('post')}
            ref={postButtonRef}
          />
        </div>
        <div className={styles.navItem}>
          <img 
            src="/assets/icon/BottomButton_Calculator.png" 
            alt="計算機"
            className={styles.icon}
            onClick={() => handleNavItemClick('calculator')}
          />
        </div>
        <div className={styles.navItem}>
          <img 
            src="/assets/icon/BottomButton_Setting.png" 
            alt="設定"
            className={styles.icon}
            onClick={() => handleNavItemClick('settings')}
          />
        </div>
      </nav>
    </>
  );
};

export default BottomNavbar; 