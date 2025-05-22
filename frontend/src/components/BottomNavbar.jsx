import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from '../styles/BottomNavbar.module.css';
import PostMenu from './PostMenu';

const BottomNavbar = () => {
  const [isPostMenuOpen, setIsPostMenuOpen] = useState(false);
  const postButtonRef = useRef(null);
  const navigate = useNavigate();

  const handleNavItemClick = (action) => {
    // 如果點擊的是發文按鈕，則切換發文選單的顯示狀態
    if (action === 'post') {
      setIsPostMenuOpen(prevState => !prevState);
      return;
    }
    
    // 如果選單是開啟的，點擊其他按鈕時關閉選單
    if (isPostMenuOpen) {
      setIsPostMenuOpen(false);
    }
    
    // 處理其他導航按鈕
    switch (action) {
      case 'forum':
        navigate('/forum');
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
      />
      <nav className={styles.navbar}>
        <div className={styles.navItem}>
          <img 
            src="/assets/icon/BottomButton_Forum.png" 
            alt="論壇"
            className={styles.icon}
            onClick={() => handleNavItemClick('forum')}
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