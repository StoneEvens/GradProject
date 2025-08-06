import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import TopNavbar from '../components/TopNavbar';
import BottomNavbar from '../components/BottomNavigationBar';
import Notification from '../components/Notification';
import DatePicker from '../components/DatePicker';
import { NotificationProvider } from '../context/NotificationContext';
import { getUserPets, getSymptoms, searchAbnormalPostsByConditions, generateDiseaseArchiveContent, validateAbnormalPostsExist } from '../services/petService';
import styles from '../styles/CreateDiseaseArchivePage.module.css';

const CreateDiseaseArchivePage = () => {
  const { petId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [pet, setPet] = useState(null);
  const [notification, setNotification] = useState('');
  
  // 表單資料
  const [formData, setFormData] = useState({
    archiveTitle: '',
    diagnosisStatus: 'undiagnosed', // 'undiagnosed' or 'diagnosed'
    treatmentStatus: 'untreated', // 'untreated' or 'treated'
    mainCause: ''
  });

  // 症狀相關狀態
  const [selectedSymptoms, setSelectedSymptoms] = useState([]);
  const [selectedSymptomOption, setSelectedSymptomOption] = useState('');
  const [availableSymptoms, setAvailableSymptoms] = useState([]);

  // 日期範圍相關狀態
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [highlightedDates, setHighlightedDates] = useState(new Set());
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedAbnormalPost, setSelectedAbnormalPost] = useState(null);
  const [excludedPostIds, setExcludedPostIds] = useState(new Set());
  const [isSearching, setIsSearching] = useState(false);
  const [realAbnormalPosts, setRealAbnormalPosts] = useState([]);
  const [abnormalPostsForDates, setAbnormalPostsForDates] = useState({});

  // 草稿相關常數
  const DRAFT_KEY = `diseaseArchiveDraft_${petId}`;
  const [draftSaved, setDraftSaved] = useState(false);


  // 顯示通知
  const showNotification = (msg) => {
    setNotification(msg);
  };

  // 隱藏通知
  const hideNotification = () => {
    setNotification('');
  };

  // 驗證異常記錄數據完整性
  const validateAbnormalPostData = async () => {
    try {
      console.log('開始驗證CreateDiseaseArchivePage中的異常記錄數據');
      
      // 收集所有異常記錄ID
      const allPostIds = new Set();
      
      // 從realAbnormalPosts收集ID
      console.log('realAbnormalPosts:', realAbnormalPosts);
      realAbnormalPosts.forEach(post => {
        if (post && post.id) {
          allPostIds.add(post.id);
        }
      });
      
      // 從abnormalPostsForDates收集ID
      console.log('abnormalPostsForDates:', abnormalPostsForDates);
      Object.values(abnormalPostsForDates).forEach(post => {
        if (post && post.id) {
          allPostIds.add(post.id);
        }
      });
      
      const postIdsArray = Array.from(allPostIds);
      console.log('收集到的異常記錄ID:', postIdsArray);
      
      if (postIdsArray.length === 0) {
        console.log('沒有異常記錄需要驗證');
        return;
      }
      
      // 批量驗證異常記錄是否存在
      const { validIds, invalidIds } = await validateAbnormalPostsExist(postIdsArray);
      
      if (invalidIds.length > 0) {
        // 移除已刪除的記錄
        const filteredRealPosts = realAbnormalPosts.filter(post => 
          post && post.id && validIds.includes(post.id)
        );
        
        const filteredPostsForDates = {};
        Object.entries(abnormalPostsForDates).forEach(([date, post]) => {
          if (post && post.id && validIds.includes(post.id)) {
            filteredPostsForDates[date] = post;
          }
        });
        
        // 更新高亮日期
        const newHighlightedDates = new Set();
        Object.keys(filteredPostsForDates).forEach(date => {
          const [year, month, day] = date.split('-').map(Number);
          newHighlightedDates.add(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
        });
        
        // 更新排除的記錄ID
        const newExcludedPostIds = new Set(excludedPostIds);
        invalidIds.forEach(id => newExcludedPostIds.add(id));
        
        // 更新狀態
        setRealAbnormalPosts(filteredRealPosts);
        setAbnormalPostsForDates(filteredPostsForDates);
        setHighlightedDates(newHighlightedDates);
        setExcludedPostIds(newExcludedPostIds);
        
        // 顯示通知
        showNotification(`檢測到 ${invalidIds.length} 筆異常記錄已被刪除，已自動更新數據`);
        
        // 保存更新後的草稿
        saveDraft();
      }
      
    } catch (error) {
      console.error('驗證異常記錄數據失敗:', error);
    }
  };

  // 保存草稿
  const saveDraft = () => {
    try {
      const draftData = {
        formData,
        selectedSymptoms,
        startDate: startDate ? startDate.toISOString() : null,
        endDate: endDate ? endDate.toISOString() : null,
        excludedPostIds: Array.from(excludedPostIds),
        abnormalPostsForDates,
        realAbnormalPosts, // 保存真實的異常記錄數據
        highlightedDates: Array.from(highlightedDates),
        timestamp: Date.now()
      };
      
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draftData));
      setDraftSaved(true);
      
      // 3秒後隱藏保存提示
      setTimeout(() => {
        setDraftSaved(false);
      }, 3000);
    } catch (error) {
      console.error('保存草稿失敗:', error);
    }
  };

  // 載入草稿
  const loadDraft = () => {
    try {
      const savedDraft = localStorage.getItem(DRAFT_KEY);
      if (savedDraft) {
        const draftData = JSON.parse(savedDraft);
        
        // 檢查草稿是否過期（超過7天）
        const daysSinceLastSave = (Date.now() - draftData.timestamp) / (1000 * 60 * 60 * 24);
        if (daysSinceLastSave > 7) {
          localStorage.removeItem(DRAFT_KEY);
          return false;
        }
        
        // 恢復表單資料
        if (draftData.formData) {
          setFormData(draftData.formData);
        }
        
        // 恢復選中的症狀
        if (draftData.selectedSymptoms && Array.isArray(draftData.selectedSymptoms)) {
          setSelectedSymptoms(draftData.selectedSymptoms);
        }
        
        // 恢復日期範圍
        if (draftData.startDate) {
          setStartDate(new Date(draftData.startDate));
        }
        if (draftData.endDate) {
          setEndDate(new Date(draftData.endDate));
        }
        
        // 恢復異常記錄選擇狀態
        if (draftData.excludedPostIds && Array.isArray(draftData.excludedPostIds)) {
          setExcludedPostIds(new Set(draftData.excludedPostIds));
        }
        
        // 恢復異常記錄和高亮日期
        if (draftData.abnormalPostsForDates) {
          setAbnormalPostsForDates(draftData.abnormalPostsForDates);
        }
        if (draftData.realAbnormalPosts && Array.isArray(draftData.realAbnormalPosts)) {
          setRealAbnormalPosts(draftData.realAbnormalPosts);
        }
        if (draftData.highlightedDates && Array.isArray(draftData.highlightedDates)) {
          setHighlightedDates(new Set(draftData.highlightedDates));
        }
        
        return true; // 表示有載入草稿
      }
    } catch (error) {
      console.error('載入草稿失敗:', error);
      // 如果草稿損壞，清除它
      localStorage.removeItem(DRAFT_KEY);
    }
    return false;
  };

  // 清除草稿
  const clearDraft = () => {
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch (error) {
      console.error('清除草稿失敗:', error);
    }
  };

  // 載入寵物資料
  useEffect(() => {
    loadPetData();
  }, [petId]);

  // 頁面聚焦時驗證數據完整性
  useEffect(() => {
    let hasNavigatedAway = false;
    let validationTimeout = null;

    const handleBeforeUnload = () => {
      hasNavigatedAway = true;
    };

    const handleVisibilityChange = () => {
      if (!document.hidden && hasNavigatedAway && (realAbnormalPosts.length > 0 || Object.keys(abnormalPostsForDates).length > 0)) {
        // 只有在離開過頁面後重新回來才驗證
        if (validationTimeout) clearTimeout(validationTimeout);
        validationTimeout = setTimeout(() => {
          validateAbnormalPostData();
          hasNavigatedAway = false; // 重置標記
        }, 1000);
      }
    };

    const handleFocus = () => {
      if (hasNavigatedAway && (realAbnormalPosts.length > 0 || Object.keys(abnormalPostsForDates).length > 0)) {
        // 只有在離開過頁面後重新聚焦才驗證
        if (validationTimeout) clearTimeout(validationTimeout);
        validationTimeout = setTimeout(() => {
          validateAbnormalPostData();
          hasNavigatedAway = false; // 重置標記
        }, 1000);
      }
    };

    // 監聽頁面可見性變化和窗口聚焦
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (validationTimeout) clearTimeout(validationTimeout);
    };
  }, [realAbnormalPosts, abnormalPostsForDates]);

  const loadPetData = async () => {
    try {
      setLoading(true);
      
      // 載入寵物資料
      const pets = await getUserPets();
      const currentPet = pets.find(p => p.pet_id === parseInt(petId));
      if (currentPet) {
        setPet(currentPet);
      }
      
      // 載入症狀列表
      const symptoms = await getSymptoms();
      const symptomNames = symptoms.map(symptom => symptom.symptom_name);
      setAvailableSymptoms(symptomNames);
      
      // 載入草稿（在症狀列表載入完成後）
      loadDraft();
      
    } catch (error) {
      showNotification('載入資料失敗');
    } finally {
      setLoading(false);
    }
  };

  // 處理輸入框變更
  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // 處理按鈕選擇
  const handleButtonSelect = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // 處理新增症狀
  const handleAddSymptom = () => {
    if (selectedSymptomOption && !selectedSymptoms.some(s => s.text === selectedSymptomOption)) {
      const newSymptom = {
        id: Date.now(),
        text: selectedSymptomOption
      };
      setSelectedSymptoms([...selectedSymptoms, newSymptom]);
      setSelectedSymptomOption('');
    }
  };

  // 處理移除症狀
  const handleRemoveSymptom = (symptomId) => {
    setSelectedSymptoms(selectedSymptoms.filter(s => s.id !== symptomId));
  };

  // 格式化日期顯示
  const formatDate = (date) => {
    if (!date) return '';
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${year} 年 ${month} 月 ${day} 日`;
  };

  // 更新高亮日期（根據症狀篩選異常記錄）
  const updateHighlightedDates = async (start, end) => {
    if (!start || !end || !petId) return;
    
    setIsSearching(true);
    
    try {
      const selectedSymptomTexts = selectedSymptoms.map(s => s.text);
      
      // 呼叫真實API搜尋異常記錄
      const apiResponse = await searchAbnormalPostsByConditions(
        petId, 
        selectedSymptomTexts, 
        start, 
        end
      );
      
      // 確保獲取正確的陣列數據 - API回傳分頁格式，實際數據在results中
      let abnormalPosts = [];
      if (Array.isArray(apiResponse)) {
        abnormalPosts = apiResponse;
      } else if (apiResponse && Array.isArray(apiResponse.results)) {
        abnormalPosts = apiResponse.results;
      } else if (apiResponse && apiResponse.data && Array.isArray(apiResponse.data)) {
        abnormalPosts = apiResponse.data;
      }
      
      // 儲存搜尋結果
      setRealAbnormalPosts(abnormalPosts);
      
      // 建立高亮日期集合
      const newHighlightedDates = new Set();
      const postsForDates = {};
      
      abnormalPosts.forEach(post => {
        try {
          const postDate = new Date(post.record_date);
          const dateStr = `${postDate.getFullYear()}-${String(postDate.getMonth() + 1).padStart(2, '0')}-${String(postDate.getDate()).padStart(2, '0')}`;
          
          newHighlightedDates.add(dateStr);
          
          // 處理症狀數據（可能是陣列或其他格式）
          let symptomsText = '';
          if (post.symptoms && Array.isArray(post.symptoms)) {
            symptomsText = post.symptoms.map(s => s.symptom_name || s).join(' ');
          } else if (typeof post.symptoms === 'string') {
            symptomsText = post.symptoms;
          } else {
            symptomsText = '症狀資料';
          }
          
          // 建立日期對應的異常記錄資料（用於點擊時顯示）
          if (!postsForDates[dateStr]) {
            postsForDates[dateStr] = {
              id: post.id,
              date: `${postDate.getMonth() + 1}月${postDate.getDate()}日`,
              symptoms: symptomsText,
              description: post.content || '異常記錄',
              rawData: post // 保存原始數據
            };
          }
        } catch (postError) {
          // 靜默處理錯誤，跳過問題記錄
        }
      });
      
      // 保存日期對應的異常記錄資料
      setAbnormalPostsForDates(postsForDates);
      
      setHighlightedDates(newHighlightedDates);
      
      // 如果有異常記錄，將日曆移動到最早的記錄所在的月份
      if (abnormalPosts.length > 0) {
        // 按日期排序，找到最早的記錄
        const sortedPosts = [...abnormalPosts].sort((a, b) => 
          new Date(a.record_date) - new Date(b.record_date)
        );
        const earliestPost = sortedPosts[0];
        const earliestDate = new Date(earliestPost.record_date);
        
        // 確保日期有效
        if (!isNaN(earliestDate.getTime())) {
          setCurrentDate(earliestDate);
        }
      }
      
    } catch (error) {
      showNotification('搜尋異常記錄失敗，請稍後再試');
      setHighlightedDates(new Set());
    } finally {
      setIsSearching(false);
    }
  };

  // 當日期範圍或症狀改變時更新高亮
  React.useEffect(() => {
    if (startDate && endDate) {
      updateHighlightedDates(startDate, endDate);
    }
  }, [startDate, endDate, selectedSymptoms]);

  // 自動保存草稿（當表單內容變化時）
  React.useEffect(() => {
    const timeoutId = setTimeout(() => {
      // 只有當有實際內容時才保存
      if (formData.archiveTitle.trim() || 
          selectedSymptoms.length > 0 || 
          startDate || 
          endDate || 
          highlightedDates.size > 0) {
        saveDraft();
      }
    }, 2000); // 延遲2秒保存，避免頻繁保存

    return () => clearTimeout(timeoutId);
  }, [formData, selectedSymptoms, startDate, endDate, excludedPostIds, highlightedDates]);

  // 處理日曆日期點擊
  const handleDateClick = (dateStr) => {
    // 檢查是否有異常記錄（只使用真實API數據）
    const postForDate = abnormalPostsForDates[dateStr];
    
    if (postForDate) {
      setSelectedDate(dateStr);
      setSelectedAbnormalPost(postForDate);
    }
  };

  // 處理異常記錄選擇
  const handlePostSelection = (postId, include) => {
    const newExcludedIds = new Set(excludedPostIds);
    
    if (include) {
      // 重新加回這筆資料 - 從排除列表中移除
      newExcludedIds.delete(postId);
    } else {
      // 排除這筆資料 - 加入排除列表
      newExcludedIds.add(postId);
    }
    
    setExcludedPostIds(newExcludedIds);
    setSelectedDate(null);
    setSelectedAbnormalPost(null);
  };

  // 渲染日曆
  const renderCalendar = React.useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];
    const weekDays = ['日', '一', '二', '三', '四', '五', '六'];

    // 週標題
    const weekHeaders = weekDays.map(day => (
      <div key={day} className={styles.weekDay}>{day}</div>
    ));

    // 空白日期
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(<div key={`empty-${i}`} className={styles.emptyDay}></div>);
    }

    // 日期
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      
      // 檢查是否有高亮狀態
      const isHighlighted = highlightedDates.has(dateStr);
      
      // 檢查是否已排除（只使用真實API數據）
      const postForDate = abnormalPostsForDates[dateStr];
      const isExcluded = postForDate && excludedPostIds.has(postForDate.id);
      
      // 決定樣式
      let dayClassName = styles.calendarDay;
      if (isExcluded) {
        dayClassName += ` ${styles.excludedDay}`;
      } else if (isHighlighted) {
        dayClassName += ` ${styles.highlightedDay}`;
      }
      
      days.push(
        <div
          key={`${year}-${month}-${day}`} // 使用更具體的key避免重複渲染
          className={dayClassName}
          onClick={() => handleDateClick(dateStr)}
        >
          {day}
        </div>
      );
    }

    return (
      <div className={styles.calendar}>
        <div className={styles.calendarHeader}>
          <button onClick={() => setCurrentDate(new Date(year, month - 1))} className={styles.navButton}>
            &#8249;
          </button>
          <span className={styles.monthYear}>{year}年{month + 1}月</span>
          <button onClick={() => setCurrentDate(new Date(year, month + 1))} className={styles.navButton}>
            &#8250;
          </button>
        </div>
        <div className={styles.weekHeader}>
          {weekHeaders}
        </div>
        <div className={styles.daysGrid}>
          {days}
        </div>
      </div>
    );
  }, [currentDate, highlightedDates, abnormalPostsForDates, excludedPostIds]);

  // 提交表單
  const handleSubmit = async () => {
    // 驗證必填欄位
    if (!formData.archiveTitle.trim()) {
      showNotification('請輸入檔案標題');
      return;
    }

    if (!formData.diagnosisStatus) {
      showNotification('請選擇就醫狀態');
      return;
    }

    if (!formData.treatmentStatus) {
      showNotification('請選擇痊癒狀態');
      return;
    }

    // 檢查是否有選擇異常記錄
    const allFoundPostIds = realAbnormalPosts.map(post => post.id);
    const finalIncludedPostIds = allFoundPostIds.filter(id => !excludedPostIds.has(id));
    
    if (finalIncludedPostIds.length === 0) {
      showNotification('請選擇至少一筆異常記錄');
      return;
    }

    // 準備表單數據
    const formDataToPass = {
      archiveTitle: formData.archiveTitle,
      diagnosisStatus: formData.diagnosisStatus,
      treatmentStatus: formData.treatmentStatus,
      mainCause: formData.mainCause,
      symptoms: selectedSymptoms,
      includedAbnormalPostIds: finalIncludedPostIds
    };
    
    // 立即跳轉到第二步驟頁面，並傳遞表單數據（尚未有 AI 生成的內容）
    navigate(`/pet/${petId}/disease-archive/edit-content`, {
      state: {
        formData: formDataToPass,
        needsGeneration: true  // 標記需要生成內容
      }
    });
  };

  // 返回上一頁
  const handleBack = async () => {
    // 在離開前保存草稿
    const hasContent = formData.archiveTitle.trim() || 
                      selectedSymptoms.length > 0 || 
                      startDate || 
                      endDate || 
                      highlightedDates.size > 0;
    
    if (hasContent) {
      saveDraft();
    }
    
    navigate(`/pet/${petId}/disease-archive`);
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

  return (
    <NotificationProvider>
      <div className={styles.container}>
        <TopNavbar />
        
        <div className={styles.content}>
          {/* 標題列 */}
          <div className={styles.header}>
            <div className={styles.titleSection}>
              <img 
                src={pet?.headshot_url || '/assets/icon/DefaultAvatar.jpg'} 
                alt={pet?.pet_name}
                className={styles.petAvatar}
              />
              <span className={styles.title}>製作疾病檔案</span>
            </div>
            {draftSaved && (
              <span className={styles.draftIndicator}>草稿已保存</span>
            )}
          </div>
          
          <div className={styles.divider}></div>

          {/* 檔案標題 */}
          <div className={styles.formSection}>
            <div className={styles.formGroupHorizontal}>
              <label className={styles.label}>檔案標題</label>
              <input
                type="text"
                className={styles.input}
                value={formData.archiveTitle}
                onChange={(e) => handleInputChange('archiveTitle', e.target.value)}
                placeholder=""
              />
            </div>
          </div>

          {/* 診斷和治療狀態 */}
          <div className={styles.formSection}>
            <div className={styles.buttonGroup}>
              <button
                className={`${styles.statusButton} ${formData.diagnosisStatus === 'undiagnosed' ? styles.selected : styles.unselected}`}
                onClick={() => handleButtonSelect('diagnosisStatus', 'undiagnosed')}
              >
                未就醫
              </button>
              <button
                className={`${styles.statusButton} ${formData.diagnosisStatus === 'diagnosed' ? styles.selected : styles.unselected}`}
                onClick={() => handleButtonSelect('diagnosisStatus', 'diagnosed')}
              >
                已就醫
              </button>
            </div>
            <div className={styles.buttonGroup}>
              <button
                className={`${styles.statusButton} ${formData.treatmentStatus === 'untreated' ? styles.selected : styles.unselected}`}
                onClick={() => handleButtonSelect('treatmentStatus', 'untreated')}
              >
                未痊癒
              </button>
              <button
                className={`${styles.statusButton} ${formData.treatmentStatus === 'treated' ? styles.selected : styles.unselected}`}
                onClick={() => handleButtonSelect('treatmentStatus', 'treated')}
              >
                已痊癒
              </button>
            </div>
          </div>

          {/* 主要病因 */}
          <div className={styles.formSection}>
            <div className={styles.formGroupHorizontal}>
              <label className={styles.label}>主要病因</label>
              <input
                type="text"
                className={styles.input}
                value={formData.mainCause}
                onChange={(e) => handleInputChange('mainCause', e.target.value)}
                placeholder=""
              />
            </div>
          </div>

          {/* 症狀選擇 */}
          <div className={styles.formSection}>
            <label className={styles.label}>病發時症狀:</label>
            <div className={styles.symptomSection}>
              {/* 已選擇的症狀顯示 */}
              {selectedSymptoms.length > 0 && (
                <div className={styles.selectedSymptomsContainer}>
                  {selectedSymptoms.map((symptom) => (
                    <div key={symptom.id} className={styles.selectedSymptom}>
                      <span className={styles.symptomText}>{symptom.text}</span>
                      <button 
                        className={styles.removeSymptomBtn}
                        onClick={() => handleRemoveSymptom(symptom.id)}
                      >
                        X
                      </button>
                    </div>
                  ))}
                </div>
              )}
              
              {/* 症狀選擇輸入區域 */}
              <div className={styles.symptomInputSection}>
                <div className={styles.symptomSelectContainer}>
                  <select
                    value={selectedSymptomOption}
                    onChange={(e) => setSelectedSymptomOption(e.target.value)}
                    className={styles.symptomSelect}
                  >
                    <option value="">選擇症狀</option>
                    {availableSymptoms
                      .filter(symptom => !selectedSymptoms.some(s => s.text === symptom))
                      .map((symptom, index) => (
                        <option key={index} value={symptom}>{symptom}</option>
                      ))
                    }
                  </select>
                </div>
                <button 
                  className={styles.addSymptomBtn}
                  onClick={handleAddSymptom}
                >
                  新增
                </button>
              </div>
            </div>
          </div>

          {/* 持續日期選擇 */}
          <div className={styles.formSection}>
            <label className={styles.label}>選擇持續日期:</label>
            
            {/* 日期範圍輸入 */}
            <div className={styles.dateRangeInputs}>
              <button 
                className={styles.dateInput}
                onClick={() => setShowStartDatePicker(true)}
              >
                {formatDate(startDate) || '2025 年 1 月 1 日'}
              </button>
              <span className={styles.dateRangeSeparator}>—</span>
              <button 
                className={styles.dateInput}
                onClick={() => setShowEndDatePicker(true)}
              >
                {formatDate(endDate) || '2025 年 1 月 22 日'}
              </button>
            </div>

            {/* 日曆 */}
            <div className={styles.calendarContainer}>
              {isSearching && (
                <div className={styles.searchingOverlay}>
                  <div className={styles.searchingSpinner}></div>
                  <span className={styles.searchingText}>搜尋異常記錄中...</span>
                </div>
              )}
              {renderCalendar}
            </div>

            {/* 異常記錄預覽 */}
            {selectedAbnormalPost && (
              <div className={styles.abnormalPostPreview}>
                <div 
                  className={styles.postPreviewItem}
                  onClick={() => navigate(`/pet/${petId}/abnormal-post/${selectedAbnormalPost.id}`)}
                >
                  <div className={styles.previewIcon}>
                    <img src="/assets/icon/PetpagePetAbnormalPostButton.png" alt="異常記錄" />
                  </div>
                  <div className={styles.previewContent}>
                    <div className={styles.previewDateRow}>
                      <span className={styles.previewDate}>{selectedAbnormalPost.date}</span>
                    </div>
                    <div className={styles.previewInfo}>
                      <span className={styles.previewLabel}>症狀：</span>
                      <span className={styles.previewSymptoms}>{selectedAbnormalPost.symptoms.replace('症狀: ', '')}</span>
                    </div>
                  </div>
                  <div className={styles.previewArrow}>❯</div>
                </div>
                {excludedPostIds.has(selectedAbnormalPost.id) ? (
                  <button 
                    className={styles.includeButton}
                    onClick={() => handlePostSelection(selectedAbnormalPost.id, true)}
                  >
                    重新加回此紀錄
                  </button>
                ) : (
                  <button 
                    className={styles.excludeButton}
                    onClick={() => handlePostSelection(selectedAbnormalPost.id, false)}
                  >
                    不需要這筆資料
                  </button>
                )}
              </div>
            )}
          </div>

          {/* 日期選擇器 */}
          <DatePicker
            isOpen={showStartDatePicker}
            onClose={() => setShowStartDatePicker(false)}
            selectedDate={startDate}
            onDateSelect={(date) => {
              setStartDate(date);
              setShowStartDatePicker(false);
            }}
          />
          
          <DatePicker
            isOpen={showEndDatePicker}
            onClose={() => setShowEndDatePicker(false)}
            selectedDate={endDate}
            onDateSelect={(date) => {
              setEndDate(date);
              setShowEndDatePicker(false);
            }}
            minDate={startDate}
          />

          {/* 操作按鈕 */}
          <div className={styles.actionButtons}>
            <button className={styles.cancelButton} onClick={handleBack}>
              取消
            </button>
            <button className={styles.nextButton} onClick={handleSubmit}>
              下一步
            </button>
          </div>
        </div>
        
        <BottomNavbar />
        {notification && (
          <Notification 
            message={notification} 
            onClose={hideNotification} 
          />
        )}
      </div>
    </NotificationProvider>
  );
};

export default CreateDiseaseArchivePage;