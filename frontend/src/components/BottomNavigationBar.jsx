import React, { useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import styles from '../styles/BottomNavbar.module.css';
import PostMenu from './PostMenu';

const BottomNavbar = () => {
  const { t } = useTranslation('common');
  const [isPostMenuOpen, setIsPostMenuOpen] = useState(false);
  const postButtonRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();

  function getMenuItem() {
    // 在所有頁面都提供相同的基本紀錄功能
    return [
      {
        label: t('nav.dailyRecord'),
        path: '/create-post'
      },
      {
        label: t('nav.abnormalRecord'),
        path: '/create-abnormal-post'
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
            alt={t('nav.social')}
            className={styles.icon}
            onClick={() => handleNavItemClick('social')}
          />
        </div>
        <div className={styles.navItem}>
          <img 
            src="/assets/icon/BottomButton_PetPage.png" 
            alt={t('nav.pets')}
            className={styles.icon}
            onClick={() => handleNavItemClick('pet')}
          />
        </div>
        <div className={styles.navItem}>
          <img 
            src="/assets/icon/BottomButton_CreatePost.png" 
            alt={t('nav.post')}
            className={`${styles.icon} ${styles.createPost}`}
            onClick={() => handleNavItemClick('post')}
            ref={postButtonRef}
          />
        </div>
        <div className={styles.navItem}>
          <img 
            src="/assets/icon/BottomButton_Calculator.png" 
            alt={t('nav.calculator')}
            className={styles.icon}
            onClick={() => handleNavItemClick('calculator')}
          />
        </div>
        <div className={styles.navItem}>
          <img 
            src="/assets/icon/BottomButton_Setting.png" 
            alt={t('nav.settings')}
            className={styles.icon}
            onClick={() => handleNavItemClick('settings')}
          />
        </div>
      </nav>
    </>
  );
};

export default BottomNavbar; 