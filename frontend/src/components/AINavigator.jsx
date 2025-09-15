import React, { useState } from 'react';
import styles from '../styles/AINavigator.module.css';
import ChatWindow from './ChatWindow';

const AINavigator = ({ user }) => {
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
            <h2 className={styles.greeting}>Hi！我是 PETer 專員 Peter</h2>
            <p className={styles.description}>
              我大學時主修 PETer 寵兒研究，對這個 app 瞭如指掌，如果有任何操作上問題都可以問我！
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