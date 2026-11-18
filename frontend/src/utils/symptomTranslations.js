// 症狀翻譯對照表。
// 這份清單必須與 backend/pets/management/commands/seed_symptoms.py 的
// SYMPTOMS 一致：資料庫裡有、這裡沒有的症狀，在英日介面會顯示原文中文。
export const symptomTranslations = {
  // 消化道
  '嘔吐': {
    'en': 'Vomiting',
    'zh-TW': '嘔吐',
    'zh-CN': '呕吐',
    'ja': '嘔吐'
  },
  '腹瀉': {
    'en': 'Diarrhea',
    'zh-TW': '腹瀉',
    'zh-CN': '腹泻',
    'ja': '下痢'
  },
  '軟便': {
    'en': 'Soft stool',
    'zh-TW': '軟便',
    'zh-CN': '软便',
    'ja': '軟便'
  },
  '血便': {
    'en': 'Bloody stool',
    'zh-TW': '血便',
    'zh-CN': '血便',
    'ja': '血便'
  },
  '便祕': {
    'en': 'Constipation',
    'zh-TW': '便祕',
    'zh-CN': '便秘',
    'ja': '便秘'
  },
  '食慾不振': {
    'en': 'Loss of appetite',
    'zh-TW': '食慾不振',
    'zh-CN': '食欲不振',
    'ja': '食欲不振'
  },
  // 呼吸道
  '打噴嚏': {
    'en': 'Sneezing',
    'zh-TW': '打噴嚏',
    'zh-CN': '打喷嚏',
    'ja': 'くしゃみ'
  },
  '咳嗽': {
    'en': 'Coughing',
    'zh-TW': '咳嗽',
    'zh-CN': '咳嗽',
    'ja': '咳'
  },
  '流鼻水': {
    'en': 'Runny nose',
    'zh-TW': '流鼻水',
    'zh-CN': '流鼻涕',
    'ja': '鼻水'
  },
  '呼吸急促': {
    'en': 'Rapid breathing',
    'zh-TW': '呼吸急促',
    'zh-CN': '呼吸急促',
    'ja': '呼吸が速い'
  },
  '呼吸困難': {
    'en': 'Laboured breathing',
    'zh-TW': '呼吸困難',
    'zh-CN': '呼吸困难',
    'ja': '呼吸困難'
  },
  // 皮膚與被毛
  '掉毛': {
    'en': 'Hair loss',
    'zh-TW': '掉毛',
    'zh-CN': '掉毛',
    'ja': '脱毛'
  },
  '皮膚紅腫': {
    'en': 'Red, swollen skin',
    'zh-TW': '皮膚紅腫',
    'zh-CN': '皮肤红肿',
    'ja': '皮膚の赤み・腫れ'
  },
  '皮膚搔癢': {
    'en': 'Itchy skin',
    'zh-TW': '皮膚搔癢',
    'zh-CN': '皮肤瘙痒',
    'ja': '皮膚のかゆみ'
  },
  '皮屑增多': {
    'en': 'Flaky skin',
    'zh-TW': '皮屑增多',
    'zh-CN': '皮屑增多',
    'ja': 'フケが多い'
  },
  '傷口紅腫': {
    'en': 'Inflamed wound',
    'zh-TW': '傷口紅腫',
    'zh-CN': '伤口红肿',
    'ja': '傷口の腫れ'
  },
  // 眼睛與耳朵
  '眼睛紅腫': {
    'en': 'Red, swollen eyes',
    'zh-TW': '眼睛紅腫',
    'zh-CN': '眼睛红肿',
    'ja': '目の赤み・腫れ'
  },
  '眼睛分泌物增多': {
    'en': 'Eye discharge',
    'zh-TW': '眼睛分泌物增多',
    'zh-CN': '眼睛分泌物增多',
    'ja': '目やにが多い'
  },
  '頻繁搔抓耳朵': {
    'en': 'Scratching ears',
    'zh-TW': '頻繁搔抓耳朵',
    'zh-CN': '频繁抓耳朵',
    'ja': '耳をしきりに掻く'
  },
  '耳朵有異味': {
    'en': 'Ear odour',
    'zh-TW': '耳朵有異味',
    'zh-CN': '耳朵有异味',
    'ja': '耳のにおい'
  },
  // 行動與精神
  '精神萎靡': {
    'en': 'Lethargy',
    'zh-TW': '精神萎靡',
    'zh-CN': '精神萎靡',
    'ja': '元気がない'
  },
  '焦躁不安': {
    'en': 'Restlessness',
    'zh-TW': '焦躁不安',
    'zh-CN': '焦躁不安',
    'ja': '落ち着きがない'
  },
  '顫抖': {
    'en': 'Trembling',
    'zh-TW': '顫抖',
    'zh-CN': '颤抖',
    'ja': '震え'
  },
  '行動不便': {
    'en': 'Difficulty moving',
    'zh-TW': '行動不便',
    'zh-CN': '行动不便',
    'ja': '動きづらそう'
  },
  '跛行': {
    'en': 'Limping',
    'zh-TW': '跛行',
    'zh-CN': '跛行',
    'ja': '足を引きずる'
  },
  // 全身
  '發燒': {
    'en': 'Fever',
    'zh-TW': '發燒',
    'zh-CN': '发烧',
    'ja': '発熱'
  },
  '體重下降': {
    'en': 'Weight loss',
    'zh-TW': '體重下降',
    'zh-CN': '体重下降',
    'ja': '体重減少'
  },
  '頻繁喝水': {
    'en': 'Excessive thirst',
    'zh-TW': '頻繁喝水',
    'zh-CN': '频繁喝水',
    'ja': '水をよく飲む'
  },
  '頻尿': {
    'en': 'Frequent urination',
    'zh-TW': '頻尿',
    'zh-CN': '尿频',
    'ja': '頻尿'
  },
  '排尿困難': {
    'en': 'Difficulty urinating',
    'zh-TW': '排尿困難',
    'zh-CN': '排尿困难',
    'ja': '排尿困難'
  },
  '抽搐': {
    'en': 'Seizures',
    'zh-TW': '抽搐',
    'zh-CN': '抽搐',
    'ja': 'けいれん'
  },
  '牙齦蒼白': {
    'en': 'Pale gums',
    'zh-TW': '牙齦蒼白',
    'zh-CN': '牙龈苍白',
    'ja': '歯茎が白い'
  },
  // 其他
  '其他': {
    'en': 'Other',
    'zh-TW': '其他',
    'zh-CN': '其他',
    'ja': 'その他'
  },
  // 舊資料用：已不在症狀清單中，但可能仍掛在既有紀錄上
  '流鼻涕': {
    'en': 'Runny nose',
    'zh-TW': '流鼻涕',
    'zh-CN': '流鼻涕',
    'ja': '鼻水'
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