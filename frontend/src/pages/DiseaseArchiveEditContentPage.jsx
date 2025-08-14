import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import TopNavbar from '../components/TopNavbar';
import BottomNavbar from '../components/BottomNavigationBar';
import Notification from '../components/Notification';
import ConfirmNotification from '../components/ConfirmNotification';
import { NotificationProvider } from '../context/NotificationContext';
import { getUserPets, generateDiseaseArchiveContent } from '../services/petService';
import styles from '../styles/DiseaseArchiveEditContentPage.module.css';

const DiseaseArchiveEditContentPage = () => {
  const { petId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [loading, setLoading] = useState(true);
  const [pet, setPet] = useState(null);
  const [notification, setNotification] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState('');
  
  // 確認對話框狀態
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState('');
  const [confirmAction, setConfirmAction] = useState(null);
  
  // 從導航傳遞的數據
  const [archiveData, setArchiveData] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // 顯示通知
  const showNotification = (msg) => {
    setNotification(msg);
  };

  // 隱藏通知
  const hideNotification = () => {
    setNotification('');
  };

  // 顯示確認對話框
  const showConfirmNotification = (message, action) => {
    setConfirmMessage(message);
    setConfirmAction(() => action);
    setShowConfirmDialog(true);
  };

  // 處理確認對話框的確認按鈕
  const handleConfirmAction = () => {
    if (confirmAction) {
      confirmAction();
    }
    setShowConfirmDialog(false);
    setConfirmAction(null);
  };

  // 處理確認對話框的取消按鈕
  const handleCancelAction = () => {
    handleCancelNavigation();
  };

  // 載入頁面數據
  useEffect(() => {
    loadPageData();
  }, [petId]);

  const loadPageData = async () => {
    try {
      setLoading(true);
      
      // 檢查是否有從前一頁傳來的數據
      if (!location.state || !location.state.formData) {
        showNotification('缺少必要數據，返回第一步驟');
        setTimeout(() => {
          navigate(`/pet/${petId}/disease-archive/create`);
        }, 1500);
        return;
      }
      
      // 載入寵物資料
      const pets = await getUserPets();
      const currentPet = pets.find(p => p.pet_id === parseInt(petId));
      if (currentPet) {
        setPet(currentPet);
      }
      
      // 檢查是否需要生成內容
      if (location.state.needsGeneration) {
        // 需要生成內容，先設置初始檔案數據
        const initialData = {
          ...location.state.formData,
          generated_content: ''
        };
        setArchiveData(initialData);
        setEditedContent('');
        
        // 先結束載入狀態，顯示頁面內容
        setLoading(false);
        
        // 開始生成內容（此時 isGenerating 會在 generateArchiveContent 中設為 true）
        await generateArchiveContent(location.state.formData);
      } else {
        // 已有生成的內容
        const data = location.state.formData;
        setArchiveData(data);
        setEditedContent(data.generated_content || '');
        setLoading(false);
      }
      
    } catch (error) {
      console.error('載入資料失敗:', error);
      showNotification('載入資料失敗');
      setLoading(false);
    }
  };

  // 生成檔案內容
  const generateArchiveContent = async (formData) => {
    try {
      setIsGenerating(true);
      
      // 準備 API 請求數據
      const requestData = {
        petId: parseInt(petId),
        archiveTitle: formData.archiveTitle,
        diagnosisStatus: formData.diagnosisStatus,
        treatmentStatus: formData.treatmentStatus,
        mainCause: formData.mainCause || '',
        symptoms: formData.symptoms,
        includedAbnormalPostIds: formData.includedAbnormalPostIds
      };
      
      // 調用 API 生成內容
      const response = await generateDiseaseArchiveContent(requestData);
      
      // 更新檔案數據
      const updatedData = {
        ...formData,
        generated_content: response.generated_content || '生成內容失敗'
      };
      
      setArchiveData(updatedData);
      setEditedContent(updatedData.generated_content);
      
    } catch (error) {
      console.error('生成檔案內容失敗:', error);
      
      let errorMessage = '生成檔案內容失敗';
      if (error.code === 'ECONNABORTED') {
        errorMessage = 'AI 生成超時，請稍後再試';
      } else if (error.response?.status === 500) {
        errorMessage = 'AI 服務暫時不可用，請稍後再試';
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      }
      
      showNotification(errorMessage);
      
      // 設置預設內容
      const fallbackData = {
        ...formData,
        generated_content: '內容生成失敗，請手動編輯或重新嘗試。'
      };
      
      setArchiveData(fallbackData);
      setEditedContent(fallbackData.generated_content);
      
    } finally {
      setIsGenerating(false);
    }
  };

  // 處理編輯按鈕
  const handleEditClick = () => {
    setIsEditing(true);
  };

  // 驗證內容格式
  const validateContent = (content) => {
    const errors = [];
    
    // 基本驗證：檢查內容是否為空
    if (!content || content.trim().length === 0) {
      errors.push('內容不能為空');
      return errors;
    }
    
    // 檢查內容長度（可選）
    if (content.length < 50) {
      errors.push('內容過短，請提供更詳細的描述');
    }
    
    // 溫和提示：檢查日期格式的最佳實踐（不再強制限制）
    const lines = content.split('\n');
    const datePattern = /^\d{1,2}月\d{1,2}日/;
    let hasDateInMiddle = false;
    
    lines.forEach((line) => {
      const trimmedLine = line.trim();
      if (trimmedLine) {
        // 檢查行中是否包含日期格式，但不在開頭
        const dateInLinePattern = /\d{1,2}月\d{1,2}日/;
        if (dateInLinePattern.test(trimmedLine) && !datePattern.test(trimmedLine)) {
          hasDateInMiddle = true;
        }
      }
    });
    
    // 只提供建議，不強制限制
    if (hasDateInMiddle && !isEditing) {
      console.log('提示：日期格式建議放在段落開頭，以便系統更好地關聯異常記錄');
    }
    
    return errors;
  };

  // 處理儲存編輯
  const handleSaveEdit = () => {
    // 驗證內容格式
    const validationErrors = validateContent(editedContent);
    
    if (validationErrors.length > 0) {
      showNotification(`內容格式錯誤：${validationErrors[0]}`);
      return;
    }
    
    setIsEditing(false);
    // 更新檔案數據中的內容
    setArchiveData(prev => ({
      ...prev,
      generated_content: editedContent
    }));
    showNotification('編輯內容已保存');
  };

  // 處理取消編輯
  const handleCancelEdit = () => {
    setEditedContent(archiveData.generated_content);
    setIsEditing(false);
  };

  // 處理上一步按鈕
  const handlePreviousStep = () => {
    showConfirmNotification(
      '確認返回上一步？此份AI統整紀錄將會被捨棄。',
      () => {
        navigate(`/pet/${petId}/disease-archive/create`);
      }
    );
  };

  // 處理確認檔案按鈕
  const handleConfirmArchive = async () => {
    // 準備傳遞到預覽頁面的數據，包含編輯後的內容
    const previewData = {
      ...archiveData,
      generated_content: editedContent || archiveData.generated_content,
      abnormalPostsData: [], // 預設空陣列，之後可以從API獲取
      // 轉換字段名稱以符合後端API期望
      goToDoctor: archiveData.diagnosisStatus === 'diagnosed',
      healthStatus: archiveData.treatmentStatus === 'treated' ? '已痊癒' : '治療中'
    };
    
    // 如果有異常記錄ID，可以在這裡獲取詳細資料
    // 目前先直接導航，異常記錄資料可以在預覽頁面載入
    
    // 導航到預覽頁面
    navigate(`/pet/${petId}/disease-archive/preview`, {
      state: {
        archiveData: previewData
      }
    });
  };

  // 設置頁面離開提醒
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      console.log('beforeunload 觸發, archiveData:', archiveData);
      // 只要進入了這個頁面就顯示提醒（簡化判斷條件）
      if (archiveData) {
        console.log('設置離開提醒');
        e.preventDefault();
        e.returnValue = '確認離開？此份AI統整紀錄將會被捨棄。';
        return '確認離開？此份AI統整紀錄將會被捨棄。';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [archiveData]);

  // 攔截 React Router 導航 - 使用 popstate 事件
  useEffect(() => {
    const handlePopState = (e) => {
      console.log('popstate 觸發, archiveData:', archiveData);
      // 只要進入了這個頁面就攔截（簡化判斷條件）
      if (archiveData) {
        console.log('攔截返回導航');
        e.preventDefault();
        // 恢復歷史狀態
        window.history.pushState(null, '', window.location.pathname);
        
        showConfirmNotification(
          '確認離開？此份AI統整紀錄將會被捨棄。',
          () => {
            // 用戶確認離開，執行實際的導航
            window.history.back();
          }
        );
      }
    };

    // 添加一個歷史記錄項目，讓返回鍵可以被攔截
    window.history.pushState(null, '', window.location.pathname);
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [archiveData]);

  // 處理導航確認的取消
  const handleCancelNavigation = () => {
    setShowConfirmDialog(false);
    setConfirmAction(null);
  };

  if (loading) {
    return (
      <NotificationProvider>
        <div className={styles.container}>
          <TopNavbar />
          <div className={styles.loadingContainer}>
            載入中...
          </div>
          <BottomNavbar />
        </div>
      </NotificationProvider>
    );
  }

  if (!archiveData) {
    return (
      <NotificationProvider>
        <div className={styles.container}>
          <TopNavbar />
          <div className={styles.errorContainer}>
            缺少必要數據，正在返回第一步驟...
          </div>
          <BottomNavbar />
        </div>
      </NotificationProvider>
    );
  }

  return (
    <NotificationProvider>
      <div className={styles.container}>
        <TopNavbar />
        
        <div className={styles.content}>
          {/* 標題區域 */}
          <div className={styles.header}>
            <div className={styles.titleSection}>
              <img 
                src={pet?.headshot_url || '/assets/icon/DefaultAvatar.jpg'} 
                alt={pet?.pet_name}
                className={styles.petAvatar}
              />
              <span className={styles.title}>製作疾病檔案</span>
            </div>
          </div>

          <div className={styles.divider}></div>

          {/* AI內容統整區域 */}
          <div className={styles.aiSection}>
            {/* AI統整標題列 */}
            <div className={styles.aiHeader}>
              <span className={styles.aiTitle}>AI內容統整</span>
              {!isEditing && (
                <button 
                  className={styles.aiEditButton}
                  onClick={handleEditClick}
                  disabled={isGenerating}
                >
                  編輯
                </button>
              )}
            </div>
            
            {/* AI內容區域 */}
            <div className={styles.aiContentArea}>
            {isEditing ? (
              <div className={styles.editingContainer}>
                <div className={styles.editingTips}>
                  <p className={styles.tipTitle}>編輯提示：</p>
                  <ul className={styles.tipList}>
                    <li>您可以自由編輯AI生成的內容</li>
                    <li>日期格式（如「12月3日」）建議放在段落開頭，系統會自動關聯對應的異常記錄</li>
                    <li>保持內容結構清晰，有助於日後查閱</li>
                  </ul>
                </div>
                <textarea
                  className={styles.contentTextarea}
                  value={editedContent}
                  onChange={(e) => setEditedContent(e.target.value)}
                  placeholder="請輸入疾病檔案內容..."
                />
                <div className={styles.editingActions}>
                  <button 
                    className={styles.cancelEditButton}
                    onClick={handleCancelEdit}
                  >
                    取消
                  </button>
                  <button 
                    className={styles.saveEditButton}
                    onClick={handleSaveEdit}
                  >
                    儲存
                  </button>
                </div>
              </div>
            ) : (
              <div className={styles.contentDisplay}>
                {isGenerating ? (
                  <div className={styles.generatingContainer}>
                    <div className={styles.generatingSpinner}></div>
                    <div className={styles.generatingText}>AI 正在分析您的寵物資料...</div>
                    <div className={styles.generatingSubText}>請稍候，這可能需要一些時間</div>
                  </div>
                ) : (
                  <div className={styles.contentText}>
                    {archiveData?.generated_content || '暫無內容'}
                  </div>
                )}
              </div>
            )}
            </div>
          </div>

          {/* 操作按鈕 */}
          <div className={styles.actionButtons}>
            <button 
              className={styles.previousButton} 
              onClick={handlePreviousStep}
              disabled={isGenerating}
            >
              上一步
            </button>
            <button 
              className={styles.confirmButton} 
              onClick={handleConfirmArchive}
              disabled={isGenerating}
            >
              預覽檔案
            </button>
          </div>
        </div>

        <BottomNavbar />
        
        {/* 通知組件 */}
        {notification && (
          <Notification message={notification} onClose={hideNotification} />
        )}
        
        {/* 確認對話框 */}
        {showConfirmDialog && (
          <ConfirmNotification 
            message={confirmMessage}
            onConfirm={handleConfirmAction}
            onCancel={handleCancelAction}
          />
        )}
      </div>
    </NotificationProvider>
  );
};

export default DiseaseArchiveEditContentPage;