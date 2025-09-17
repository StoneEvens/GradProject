import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import styles from '../styles/AINavigator.module.css';
import ChatWindow from './ChatWindow';

const AINavigator = ({ user }) => {
  const { t } = useTranslation('main');
  const [isChatOpen, setIsChatOpen] = useState(false);

  const handleAIClick = () => {
    setIsChatOpen(true);
  };

  const handleChatClose = () => {
    setIsChatOpen(false);
  };

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