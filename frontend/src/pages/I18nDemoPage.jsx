import React from 'react';
import { useTranslation } from 'react-i18next';
import LanguageSelector from '../components/LanguageSelector';
import './I18nDemoPage.css';

const I18nDemoPage = () => {
  const { t } = useTranslation(['common', 'auth', 'pet']);

  return (
    <div className="i18n-demo-page">
      <div className="demo-header">
        <h1>i18n 多語言示範頁面</h1>
        <LanguageSelector />
      </div>

      <div className="demo-section">
        <h2>導航選單 (Navigation)</h2>
        <div className="demo-grid">
          <div className="demo-item">{t('nav.home')}</div>
          <div className="demo-item">{t('nav.social')}</div>
          <div className="demo-item">{t('nav.pets')}</div>
          <div className="demo-item">{t('nav.feed')}</div>
          <div className="demo-item">{t('nav.calculator')}</div>
          <div className="demo-item">{t('nav.profile')}</div>
          <div className="demo-item">{t('nav.settings')}</div>
          <div className="demo-item">{t('nav.logout')}</div>
        </div>
      </div>

      <div className="demo-section">
        <h2>按鈕 (Buttons)</h2>
        <div className="button-group">
          <button className="demo-button">{t('button.submit')}</button>
          <button className="demo-button">{t('button.cancel')}</button>
          <button className="demo-button">{t('button.save')}</button>
          <button className="demo-button">{t('button.delete')}</button>
          <button className="demo-button">{t('button.edit')}</button>
        </div>
      </div>

      <div className="demo-section">
        <h2>登入表單 (Login Form)</h2>
        <div className="form-demo">
          <h3>{t('auth:login.title')}</h3>
          <div className="form-field">
            <label>{t('auth:login.email')}</label>
            <input type="email" placeholder={t('auth:login.email')} />
          </div>
          <div className="form-field">
            <label>{t('auth:login.password')}</label>
            <input type="password" placeholder={t('auth:login.password')} />
          </div>
          <button className="demo-button primary">{t('auth:login.loginButton')}</button>
        </div>
      </div>

      <div className="demo-section">
        <h2>寵物資訊 (Pet Information)</h2>
        <div className="pet-demo">
          <h3>{t('pet:title')}</h3>
          <div className="demo-grid">
            <div className="demo-item">{t('pet:form.name')}</div>
            <div className="demo-item">{t('pet:form.species')}</div>
            <div className="demo-item">{t('pet:form.breed')}</div>
            <div className="demo-item">{t('pet:form.age')}</div>
          </div>
          <div className="species-list">
            <span className="species-item">{t('pet:species.dog')}</span>
            <span className="species-item">{t('pet:species.cat')}</span>
            <span className="species-item">{t('pet:species.bird')}</span>
            <span className="species-item">{t('pet:species.rabbit')}</span>
          </div>
        </div>
      </div>

      <div className="demo-section">
        <h2>訊息 (Messages)</h2>
        <div className="message-demo">
          <div className="message success">{t('message.success')}</div>
          <div className="message error">{t('message.error')}</div>
          <div className="message info">{t('message.loading')}</div>
          <div className="message warning">{t('message.confirmDelete')}</div>
        </div>
      </div>
    </div>
  );
};

export default I18nDemoPage;