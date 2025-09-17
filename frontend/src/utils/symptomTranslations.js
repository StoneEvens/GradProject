// 症狀翻譯映射表（根據實際數據庫症狀列表）
export const symptomTranslations = {
  '嘔吐': {
    'en': 'Vomiting',
    'zh-TW': '嘔吐',
    'zh-CN': '呕吐',
    'ja': '嘔吐'
  },
  '軟便': {
    'en': 'Soft stool',
    'zh-TW': '軟便',
    'zh-CN': '软便',
    'ja': '軟便'
  },
  '食慾不振': {
    'en': 'Loss of appetite',
    'zh-TW': '食慾不振',
    'zh-CN': '食欲不振',
    'ja': '食欲不振'
  },
  '打噴嚏': {
    'en': 'Sneezing',
    'zh-TW': '打噴嚏',
    'zh-CN': '打喷嚏',
    'ja': 'くしゃみ'
  },
  '腹瀉': {
    'en': 'Diarrhea',
    'zh-TW': '腹瀉',
    'zh-CN': '腹泻',
    'ja': '下痢'
  },
  '咳嗽': {
    'en': 'Coughing',
    'zh-TW': '咳嗽',
    'zh-CN': '咳嗽',
    'ja': '咳'
  },
  '流鼻涕': {
    'en': 'Runny nose',
    'zh-TW': '流鼻水',
    'zh-CN': '流鼻水',
    'ja': '鼻水'
  },
  '掉毛': {
    'en': 'Hair loss',
    'zh-TW': '掉毛',
    'zh-CN': '掉毛',
    'ja': '脱毛'
  },
  '顫抖': {
    'en': 'Trembling',
    'zh-TW': '顫抖',
    'zh-CN': '颤抖',
    'ja': '震え'
  },
  '皮膚紅腫': {
    'en': 'Skin redness and swelling',
    'zh-TW': '皮膚紅腫',
    'zh-CN': '皮肤红肿',
    'ja': '皮膚の赤みと腫れ'
  },
  '呼吸急促': {
    'en': 'Rapid breathing',
    'zh-TW': '呼吸急促',
    'zh-CN': '呼吸急促',
    'ja': '呼吸が荒い'
  },
  '眼睛紅腫': {
    'en': 'Eye redness and swelling',
    'zh-TW': '眼睛紅腫',
    'zh-CN': '眼睛红肿',
    'ja': '目の充血'
  },
  '行動不便': {
    'en': 'Mobility issues',
    'zh-TW': '行動不便',
    'zh-CN': '行动不便',
    'ja': '行動困難'
  },
  '頻繁喝水': {
    'en': 'Frequent drinking',
    'zh-TW': '頻繁喝水',
    'zh-CN': '频繁喝水',
    'ja': '頻繁な水分摂取'
  },
  '抽搐': {
    'en': 'Convulsions',
    'zh-TW': '抽搐',
    'zh-CN': '抽搐',
    'ja': 'けいれん'
  },
  '焦躁不安': {
    'en': 'Restlessness',
    'zh-TW': '焦躁不安',
    'zh-CN': '焦躁不安',
    'ja': '落ち着きがない'
  },
  '其他': {
    'en': 'Other',
    'zh-TW': '其他',
    'zh-CN': '其他',
    'ja': 'その他'
  }
};

/**
 * 翻譯症狀名稱
 * @param {string} symptomName - 症狀名稱（通常是中文）
 * @param {string} targetLanguage - 目標語言代碼 ('en', 'zh-TW', 'zh-CN', 'ja')
 * @returns {string} 翻譯後的症狀名稱，如果找不到翻譯則返回原文
 */
export const translateSymptom = (symptomName, targetLanguage = 'en') => {
  if (!symptomName || typeof symptomName !== 'string') {
    return symptomName;
  }

  // 首先嘗試直接匹配
  if (symptomTranslations[symptomName] && symptomTranslations[symptomName][targetLanguage]) {
    return symptomTranslations[symptomName][targetLanguage];
  }

  // 如果沒有找到直接匹配，嘗試在所有翻譯中尋找
  for (const [originalName, translations] of Object.entries(symptomTranslations)) {
    for (const [lang, translation] of Object.entries(translations)) {
      if (translation === symptomName && translations[targetLanguage]) {
        return translations[targetLanguage];
      }
    }
  }

  // 如果都找不到，返回原文
  return symptomName;
};

/**
 * 批量翻譯症狀列表
 * @param {Array} symptoms - 症狀列表
 * @param {string} targetLanguage - 目標語言代碼
 * @returns {Array} 翻譯後的症狀列表
 */
export const translateSymptoms = (symptoms, targetLanguage = 'en') => {
  if (!Array.isArray(symptoms)) {
    return symptoms;
  }

  return symptoms.map(symptom => {
    if (typeof symptom === 'string') {
      return translateSymptom(symptom, targetLanguage);
    } else if (symptom && typeof symptom === 'object') {
      // 處理物件格式的症狀
      if (symptom.symptom_name) {
        return {
          ...symptom,
          symptom_name: translateSymptom(symptom.symptom_name, targetLanguage)
        };
      } else if (symptom.text) {
        return {
          ...symptom,
          text: translateSymptom(symptom.text, targetLanguage)
        };
      }
    }
    return symptom;
  });
};

/**
 * 檢查是否有可用的翻譯
 * @param {string} symptomName - 症狀名稱
 * @returns {boolean} 是否有可用的翻譯
 */
export const hasSymptomTranslation = (symptomName) => {
  if (!symptomName || typeof symptomName !== 'string') {
    return false;
  }

  // 檢查是否在翻譯表中
  if (symptomTranslations[symptomName]) {
    return true;
  }

  // 檢查是否為其他語言的翻譯
  for (const translations of Object.values(symptomTranslations)) {
    for (const translation of Object.values(translations)) {
      if (translation === symptomName) {
        return true;
      }
    }
  }

  return false;
};

/**
 * 獲取症狀的所有可用翻譯
 * @param {string} symptomName - 症狀名稱
 * @returns {Object|null} 包含所有語言翻譯的物件，如果找不到則返回null
 */
export const getSymptomTranslations = (symptomName) => {
  if (!symptomName || typeof symptomName !== 'string') {
    return null;
  }

  // 直接匹配
  if (symptomTranslations[symptomName]) {
    return symptomTranslations[symptomName];
  }

  // 在翻譯中尋找
  for (const [originalName, translations] of Object.entries(symptomTranslations)) {
    for (const translation of Object.values(translations)) {
      if (translation === symptomName) {
        return translations;
      }
    }
  }

  return null;
};