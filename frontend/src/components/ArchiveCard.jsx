import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import SymptomCalendar from './SymptomCalendar';
import styles from '../styles/ArchiveCard.module.css';
import { validateAbnormalPostsExist, updateDiseaseArchive } from '../services/petService';

const ArchiveCard = ({ 
  archiveData,
  user,
  pet,
  currentUser,  // 新增參數，當前登入的用戶
  isPublicView = false,  // 新增參數，指示是否為公開瀏覽模式
  onShowNotification = null  // 新增參數，用於顯示通知
}) => {
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

    // 調試：輸出 archiveData 的結構（只在第一次時輸出）
    console.log('ArchiveCard - archiveData 結構:', archiveData);
    console.log('ArchiveCard - archiveData keys:', Object.keys(archiveData || {}));
    
    const validateAndUpdateArchive = async () => {
      setIsValidating(true);
      try {
        // 獲取當前寵物ID
        const currentPetId = getPetId();
        
        // 批量驗證異常記錄是否存在，傳入 petId
        const { validIds, invalidIds } = await validateAbnormalPostsExist(abnormalPostIds, currentPetId);
        
        // 如果有無效的記錄
        if (invalidIds.length > 0) {
          console.log(`發現 ${invalidIds.length} 個已刪除的異常記錄，準備移除...`);
          
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
              console.log('疾病檔案已更新，移除了已刪除的異常記錄');
              if (onShowNotification) {
                onShowNotification(`已自動移除 ${invalidIds.length} 個已刪除的異常記錄`);
              }
            } else {
              console.error('更新疾病檔案失敗:', updateResult.error);
            }
          }
        } else {
          // 所有記錄都有效，使用原始資料
          setValidatedArchiveData(archiveData);
        }
        
        // 標記為已驗證
        setHasValidated(true);
      } catch (error) {
        console.error('驗證異常記錄時發生錯誤:', error);
        // 發生錯誤時使用原始資料
        setValidatedArchiveData(archiveData);
        setHasValidated(true);
      } finally {
        setIsValidating(false);
      }
    };

    validateAndUpdateArchive();
  }, [abnormalPostIds, archiveData, hasValidated, onShowNotification]);

  // 處理用戶點擊
  const handleUserClick = (e) => {
    // 阻止事件冒泡
    e.stopPropagation();
    
    if (!user || !currentUser) return;
    
    console.log('ArchiveCard 用戶點擊:', {
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
      console.log('ArchiveCard - 導航到自己的個人資料頁面');
      navigate('/user-profile');
    } else {
      // 預設行為：跳轉到其他用戶個人資料頁面
      const userAccount = user.user_account || user.username;
      if (userAccount) {
        console.log('ArchiveCard - 導航到其他用戶個人資料頁面:', `/user/${userAccount}`);
        navigate(`/user/${userAccount}`);
      }
    }
  };

  // 格式化診斷狀態
  const formatDiagnosisStatus = (status) => {
    return status === 'diagnosed' ? '已就醫' : '未就醫';
  };

  // 格式化治療狀態
  const formatTreatmentStatus = (status) => {
    return status === 'treated' ? '已痊癒' : '未痊癒';
  };


  // 解析AI內容並格式化顯示
  const parseAndRenderContent = (content) => {
    if (!content) return <p className={styles.noContent}>暫無內容</p>;

    const sections = [];
    
    // 將內容按段落分割（以雙換行或單換行分隔）
    const paragraphs = content.split(/\n+/).filter(p => p.trim());
    
    // 日期格式檢測
    const datePattern = /^(\d{1,2})月(\d{1,2})日/;
    
    paragraphs.forEach(paragraph => {
      const trimmedParagraph = paragraph.trim();
      if (!trimmedParagraph) return;
      
      const dateMatch = trimmedParagraph.match(datePattern);
      
      if (dateMatch) {
        // 是日期段落
        const year = new Date().getFullYear();
        const month = parseInt(dateMatch[1]);
        const day = parseInt(dateMatch[2]);
        
        sections.push({
          date: dateMatch[0],
          year,
          month,
          day,
          content: [trimmedParagraph],
          abnormalPosts: []
        });
      } else {
        // 不是日期段落，作為普通段落處理
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
          
          // 格式化異常記錄數據
          section.abnormalPosts = postsForDate.map(post => ({
            id: post.id,
            date: `${section.month}月${section.day}日`,
            symptoms: Array.isArray(post.symptoms) 
              ? post.symptoms.map(s => s.symptom_name || s).join('、')
              : post.symptoms || '無症狀記錄'
          }));
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
                className={styles.abnormalPostPreview}
                onClick={() => {
                  if (isPublicView) {
                    // 公開瀏覽模式下，導向公開異常貼文詳情頁面
                    navigate(`/abnormal-post/${post.id}/public`);
                    return;
                  }
                  const currentPetId = getPetId();
                  if (currentPetId) {
                    navigate(`/pet/${currentPetId}/abnormal-post/${post.id}`);
                  } else {
                    console.error('無法獲取寵物ID');
                    if (onShowNotification) {
                      onShowNotification('無法找到寵物資訊');
                    }
                  }
                }}
                style={{ 
                  cursor: 'pointer'
                }}
              >
                <div className={styles.postPreviewIcon}>
                  <img src="/assets/icon/PetpagePetAbnormalPostButton.png" alt="異常記錄" />
                </div>
                <div className={styles.postPreviewContent}>
                  <div className={styles.postPreviewDate}>{post.date}</div>
                  <div className={styles.postPreviewSymptoms}>
                    症狀：{post.symptoms}
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
        <div className={styles.loadingMessage}>正在驗證異常記錄...</div>
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
          <h3 className={styles.userName} onClick={handleUserClick}>{user?.user_account || '未知用戶'}</h3>
          <div className={styles.petInfo}>
            <span className={styles.petName}>寵物：{pet?.pet_name || '未知寵物'}</span>
            <span className={styles.petSeparator}>•</span>
            <span className={styles.petType}>{pet?.breed || pet?.species || '未知品種'}</span>
          </div>
        </div>
      </div>

      {/* 檔案標題和狀態標籤 */}
      <div className={styles.archiveHeader}>
        <h2 className={styles.archiveTitle}>{validatedArchiveData.archiveTitle}</h2>
        <div className={styles.statusTags}>
          <span className={`${styles.statusTag} ${validatedArchiveData.diagnosisStatus === 'diagnosed' ? styles.diagnosed : styles.undiagnosed}`}>
            {formatDiagnosisStatus(validatedArchiveData.diagnosisStatus)}
          </span>
          <span className={`${styles.statusTag} ${validatedArchiveData.treatmentStatus === 'treated' ? styles.treated : styles.untreated}`}>
            {formatTreatmentStatus(validatedArchiveData.treatmentStatus)}
          </span>
        </div>
      </div>

      {/* 主要病因（如果有） */}
      {validatedArchiveData.mainCause && (
        <div className={styles.mainCause}>
          <span className={styles.causeLabel}>主要病因：</span>
          <span className={styles.causeText}>{validatedArchiveData.mainCause}</span>
        </div>
      )}

      {/* 內容區域 */}
      <div className={styles.contentArea}>
        {validatedArchiveData.generated_content ? (
          parseAndRenderContent(validatedArchiveData.generated_content)
        ) : (
          <p className={styles.noContent}>暫無內容</p>
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
          <span className={styles.symptomsLabel}>相關症狀：</span>
          <div className={styles.symptomsTags}>
            {validatedArchiveData.symptoms.map((symptom, index) => (
              <span key={index} className={styles.symptomTag}>
                {typeof symptom === 'string' ? symptom : symptom.text}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 時間資訊 */}
      <div className={styles.timeInfo}>
        建立於 {new Date().toLocaleDateString('zh-TW')}
      </div>
    </div>
  );
};

export default ArchiveCard;