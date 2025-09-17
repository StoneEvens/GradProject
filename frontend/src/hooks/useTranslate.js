import { useTranslation } from 'react-i18next';

/**
 * 自定義 Hook 來簡化翻譯的使用
 * @param {string|string[]} namespaces - 要載入的命名空間
 * @returns {object} 包含 t (翻譯函數) 和 i18n (i18n 實例) 的物件
 */
export const useTranslate = (namespaces = 'common') => {
  const { t, i18n } = useTranslation(namespaces);

  return {
    t,
    i18n,
    currentLanguage: i18n.language,
    changeLanguage: (lng) => i18n.changeLanguage(lng),
    isZhTW: i18n.language === 'zh-TW',
    isEn: i18n.language === 'en'
  };
};

export default useTranslate;