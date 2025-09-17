import React from 'react';
import { useTranslation } from 'react-i18next';
import './LanguageSelector.css';

const LanguageSelector = () => {
  const { i18n, t } = useTranslation();

  const changeLanguage = (lng) => {
    i18n.changeLanguage(lng);
    localStorage.setItem('language', lng);
  };

  return (
    <div className="language-selector">
      <select
        value={i18n.language}
        onChange={(e) => changeLanguage(e.target.value)}
        className="language-select"
      >
        <option value="zh-TW">{t('language.zh-TW')}</option>
        <option value="en">{t('language.en')}</option>
      </select>
    </div>
  );
};

export default LanguageSelector;