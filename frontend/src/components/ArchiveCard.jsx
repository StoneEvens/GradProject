import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import SymptomCalendar from './SymptomCalendar';
import styles from '../styles/ArchiveCard.module.css';
import { validateAbnormalPostsExist, updateDiseaseArchive } from '../services/petService';
import { useSymptomTranslation } from '../hooks/useSymptomTranslation';

const ArchiveCard = ({
  archiveData,
  user,
  pet,
  currentUser,  // 新增參數，當前登入的用戶
  isPublicView = false,  // 新增參數，指示是否為公開瀏覽模式
  onShowNotification = null,  // 新增參數，用於顯示通知
  targetAbnormalPostId = null  // 新增參數，目標異常記錄ID
}) => {
  const { t, i18n } = useTranslation('archives');
  const { formatSymptomsForDisplay } = useSymptomTranslation();
  const navigate = useNavigate();
  const { petId } = useParams();
  const [validatedArchiveData, setValidatedArchiveData] = useState(archiveData);
  const [isValidating, setIsValidating] = useState(false);
  const [hasValidated, setHasValidated] = useState(false);
  
  // 獲取寵物ID，優先使用pet物件的ID，然後是URL參數
  const getPetId = () => {
    if (pet?.pet_id) return pet.pet_id;
    if (pet?.id) return pet.id;
    return petId;
  };

  // 使用 useMemo 來記憶異常記錄的 ID，避免不必要的重新驗證
  const abnormalPostIds = useMemo(() => {
    return archiveData?.abnormalPostsData?.map(post => post.id) || [];
  }, [archiveData?.abnormalPostsData]);

  // 驗證異常記錄是否存在並更新檔案
  useEffect(() => {
    // 如果已經驗證過，或者沒有異常記錄，直接返回
    if (hasValidated || abnormalPostIds.length === 0) {
      setValidatedArchiveData(archiveData);
      return;
    }

    
    const validateAndUpdateArchive = async () => {
      setIsValidating(true);
      try {
        // 獲取當前寵物ID
        const currentPetId = getPetId();
        
        // 批量驗證異常記錄是否存在，傳入 petId
        const { validIds, invalidIds } = await validateAbnormalPostsExist(abnormalPostIds, currentPetId);
        
        // 如果有無效的記錄
        if (invalidIds.length > 0) {
          console.log(t('archiveCard.messages.foundDeletedRecords', { count: invalidIds.length }));
          
          // 過濾出仍然有效的異常記錄
          const validPosts = archiveData.abnormalPostsData.filter(
            post => validIds.includes(post.id)
          );
          
          // 更新本地狀態
          const updatedArchiveData = {
            ...archiveData,
            abnormalPostsData: validPosts
          };
          setValidatedArchiveData(updatedArchiveData);
          
          // 只有擁有者才能更新資料庫中的檔案
          const isOwner = !isPublicView && currentUser && user && currentUser.id === user.id;

          if (isOwner) {
            // 如果有archiveId，更新資料庫中的檔案
            const archiveId = archiveData.id ||
                             archiveData.archive_id ||
                             archiveData.archiveId ||
                             archiveData.diseaseArchiveId ||
                             archiveData.disease_archive_id ||
                             archiveData.postFrame;

            if (archiveId) {
              const updateResult = await updateDiseaseArchive(archiveId, {
                abnormal_posts: validIds
              });

              if (updateResult.success) {
                console.log(t('archiveCard.messages.archiveUpdated'));
                if (onShowNotification) {
                  onShowNotification(t('archiveCard.messages.autoRemovedRecords', { count: invalidIds.length }));
                }
              } else {
                console.error(t('archiveCard.messages.updateArchiveFailed'), updateResult.error);
              }
            }
          }
        } else {
          // 所有記錄都有效，使用原始資料
          setValidatedArchiveData(archiveData);
        }
        
        // 標記為已驗證
        setHasValidated(true);
      } catch (error) {
        console.error(t('archiveCard.messages.validateRecordsError'), error);
        // 發生錯誤時使用原始資料
        setValidatedArchiveData(archiveData);
        setHasValidated(true);
      } finally {
        setIsValidating(false);
      }
    };

    validateAndUpdateArchive();
  }, [abnormalPostIds, archiveData, hasValidated, onShowNotification]);

  // 滾動到目標異常記錄
  useEffect(() => {
    if (targetAbnormalPostId && validatedArchiveData && !isValidating) {
      // 延遲執行，確保DOM已渲染，並且驗證完成
      const scrollToTarget = () => {
        const elementId = `abnormal-post-${targetAbnormalPostId}`;
        const element = document.getElementById(elementId);
        
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      };

      // 使用多次延遲重試，確保DOM完全渲染
      setTimeout(scrollToTarget, 300);
      setTimeout(scrollToTarget, 800);
      setTimeout(scrollToTarget, 1500);
    }
  }, [targetAbnormalPostId, validatedArchiveData, isValidating]);

  // 處理用戶點擊
  const handleUserClick = (e) => {
    // 阻止事件冒泡
    e.stopPropagation();
    
    if (!user || !currentUser) return;
    
    console.log(t('archiveCard.messages.userClicked'), {
      clickedUser: user,
      currentUser: currentUser
    });
    
    // 判斷是否為當前用戶
    const isCurrentUser = currentUser && (
      user.id === currentUser.id || 
      user.user_account === currentUser.user_account
    );
    
    if (isCurrentUser) {
      // 如果是當前用戶，導向自己的個人資料頁面
      console.log(t('archiveCard.messages.navigateToOwnProfile'));
      navigate('/user-profile');
    } else {
      // 預設行為：跳轉到其他用戶個人資料頁面
      const userAccount = user.user_account || user.username;
      if (userAccount) {
        console.log(t('archiveCard.messages.navigateToUserProfile'), `/user/${userAccount}`);
        navigate(`/user/${userAccount}`);
      }
    }
  };

  // 格式化診斷狀態 - 支援新舊兩種格式
  const formatDiagnosisStatus = (data) => {
    // 新格式：使用 goToDoctor (boolean)
    if (data.goToDoctor !== undefined) {
      return data.goToDoctor ? t('archiveCard.status.diagnosed') : t('archiveCard.status.undiagnosed');
    }
    // 舊格式：使用 diagnosisStatus (string)
    if (data.diagnosisStatus) {
      return data.diagnosisStatus === 'diagnosed' ? t('archiveCard.status.diagnosed') : t('archiveCard.status.undiagnosed');
    }
    return t('archiveCard.status.undiagnosed'); // 預設值
  };

  // 格式化治療狀態 - 支援新舊兩種格式
  const formatTreatmentStatus = (data) => {
    // 新格式：使用 healthStatus (string)
    if (data.healthStatus) {
      return data.healthStatus;
    }
    // 舊格式：使用 treatmentStatus (string)
    if (data.treatmentStatus) {
      return data.treatmentStatus === 'treated' ? t('archiveCard.status.cured') : t('archiveCard.status.notCured');
    }
    return t('archiveCard.status.treating'); // 預設值
  };

  // 判斷診斷狀態的樣式類
  const getDiagnosisStatusClass = (data) => {
    if (data.goToDoctor !== undefined) {
      return data.goToDoctor ? 'diagnosed' : 'undiagnosed';
    }
    if (data.diagnosisStatus) {
      return data.diagnosisStatus === 'diagnosed' ? 'diagnosed' : 'undiagnosed';
    }
    return 'undiagnosed';
  };

  // 判斷治療狀態的樣式類
  const getTreatmentStatusClass = (data) => {
    if (data.healthStatus) {
      return data.healthStatus === t('archiveCard.status.cured') ? 'treated' : 'untreated';
    }
    if (data.treatmentStatus) {
      return data.treatmentStatus === 'treated' ? 'treated' : 'untreated';
    }
    return 'untreated';
  };


  // 檢測內容的語言
  const detectContentLanguage = (content) => {
    if (!content) return 'zh';

    // 各語言的特徵檢測，增加權重機制
    const languagePatterns = {
      'zh': [
        { pattern: /[\u4e00-\u9fff]/g, weight: 2 },  // 中文字符（高權重）
        { pattern: /\d{1,2}月\d{1,2}日/g, weight: 10 },  // 中文日期格式（極高權重）
        { pattern: /的|是|在|有|和|與|但|或|因為|所以|這|那|將|會|能|可以|已經|正在/g, weight: 3 }  // 常見中文詞
      ],
      'en': [
        { pattern: /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}\b/g, weight: 15 },  // 英文日期格式（極高權重）
        { pattern: /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}\b/g, weight: 15 },
        { pattern: /\b(the|and|or|but|in|on|at|to|for|with|by|from|up|about|into|through|during|was|were|had|have|has|been|being|will|would|could|should)\b/gi, weight: 1 },  // 常見英文詞（低權重但數量多）
        { pattern: /[a-zA-Z]{4,}/g, weight: 0.5 }  // 長英文單詞（非常低權重）
      ],
      'es': [
        { pattern: /\d{1,2}\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)/g, weight: 15 },  // 西班牙文日期
        { pattern: /\b(el|la|los|las|un|una|de|del|en|con|por|para|que|y|o|pero|fue|era|había|tiene|tenía|será|sería)\b/gi, weight: 2 }  // 常見西班牙文詞
      ],
      'ja': [
        { pattern: /[\u3040-\u309f\u30a0-\u30ff]/g, weight: 3 },  // 平假名和片假名（高權重）
        { pattern: /\d{1,2}月\d{1,2}日/g, weight: 8 },  // 日文日期格式（比中文稍低權重，因為格式相同）
        { pattern: /です|である|した|する|された|されて|について|から|まで|によって|として|において/g, weight: 5 }  // 常見日文詞尾（高權重）
      ],
      'ko': [
        { pattern: /[\uac00-\ud7af]/g, weight: 3 },  // 韓文字符（高權重）
        { pattern: /\d{1,2}월\s*\d{1,2}일/g, weight: 15 },  // 韓文日期格式（極高權重）
        { pattern: /는|은|이|가|을|를|에|의|와|과|도|만|부터|까지|에서|으로|로|에게|한테/g, weight: 4 }  // 常見韓文助詞（高權重）
      ]
    };

    const scores = {};

    // 計算每種語言的加權分數
    Object.keys(languagePatterns).forEach(lang => {
      let score = 0;
      languagePatterns[lang].forEach(({ pattern, weight }) => {
        const matches = content.match(pattern);
        if (matches) {
          score += matches.length * weight;
        }
      });
      scores[lang] = score;
    });

    // 找出分數最高的語言
    const detectedLang = Object.keys(scores).reduce((a, b) => scores[a] > scores[b] ? a : b);

    // 如果所有語言分數都很低，則使用當前界面語言作為後備
    if (scores[detectedLang] < 3) {
      const currentLang = i18n.language.split('-')[0];
      return ['zh', 'en', 'es', 'ja', 'ko'].includes(currentLang) ? currentLang : 'zh';
    }

    // 為了調試，可以在控制台輸出檢測結果
    console.log('Language detection scores:', scores, 'Detected:', detectedLang);

    return detectedLang;
  };

  // 解析AI內容並格式化顯示
  const parseAndRenderContent = (content) => {
    if (!content) return <p className={styles.noContent}>{t('archiveCard.noContent')}</p>;

    const sections = [];

    // 將內容按段落分割（以雙換行或單換行分隔）
    const paragraphs = content.split(/\n+/).filter(p => p.trim());

    // 檢測內容語言
    const contentLang = detectContentLanguage(content);

    // 多語言日期格式檢測（允許在段落任何位置出現）
    const datePatterns = {
      'zh': /(\d{1,2})月(\d{1,2})日/g,  // 中文：12月3日
      'en': /([A-Za-z]+)\s+(\d{1,2})/g,  // 英文：Dec 3, January 15
      'ja': /(\d{1,2})月(\d{1,2})日/g,  // 日文：12月3日
      'ko': /(\d{1,2})월\s*(\d{1,2})일/g,  // 韓文：12월 3일
      'es': /(\d{1,2})\s+de\s+([a-zA-Z]+)/g  // 西班牙文：3 de diciembre
    };

    // 根據檢測到的內容語言選擇日期格式
    const datePattern = datePatterns[contentLang] || datePatterns['zh'];
    
    paragraphs.forEach(paragraph => {
      const trimmedParagraph = paragraph.trim();
      if (!trimmedParagraph) return;

      // 重置正則表達式，因為使用了全局標誌
      datePattern.lastIndex = 0;
      const dateMatches = [...trimmedParagraph.matchAll(datePattern)];

      if (dateMatches.length > 0) {
        // 段落中包含日期，只為第一個檢測到的日期創建一個區段
        // 這樣避免同一段落創建多個重複區段
        const dateMatch = dateMatches[0]; // 只取第一個匹配
        const year = new Date().getFullYear();
        let month, day;

        if (contentLang === 'en') {
          // 英文格式：Dec 3, January 15
          const monthNames = {
            'jan': 1, 'january': 1,
            'feb': 2, 'february': 2,
            'mar': 3, 'march': 3,
            'apr': 4, 'april': 4,
            'may': 5,
            'jun': 6, 'june': 6,
            'jul': 7, 'july': 7,
            'aug': 8, 'august': 8,
            'sep': 9, 'september': 9,
            'oct': 10, 'october': 10,
            'nov': 11, 'november': 11,
            'dec': 12, 'december': 12
          };
          month = monthNames[dateMatch[1].toLowerCase()] || 1;
          day = parseInt(dateMatch[2]);
        } else if (contentLang === 'es') {
          // 西班牙文格式：3 de diciembre
          const monthNames = {
            'enero': 1, 'febrero': 2, 'marzo': 3, 'abril': 4,
            'mayo': 5, 'junio': 6, 'julio': 7, 'agosto': 8,
            'septiembre': 9, 'octubre': 10, 'noviembre': 11, 'diciembre': 12
          };
          day = parseInt(dateMatch[1]);
          month = monthNames[dateMatch[2].toLowerCase()] || 1;
        } else {
          // 中文、日文、韓文格式：數字格式
          month = parseInt(dateMatch[1]);
          day = parseInt(dateMatch[2]);
        }

        sections.push({
          date: dateMatch[0],
          year,
          month,
          day,
          content: [trimmedParagraph],
          abnormalPosts: []
        });
      } else {
        // 段落中沒有日期，作為普通段落處理
        sections.push({
          date: null,
          content: [trimmedParagraph],
          abnormalPosts: []
        });
      }
    });
    
    // 如果沒有找到任何段落，返回整個內容
    if (sections.length === 0) {
      return (
        <div className={styles.contentSection}>
          <p className={styles.contentLine}>{content}</p>
        </div>
      );
    }

    // 匹配異常記錄到對應的日期段落（使用驗證後的資料）
    if (validatedArchiveData && validatedArchiveData.abnormalPostsData && validatedArchiveData.abnormalPostsData.length > 0) {
      sections.forEach(section => {
        if (section.year && section.month && section.day) {
          // 構建日期字串來匹配
          const dateStr = `${section.year}-${String(section.month).padStart(2, '0')}-${String(section.day).padStart(2, '0')}`;

          // 查找該日期的異常記錄
          const postsForDate = validatedArchiveData.abnormalPostsData.filter(post => {
            const postDate = new Date(post.record_date);
            // 使用 UTC 方法來避免時區問題
            const postDateStr = `${postDate.getUTCFullYear()}-${String(postDate.getUTCMonth() + 1).padStart(2, '0')}-${String(postDate.getUTCDate()).padStart(2, '0')}`;
            return postDateStr === dateStr;
          });

          // 格式化異常記錄數據，根據檢測到的內容語言格式化日期顯示
          section.abnormalPosts = postsForDate.map(post => {
            let formattedDate;
            if (contentLang === 'en') {
              // 英文格式
              const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                                'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
              formattedDate = `${monthNames[section.month - 1]} ${section.day}`;
            } else if (contentLang === 'es') {
              // 西班牙文格式
              const monthNames = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
                                'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
              formattedDate = `${section.day} de ${monthNames[section.month - 1]}`;
            } else if (contentLang === 'ko') {
              // 韓文格式
              formattedDate = `${section.month}월 ${section.day}일`;
            } else {
              // 中文和日文格式
              formattedDate = `${section.month}月${section.day}日`;
            }

            return {
              id: post.id,
              date: formattedDate,
              symptoms: Array.isArray(post.symptoms)
                ? formatSymptomsForDisplay(post.symptoms.map(s => s.symptom_name || s))
                : formatSymptomsForDisplay(post.symptoms) || t('archiveCard.noSymptoms')
            };
          });
        }
      });
    }

    return sections.map((section, index) => (
      <div key={index} className={styles.contentSection}>
        {section.content.map((line, lineIndex) => (
          <p key={lineIndex} className={section.date && lineIndex === 0 ? styles.dateTitle : styles.contentLine}>
            {line}
          </p>
        ))}
        {/* 插入對應日期的異常記錄預覽 */}
        {section.abnormalPosts && section.abnormalPosts.length > 0 && (
          <div className={styles.abnormalPostsPreview}>
            {section.abnormalPosts.map(post => (
              <div 
                key={post.id}
                id={`abnormal-post-${post.id}`}
                className={styles.abnormalPostPreview}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  
                  if (isPublicView) {
                    // 公開瀏覽模式下，導向公開異常貼文詳情頁面
                    navigate(`/abnormal-post/${post.id}/public`, {
                      state: { 
                        targetAbnormalPostId: post.id
                      }
                    });
                    return;
                  }
                  const currentPetId = getPetId();
                  if (currentPetId) {
                    navigate(`/pet/${currentPetId}/abnormal-post/${post.id}`, {
                      state: { 
                        targetAbnormalPostId: post.id,
                        fromDiseaseArchive: true,
                        diseaseArchiveId: archiveData.id || archiveData.archive_id || archiveData.archiveId
                      }
                    });
                  } else {
                    console.error(t('archiveCard.messages.cannotGetPetId'));
                    if (onShowNotification) {
                      onShowNotification(t('archiveCard.messages.cannotFindPetInfo'));
                    }
                  }
                }}
                style={{ 
                  cursor: 'pointer',
                  userSelect: 'none',
                  pointerEvents: 'auto'
                }}
              >
                <div className={styles.postPreviewIcon}>
                  <img src="/assets/icon/PetpagePetAbnormalPostButton.png" alt={t('archiveCard.abnormalRecordAlt')} />
                </div>
                <div className={styles.postPreviewContent}>
                  <div className={styles.postPreviewDate}>{post.date}</div>
                  <div className={styles.postPreviewSymptoms}>
                    {t('archiveCard.symptoms')}：{formatSymptomsForDisplay(post.symptoms)}
                  </div>
                </div>
                <div className={styles.postPreviewArrow}>❯</div>
              </div>
            ))}
          </div>
        )}
      </div>
    ));
  };

  // 如果正在驗證，顯示載入狀態
  if (isValidating) {
    return (
      <div className={styles.archiveCard}>
        <div className={styles.loadingMessage}>{t('archiveCard.validatingRecords')}</div>
      </div>
    );
  }

  return (
    <div className={styles.archiveCard}>
      {/* 用戶資訊區域 - 參考PostPreviewPage的userInfo設計 */}
      <div className={styles.userInfo}>
        <img 
          src={user?.headshot_url || '/assets/icon/DefaultAvatar.jpg'} 
          alt={user?.user_account}
          className={styles.userAvatar}
          onClick={handleUserClick}
        />
        <div className={styles.userDetails}>
          <h3 className={styles.userName} onClick={handleUserClick}>{user?.user_account || t('archiveCard.unknownUser')}</h3>
          <div className={styles.petInfo}>
            <span className={styles.petName}>{t('archiveCard.pet')}：{pet?.pet_name || t('archiveCard.unknownPet')}</span>
            <span className={styles.petSeparator}>•</span>
            <span className={styles.petType}>{pet?.breed || pet?.species || t('archiveCard.unknownBreed')}</span>
          </div>
        </div>
      </div>

      {/* 檔案標題和狀態標籤 */}
      <div className={styles.archiveHeader}>
        <h2 className={styles.archiveTitle}>{validatedArchiveData.archiveTitle}</h2>
        <div className={styles.statusTags}>
          <span className={`${styles.statusTag} ${styles[getDiagnosisStatusClass(validatedArchiveData)]}`}>
            {formatDiagnosisStatus(validatedArchiveData)}
          </span>
          <span className={`${styles.statusTag} ${styles[getTreatmentStatusClass(validatedArchiveData)]}`}>
            {formatTreatmentStatus(validatedArchiveData)}
          </span>
        </div>
      </div>

      {/* 主要病因（如果有） */}
      {validatedArchiveData.mainCause && (
        <div className={styles.mainCause}>
          <span className={styles.causeLabel}>{t('archiveCard.mainCause')}：</span>
          <span className={styles.causeText}>{validatedArchiveData.mainCause}</span>
        </div>
      )}

      {/* 內容區域 */}
      <div className={styles.contentArea}>
        {validatedArchiveData.generated_content ? (
          parseAndRenderContent(validatedArchiveData.generated_content)
        ) : (
          <p className={styles.noContent}>{t('archiveCard.noContent')}</p>
        )}
      </div>

      {/* 症狀日曆 */}
      <SymptomCalendar 
        abnormalPostsData={validatedArchiveData.abnormalPostsData || []}
        symptoms={validatedArchiveData.symptoms || []}
      />

      {/* 症狀標籤（如果有） */}
      {validatedArchiveData.symptoms && validatedArchiveData.symptoms.length > 0 && (
        <div className={styles.symptomsSection}>
          <span className={styles.symptomsLabel}>{t('archiveCard.relatedSymptoms')}：</span>
          <div className={styles.symptomsTags}>
            {validatedArchiveData.symptoms.map((symptom, index) => (
              <span key={index} className={styles.symptomTag}>
                {formatSymptomsForDisplay(typeof symptom === 'string' ? symptom : symptom.text)}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 時間資訊 */}
      <div className={styles.timeInfo}>
        {t('archiveCard.createdAt')} {new Date().toLocaleDateString(i18n.language === 'en' ? 'en-US' : 'zh-TW')}
      </div>
    </div>
  );
};

export default ArchiveCard;