import { useTranslation } from 'react-i18next';
import { useCallback } from 'react';
import { translateSymptom, translateSymptoms, symptomTranslations } from '../utils/symptomTranslations';

/**
 * 自定義Hook用於症狀翻譯
 * @returns {Object} 包含翻譯函數的物件
 */
export const useSymptomTranslation = () => {
  const { i18n } = useTranslation();

  // 獲取當前語言代碼
  const getCurrentLanguage = useCallback(() => {
    const lang = i18n.language;
    // 統一語言代碼格式
    if (lang.startsWith('zh')) {
      return lang === 'zh-CN' ? 'zh-CN' : 'zh-TW';
    }
    if (lang === 'ja') {
      return 'ja';
    }
    return 'en';
  }, [i18n.language]);

  /**
   * 翻譯單個症狀
   * @param {string} symptomName - 症狀名稱
   * @param {string} targetLanguage - 目標語言（可選，默認使用當前界面語言）
   * @returns {string} 翻譯後的症狀名稱
   */
  const translateSingleSymptom = useCallback((symptomName, targetLanguage = null) => {
    const lang = targetLanguage || getCurrentLanguage();
    return translateSymptom(symptomName, lang);
  }, [getCurrentLanguage]);

  /**
   * 翻譯症狀列表
   * @param {Array} symptoms - 症狀列表
   * @param {string} targetLanguage - 目標語言（可選，默認使用當前界面語言）
   * @returns {Array} 翻譯後的症狀列表
   */
  const translateSymptomList = useCallback((symptoms, targetLanguage = null) => {
    const lang = targetLanguage || getCurrentLanguage();
    return translateSymptoms(symptoms, lang);
  }, [getCurrentLanguage]);

  /**
   * 處理症狀字符串顯示（用於UI顯示，將症狀數組轉為字符串）
   * @param {Array|string} symptoms - 症狀數據
   * @param {string} separator - 分隔符（默認為'、'）
   * @param {string} targetLanguage - 目標語言（可選）
   * @returns {string} 格式化後的症狀字符串
   */
  const formatSymptomsForDisplay = useCallback((symptoms, separator = '、', targetLanguage = null) => {
    const lang = targetLanguage || getCurrentLanguage();

    if (!symptoms) {
      return '';
    }

    if (typeof symptoms === 'string') {
      // 如果已經是字符串，嘗試按分隔符分割後翻譯再重新組合
      const symptomArray = symptoms.split(/[、,，]/).map(s => s.trim()).filter(s => s);
      return symptomArray
        .map(symptom => translateSymptom(symptom, lang))
        .join(separator);
    }

    if (Array.isArray(symptoms)) {
      return symptoms
        .map(symptom => {
          if (typeof symptom === 'string') {
            return translateSymptom(symptom, lang);
          } else if (symptom && typeof symptom === 'object') {
            const symptomName = symptom.symptom_name || symptom.text || symptom;
            return translateSymptom(symptomName, lang);
          }
          return symptom;
        })
        .filter(symptom => symptom) // 過濾空值
        .join(separator);
    }

    return symptoms;
  }, [getCurrentLanguage]);

  /**
   * 檢查症狀是否需要翻譯（當前界面語言與症狀語言不同時）
   * @param {string} symptomName - 症狀名稱
   * @returns {boolean} 是否需要翻譯
   */
  const needsTranslation = useCallback((symptomName) => {
    const currentLang = getCurrentLanguage();

    // 如果當前是中文界面，而症狀包含中文字符，則不需要翻譯
    if (currentLang.startsWith('zh') && /[\u4e00-\u9fff]/.test(symptomName)) {
      return false;
    }

    // 如果當前是英文界面，而症狀是英文，則不需要翻譯
    if (currentLang === 'en' && /^[a-zA-Z\s]+$/.test(symptomName)) {
      return false;
    }

    // 如果當前是日文界面，而症狀包含日文字符，則不需要翻譯
    if (currentLang === 'ja' && /[\u3040-\u309f\u30a0-\u30ff\u4e00-\u9fff]/.test(symptomName)) {
      return false;
    }

    return true;
  }, [getCurrentLanguage]);

  /**
   * 反向翻譯症狀名稱（從當前界面語言翻譯回中文，用於API調用）
   * @param {string} symptomName - 當前界面語言的症狀名稱
   * @returns {string} 中文的症狀名稱（數據庫中的原始名稱）
   */
  const reverseTranslateSymptom = useCallback((symptomName) => {
    if (!symptomName || typeof symptomName !== 'string') {
      return symptomName;
    }

    const currentLang = getCurrentLanguage();

    // 如果當前語言已經是中文，直接返回
    if (currentLang.startsWith('zh')) {
      return symptomName;
    }

    // 在翻譯表中尋找對應的中文名稱
    for (const [chineseName, translations] of Object.entries(symptomTranslations)) {
      if (translations[currentLang] === symptomName) {
        return chineseName; // 返回中文原始名稱
      }
    }

    // 如果找不到，返回原文
    return symptomName;
  }, [getCurrentLanguage]);

  /**
   * 批量反向翻譯症狀列表
   * @param {Array} symptoms - 當前界面語言的症狀列表
   * @returns {Array} 中文的症狀列表
   */
  const reverseTranslateSymptoms = useCallback((symptoms) => {
    if (!Array.isArray(symptoms)) {
      return symptoms;
    }

    return symptoms.map(symptom => {
      if (typeof symptom === 'string') {
        return reverseTranslateSymptom(symptom);
      } else if (symptom && typeof symptom === 'object') {
        if (symptom.text) {
          return {
            ...symptom,
            text: reverseTranslateSymptom(symptom.text)
          };
        }
      }
      return symptom;
    });
  }, [reverseTranslateSymptom]);

  return {
    translateSingleSymptom,
    translateSymptomList,
    formatSymptomsForDisplay,
    needsTranslation,
    getCurrentLanguage,
    reverseTranslateSymptom,
    reverseTranslateSymptoms
  };
};