import { useTranslation } from 'react-i18next';
import { useCallback } from 'react';

/**
 * 通用的 i18n Hook，簡化多語言使用
 * @param {string|string[]} namespaces - 命名空間
 * @returns {object} 包含翻譯函數和工具
 */
export const useI18n = (namespaces = 'common') => {
  const { t, i18n } = useTranslation(namespaces);

  // 格式化日期
  const formatDate = useCallback((date) => {
    const d = new Date(date);
    if (i18n.language === 'zh-TW') {
      return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
    } else {
      return d.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    }
  }, [i18n.language]);

  // 格式化時間
  const formatTime = useCallback((date) => {
    const d = new Date(date);
    if (i18n.language === 'zh-TW') {
      return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
    } else {
      return d.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
      });
    }
  }, [i18n.language]);

  // 格式化數字
  const formatNumber = useCallback((number) => {
    return new Intl.NumberFormat(i18n.language === 'zh-TW' ? 'zh-TW' : 'en-US').format(number);
  }, [i18n.language]);

  return {
    t,
    i18n,
    language: i18n.language,
    changeLanguage: i18n.changeLanguage,
    isZhTW: i18n.language === 'zh-TW',
    isEn: i18n.language === 'en',
    formatDate,
    formatTime,
    formatNumber
  };
};

export default useI18n;