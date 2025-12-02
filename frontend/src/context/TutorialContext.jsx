import React, { createContext, useContext, useState, useCallback } from 'react';

const TutorialContext = createContext();

export const TutorialProvider = ({ children }) => {
  const [tutorialMode, setTutorialMode] = useState({
    isActive: false,
    tutorialType: null
  });

  // 開始教學時清空相關 draft 和過去的教學進度紀錄
  const startTutorial = useCallback((tutorialType) => {
    // 清空相關 draft
    if (['createPost', 'tagPet'].includes(tutorialType)) {
      localStorage.removeItem('createPostDraft');
      console.log('[TutorialContext] 清空 createPostDraft');
    }
    if (tutorialType === 'addAbnormalPost') {
      localStorage.removeItem('createAbnormalPostDraft');
      console.log('[TutorialContext] 清空 createAbnormalPostDraft');
    }

    // 清空所有教學進度紀錄 (tutorial_*_progress, tutorial_*_completed)
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('tutorial_') && (key.endsWith('_progress') || key.endsWith('_completed')))) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => {
      localStorage.removeItem(key);
      console.log('[TutorialContext] 清空教學紀錄:', key);
    });

    console.log('[TutorialContext] 開始教學:', tutorialType);
    setTutorialMode({ isActive: true, tutorialType });
  }, []);

  const endTutorial = useCallback(() => {
    console.log('[TutorialContext] 結束教學');
    setTutorialMode({ isActive: false, tutorialType: null });
  }, []);

  return (
    <TutorialContext.Provider value={{
      tutorialMode,
      startTutorial,
      endTutorial,
      isTutorialMode: tutorialMode.isActive,
      currentTutorialType: tutorialMode.tutorialType
    }}>
      {children}
    </TutorialContext.Provider>
  );
};

export const useTutorial = () => {
  const context = useContext(TutorialContext);
  if (!context) {
    // 如果在 TutorialProvider 外部使用，返回預設值
    return {
      tutorialMode: { isActive: false, tutorialType: null },
      startTutorial: () => {},
      endTutorial: () => {},
      isTutorialMode: false,
      currentTutorialType: null
    };
  }
  return context;
};

export default TutorialContext;
