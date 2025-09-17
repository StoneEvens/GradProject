import React from 'react';
import { useTranslate } from '../hooks/useTranslate';

/**
 * 示範如何在現有組件中整合 i18n
 *
 * 使用步驟：
 * 1. 引入 useTranslate hook
 * 2. 使用 t 函數來翻譯文字
 * 3. 根據需要載入不同的命名空間
 */
const ComponentWithI18n = () => {
  // 載入多個命名空間
  const { t, currentLanguage, changeLanguage } = useTranslate(['common', 'auth']);

  return (
    <div>
      {/* 使用預設命名空間 (common) */}
      <h1>{t('nav.home')}</h1>

      {/* 使用指定命名空間 */}
      <p>{t('auth:login.title')}</p>

      {/* 動態內容翻譯 */}
      <p>{t('message.welcome')} User!</p>

      {/* 條件式顯示 */}
      {currentLanguage === 'zh-TW' && <p>目前使用繁體中文</p>}
      {currentLanguage === 'en' && <p>Currently using English</p>}

      {/* 按鈕文字翻譯 */}
      <button>{t('button.submit')}</button>
    </div>
  );
};

export default ComponentWithI18n;