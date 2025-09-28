import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import styles from '../styles/AINavigator.module.css';
import ChatWindow from './ChatWindow';

const AINavigator = ({ user }) => {
  const { t } = useTranslation('main');
  const [isChatOpen, setIsChatOpen] = useState(false);

  const handleAIClick = () => {
    setIsChatOpen(true);
    // 同時啟動全局浮動聊天
    window.dispatchEvent(new CustomEvent('startFloatingChat'));
  };

  const handleChatClose = () => {
    setIsChatOpen(false);
    // 不要自動關閉全局浮動聊天，讓它繼續存在
    // 只有用戶明確的操作（如遣散頭像）才關閉全局浮動聊天
  };

  // 移除本地的路徑監聽，交給全局 GlobalFloatingAI 處理

  return (
    <>
      <div className={styles.aiNavigatorContainer}>
        <div className={styles.aiBox}>
          <div className={styles.aiIconSection}>
            <div className={styles.aiIconBackground}></div>
            <div className={styles.aiIconWrapper} onClick={handleAIClick}>
              <img
                src="/assets/icon/PeterAiIcon.png"
                alt="Peter AI"
                className={styles.aiIcon}
              />
            </div>
          </div>
          <div className={styles.aiContent}>
            <h2 className={styles.greeting}>{t('aiNavigator.greeting')}</h2>
            <p className={styles.description}>
              {t('aiNavigator.description')}
            </p>
          </div>
        </div>
      </div>

      <ChatWindow
        isOpen={isChatOpen}
        onClose={handleChatClose}
        user={user}
      />
    </>
  );
};

export default AINavigator;