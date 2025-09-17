import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import TopNavbar from '../components/TopNavbar';
import BottomNavbar from '../components/BottomNavigationbar';
import Notification from '../components/Notification';
import ConfirmNotification from '../components/ConfirmNotification';
import { NotificationProvider } from '../context/NotificationContext';
import { getUserPets, getSymptoms, createAbnormalPost, checkAbnormalPostExists } from '../services/petService';
import { useSymptomTranslation } from '../hooks/useSymptomTranslation';
import styles from '../styles/CreateAbnormalPostPage.module.css';

const CreateAbnormalPostPage = () => {
  const { t } = useTranslation('posts');
  const { translateSymptomList, translateSingleSymptom, reverseTranslateSymptoms } = useSymptomTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const fileInputRef = useRef(null);
  
  // 從路由狀態獲取寵物資訊
  const petInfo = location.state?.petInfo || null;
  
  // 狀態管理
  const [allPets, setAllPets] = useState([]);
  const [selectedPet, setSelectedPet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(null);
  const [isEmergency, setIsEmergency] = useState(false);
  const [selectedSymptoms, setSelectedSymptoms] = useState([]);
  const [selectedSymptomOption, setSelectedSymptomOption] = useState('');
  const [availableSymptoms, setAvailableSymptoms] = useState([]);
  const [bodyStats, setBodyStats] = useState({
    weight: '',
    waterIntake: '',
    temperature: ''
  });
  const [selectedImages, setSelectedImages] = useState([]);
  const [description, setDescription] = useState('');
  const [notification, setNotification] = useState('');
  const [showConfirmNotification, setShowConfirmNotification] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState('');
  const [confirmAction, setConfirmAction] = useState(null);
  const [cancelAction, setCancelAction] = useState(null);
  const [draftSaved, setDraftSaved] = useState(false);
  
  // Refs
  const symptomContainerRef = useRef(null);
  const imagePreviewContainerRef = useRef(null);
  const hiddenDateInputRef = useRef(null);
  
  // 草稿相關常數
  const ABNORMAL_DRAFT_KEY = 'createAbnormalPostDraft';

  // 獲取寵物資料
  useEffect(() => {
    const fetchPets = async () => {
      setLoading(true);
      try {
        const pets = await getUserPets();
        
        if (pets && pets.length > 0) {
          const formattedPets = pets.map(pet => ({
            id: pet.pet_id,
            pet_name: pet.pet_name,
            avatarUrl: pet.headshot_url,
            age: pet.age,
            breed: pet.breed
          }));
          
          setAllPets(formattedPets);
          
          // 如果有從路由傳入的寵物資訊，設為選中狀態
          if (petInfo) {
            const matchedPet = formattedPets.find(p => p.id === petInfo.id);
            if (matchedPet) {
              setSelectedPet(matchedPet);
            }
          } else if (formattedPets.length > 0 && !selectedPet) {
            // 只有在沒有選中寵物時，才自動選中第一隻（避免覆蓋草稿載入的寵物）
            setSelectedPet(formattedPets[0]);
          }
        }
      } catch (error) {
        console.error('獲取寵物資料失敗:', error);
        showNotification(t('createAbnormalPost.messages.petDataLoadFailed'));
      } finally {
        setLoading(false);
      }
    };

    fetchPets();
  }, [petInfo]);

  // 載入草稿 - 在寵物列表載入完成後執行
  useEffect(() => {
    if (!loading && allPets.length > 0) {
      loadDraft();
    }
  }, [loading, allPets]);

  // 獲取症狀列表
  useEffect(() => {
    const fetchSymptoms = async () => {
      try {
        const symptoms = await getSymptoms();
        const symptomNames = symptoms.map(symptom =>
          typeof symptom === 'string' ? symptom : symptom.symptom_name
        ).filter(name => typeof name === 'string');

        // 翻譯症狀名稱為當前界面語言
        const translatedSymptomNames = translateSymptomList(symptomNames);
        setAvailableSymptoms(translatedSymptomNames);
      } catch (error) {
        console.error('獲取症狀列表失敗:', error);
        // 如果 API 失敗，使用預設症狀列表
        setAvailableSymptoms(t('createAbnormalPost.defaultSymptoms', { returnObjects: true }));
      }
    };

    fetchSymptoms();
  }, [translateSymptomList, t]);

  // 自動保存草稿
  useEffect(() => {
    const timeoutId = setTimeout(async () => {
      if (selectedPet || selectedSymptoms.length > 0 || selectedDate || Object.values(bodyStats).some(v => v) || 
          selectedImages.length > 0 || description.trim()) {
        try {
          await saveDraft();
        } catch (error) {
          console.error('自動保存失敗:', error);
        }
      }
    }, 2000);

    return () => clearTimeout(timeoutId);
  }, [selectedPet?.id, selectedDate?.getTime(), isEmergency, selectedSymptoms, bodyStats, selectedImages, description]);

  // 處理滑鼠滾輪橫向滾動 - 症狀容器
  React.useEffect(() => {
    const container = symptomContainerRef.current;
    if (!container || selectedSymptoms.length === 0) return;

    const handleWheel = (e) => {
      if (e.deltaY !== 0) {
        e.preventDefault();
        container.scrollLeft += e.deltaY;
      }
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      container.removeEventListener('wheel', handleWheel);
    };
  });

  // 處理滑鼠滾輪橫向滾動 - 圖片容器
  React.useEffect(() => {
    const container = imagePreviewContainerRef.current;
    if (!container || selectedImages.length === 0) return;

    const handleWheel = (e) => {
      if (e.deltaY !== 0) {
        e.preventDefault();
        container.scrollLeft += e.deltaY;
      }
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      container.removeEventListener('wheel', handleWheel);
    };
  });

  // 載入草稿
  const loadDraft = async () => {
    try {
      const savedDraft = localStorage.getItem(ABNORMAL_DRAFT_KEY);
      if (savedDraft) {
        const draft = JSON.parse(savedDraft);
        
        // 載入基本資料
        if (draft.selectedPet) {
          // 從當前寵物列表中找到匹配的寵物
          const matchedPet = allPets.find(pet => pet.id === draft.selectedPet.id);
          if (matchedPet) {
            setSelectedPet(matchedPet);
          } else {
            // 如果草稿中的寵物不存在了，使用草稿中的資料
            setSelectedPet(draft.selectedPet);
          }
        }
        if (draft.selectedDate) setSelectedDate(new Date(draft.selectedDate));
        if (draft.isEmergency !== undefined) setIsEmergency(draft.isEmergency);
        if (draft.selectedSymptoms && Array.isArray(draft.selectedSymptoms)) {
          setSelectedSymptoms(draft.selectedSymptoms);
        }
        if (draft.bodyStats) setBodyStats(draft.bodyStats);
        if (draft.description) setDescription(draft.description);
        
        // 載入圖片資料
        if (draft.images && Array.isArray(draft.images) && draft.images.length > 0) {
          try {
            const imagePromises = draft.images.map(async (imageData) => {
              try {
                if (!imageData.dataUrl || !imageData.id) {
                  console.warn('圖片資料不完整:', imageData);
                  return null;
                }
                
                const response = await fetch(imageData.dataUrl);
                const blob = await response.blob();
                
                if (blob.size === 0) {
                  console.warn('圖片 blob 為空:', imageData.name);
                  return null;
                }
                
                const file = new File([blob], imageData.name || 'image.jpg', { 
                  type: imageData.type || 'image/jpeg' 
                });
                
                return {
                  file,
                  preview: imageData.dataUrl,
                  dataUrl: imageData.dataUrl,
                  id: imageData.id
                };
              } catch (error) {
                console.error('載入單張圖片失敗:', imageData.name, error);
                return null;
              }
            });
            
            const images = await Promise.all(imagePromises);
            const validImages = images.filter(img => img !== null);
            
            if (validImages.length > 0) {
              setSelectedImages(validImages);
            } else if (draft.images.length > 0) {
              showNotification(t('createPost.messages.loadImagesFailed'));
            }
          } catch (error) {
            console.error('載入圖片過程出錯:', error);
            showNotification(t('createPost.messages.loadImagesError'));
          }
        }
      }
    } catch (error) {
      console.error('載入草稿失敗:', error);
      showNotification(t('createPost.messages.loadDraftError'));
      try {
        localStorage.removeItem(ABNORMAL_DRAFT_KEY);
      } catch (e) {
        console.error('清除損壞草稿失敗:', e);
      }
    }
  };

  // 保存草稿
  const saveDraft = async () => {
    try {
      // 轉換圖片為 base64
      const imageDataPromises = selectedImages.map(async (image) => {
        try {
          if (image.file.size > 1 * 1024 * 1024) {
            // 壓縮大圖片
            return new Promise((resolve) => {
              const canvas = document.createElement('canvas');
              const ctx = canvas.getContext('2d');
              const img = new Image();
              
              img.onload = () => {
                const maxWidth = 800;
                const maxHeight = 800;
                let { width, height } = img;
                
                if (width > maxWidth || height > maxHeight) {
                  const ratio = Math.min(maxWidth / width, maxHeight / height);
                  width *= ratio;
                  height *= ratio;
                }
                
                canvas.width = width;
                canvas.height = height;
                ctx.drawImage(img, 0, 0, width, height);
                
                const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.7);
                resolve({
                  id: image.id,
                  name: image.file.name,
                  type: 'image/jpeg',
                  size: image.file.size,
                  dataUrl: compressedDataUrl,
                  compressed: true
                });
              };
              
              img.src = image.preview;
            });
          } else {
            // 小圖片直接保存
            return new Promise((resolve) => {
              const reader = new FileReader();
              reader.onload = (e) => {
                resolve({
                  id: image.id,
                  name: image.file.name,
                  type: image.file.type,
                  size: image.file.size,
                  dataUrl: e.target.result,
                  compressed: false
                });
              };
              reader.readAsDataURL(image.file);
            });
          }
        } catch (error) {
          console.error('轉換圖片失敗:', error);
          return null;
        }
      });

      const imageData = await Promise.all(imageDataPromises);
      const validImageData = imageData.filter(data => data !== null);

      const draft = {
        selectedPet,
        selectedDate: selectedDate ? 
          `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}T12:00:00Z` 
          : null,
        isEmergency,
        selectedSymptoms,
        bodyStats,
        description,
        images: validImageData,
        timestamp: Date.now()
      };

      // 檢查草稿大小
      let finalDraft = draft;
      let draftString = JSON.stringify(finalDraft);
      
      if (draftString.length > 5 * 1024 * 1024) {
        // 如果草稿太大，只保存前3張圖片
        if (validImageData.length > 3) {
          finalDraft = {
            ...draft,
            images: validImageData.slice(0, 3)
          };
          draftString = JSON.stringify(finalDraft);
          showNotification(t('createAbnormalPost.messages.draftTooLarge'));
        }
        
        // 如果還是太大，只保存文字
        if (draftString.length > 5 * 1024 * 1024) {
          finalDraft = {
            selectedPet,
            selectedDate: selectedDate ? selectedDate.toISOString() : null,
            isEmergency,
            selectedSymptoms,
            bodyStats,
            description,
            images: []
          };
          draftString = JSON.stringify(finalDraft);
          showNotification(t('createAbnormalPost.messages.draftTextOnly'));
        }
      }
      
      localStorage.setItem(ABNORMAL_DRAFT_KEY, draftString);
      
      setDraftSaved(true);
      
      // 3秒後隱藏保存提示
      setTimeout(() => {
        setDraftSaved(false);
      }, 3000);
    } catch (error) {
      console.error('保存草稿失敗:', error);
      if (error.name === 'QuotaExceededError') {
        showNotification(t('createAbnormalPost.messages.storageQuotaExceeded'));
        try {
          const textOnlyDraft = {
            selectedPet,
            selectedDate: selectedDate ? 
              `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}T12:00:00Z` 
              : null,
            isEmergency,
            selectedSymptoms,
            bodyStats,
            description,
            images: [],
            timestamp: Date.now()
          };
          localStorage.setItem(ABNORMAL_DRAFT_KEY, JSON.stringify(textOnlyDraft));
        } catch (e) {
          console.error('無法保存草稿:', e);
        }
      }
    }
  };

  // 清除草稿
  const clearDraft = () => {
    try {
      console.log('🗑️ 開始清除異常記錄草稿...');
      
      // 清除主要草稿檔案
      console.log(`清除主草稿: ${ABNORMAL_DRAFT_KEY}`);
      localStorage.removeItem(ABNORMAL_DRAFT_KEY);
      
      // 清除可能的annotation資料
      const ANNOTATIONS_KEY = 'imageAnnotations';
      console.log(`清除圖片標註: ${ANNOTATIONS_KEY}`);
      localStorage.removeItem(ANNOTATIONS_KEY);
      
      // 清除所有相關的暫存資料
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (
          key.includes('postDraft') || 
          key.includes('imageAnnotations') || 
          key.includes('annotationTemp') ||
          key.includes('abnormalPost') ||
          key.includes('AbnormalPost') ||
          key === 'createPostDraft' ||
          key.startsWith('imageAnnotations_')
        )) {
          keysToRemove.push(key);
        }
      }
      
      console.log(`找到 ${keysToRemove.length} 個相關暫存項目:`, keysToRemove);
      
      keysToRemove.forEach(key => {
        localStorage.removeItem(key);
        console.log(`已清除: ${key}`);
      });
      
      // 驗證清除結果
      const remainingDraft = localStorage.getItem(ABNORMAL_DRAFT_KEY);
      if (remainingDraft) {
        console.warn('⚠️ 主草稿未完全清除');
      } else {
        console.log('✅ 主草稿已成功清除');
      }
      
      console.log('✅ 已清除異常記錄相關的所有暫存資料');
    } catch (error) {
      console.error('❌ 清除草稿失敗:', error);
    }
  };

  // 顯示通知
  const showNotification = (msg) => {
    setNotification(msg);
  };

  // 隱藏通知
  const hideNotification = () => {
    setNotification('');
  };

  // 顯示確認通知
  const showConfirmDialog = (message, onConfirm, onCancel = null) => {
    setConfirmMessage(message);
    setConfirmAction(() => onConfirm);
    setCancelAction(() => onCancel);
    setShowConfirmNotification(true);
  };

  // 處理確認通知的確認按鈕
  const handleConfirmAction = () => {
    if (confirmAction) {
      confirmAction();
    }
    setShowConfirmNotification(false);
    setConfirmAction(null);
    setCancelAction(null);
  };

  // 處理確認通知的取消按鈕
  const handleCancelAction = () => {
    if (cancelAction) {
      cancelAction();
    }
    setShowConfirmNotification(false);
    setConfirmAction(null);
    setCancelAction(null);
  };

  // 處理症狀新增
  const handleAddSymptom = () => {
    if (!selectedSymptomOption) {
      showNotification(t('createAbnormalPost.messages.selectSymptom'));
      return;
    }

    if (selectedSymptoms.some(symptom => symptom.text === selectedSymptomOption)) {
      showNotification(t('createAbnormalPost.messages.symptomExists'));
      return;
    }

    if (selectedSymptoms.length >= 10) {
      showNotification(t('createAbnormalPost.messages.maxSymptomsReached'));
      return;
    }
    
    const newSymptom = {
      id: Date.now() + Math.random(),
      text: selectedSymptomOption
    };
    
    setSelectedSymptoms(prev => [...prev, newSymptom]);
    setSelectedSymptomOption('');
  };

  // 移除症狀
  const handleRemoveSymptom = (symptomId) => {
    setSelectedSymptoms(prev => prev.filter(s => s.id !== symptomId));
  };

  // 處理寵物選擇
  const handlePetSelect = async (pet) => {
    if (selectedPet?.id !== pet.id) {
      // 如果已經選擇了日期，檢查新寵物在該日期是否已有記錄
      if (selectedDate) {
        try {
          const hasExistingPost = await checkAbnormalPostExists(pet.id, selectedDate);
          
          if (hasExistingPost) {
            const formattedDate = `${selectedDate.getFullYear()}年${selectedDate.getMonth() + 1}月${selectedDate.getDate()}日`;
            showNotification(t('createAbnormalPost.messages.existingRecordFoundSelectOther', {
              petName: pet.pet_name,
              date: formattedDate
            }));
            return;
          }
        } catch (error) {
          console.error('檢查寵物日期衝突失敗:', error);
        }
      }
      
      setSelectedPet(pet);
    }
  };

  // 格式化日期為 input[type="date"] 格式
  const formatDateForInput = (date) => {
    if (!date) return '';
    return date.getFullYear() + '-' +
           String(date.getMonth() + 1).padStart(2, '0') + '-' +
           String(date.getDate()).padStart(2, '0');
  };

  // 處理日期變更
  const handleDateChange = async (e) => {
    const dateValue = e.target.value; // YYYY-MM-DD format
    if (!dateValue) {
      setSelectedDate(null);
      return;
    }

    const date = new Date(dateValue);

    // 檢查是否選擇了寵物
    if (!selectedPet) {
      showNotification(t('createAbnormalPost.messages.selectPetFirst'));
      setSelectedDate(null);
      return;
    }

    try {
      // 檢查該日期是否已有異常記錄
      const hasExistingPost = await checkAbnormalPostExists(selectedPet.id, date);

      if (hasExistingPost) {
        const formattedDate = `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
        showNotification(t('createAbnormalPost.messages.existingRecordFound', {
          petName: selectedPet.pet_name,
          date: formattedDate
        }));
        setSelectedDate(null);
        return;
      }

      setSelectedDate(date);
    } catch (error) {
      console.error('檢查日期失敗:', error);
      // 如果檢查失敗，仍然允許選擇日期，交由後端最終驗證
      setSelectedDate(date);
    }
  };

  // 處理日期輸入框點擊前的驗證
  const handleDateInputClick = (e) => {
    // 檢查是否選擇了寵物
    if (!selectedPet) {
      e.preventDefault();
      showNotification(t('createAbnormalPost.messages.selectPetFirst'));
      return false;
    }
    return true;
  };

  // 格式化日期顯示
  const formatDateDisplay = (date) => {
    if (!date) return t('common.selectDate');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${month}/${day}`;
  };


  // 處理身體數值變更
  const handleBodyStatChange = (stat, value) => {
    // 確保數值不為負數
    const numericValue = parseFloat(value);
    if (value !== '' && (isNaN(numericValue) || numericValue < 0)) {
      return; // 忽略無效或負數輸入
    }
    
    setBodyStats(prev => ({
      ...prev,
      [stat]: value
    }));
  };

  // 處理圖片選擇
  const handleImageSelect = (e) => {
    const files = Array.from(e.target.files);
    
    if (selectedImages.length + files.length > 10) {
      showNotification(t('createAbnormalPost.messages.maxImagesReached'));
      return;
    }

    // 檢查每個檔案
    for (let file of files) {
      if (file.size > 5 * 1024 * 1024) {
        showNotification(t('createAbnormalPost.messages.imageTooLarge'));
        return;
      }
      
      if (!file.type.startsWith('image/')) {
        showNotification(t('createAbnormalPost.messages.invalidFileType'));
        return;
      }
    }

    // 創建預覽圖片
    const newImagePromises = files.map(file => {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          resolve({
            file,
            preview: e.target.result,
            dataUrl: e.target.result,
            id: Date.now() + Math.random()
          });
        };
        reader.onerror = () => {
          console.error('讀取圖片失敗:', file.name);
          resolve(null);
        };
        reader.readAsDataURL(file);
      });
    });

    Promise.all(newImagePromises).then(newImages => {
      const validImages = newImages.filter(img => img !== null);
      setSelectedImages(prev => [...prev, ...validImages]);
    });
  };

  // 移除圖片
  const handleRemoveImage = (imageId) => {
    setSelectedImages(prev => prev.filter(img => img.id !== imageId));
  };

  // 新增圖片按鈕點擊
  const handleAddImage = () => {
    if (selectedImages.length >= 10) {
      showNotification(t('createAbnormalPost.messages.maxImagesReached'));
      return;
    }
    fileInputRef.current?.click();
  };

  // 處理返回按鈕
  const handleBack = async () => {
    const hasContent = selectedPet || selectedDate || selectedSymptoms.length > 0 || 
                      Object.values(bodyStats).some(v => v) || selectedImages.length > 0 || description.trim();
    
    if (hasContent) {
      // 直接保存草稿並返回
      try {
        await saveDraft();
      } catch (error) {
        console.error('保存草稿失敗:', error);
      }
    }
    navigate(-1);
  };

  // 處理建立按鈕
  const handleCreate = () => {
    // 表單驗證
    if (!selectedPet) {
      showNotification(t('createAbnormalPost.messages.selectPet'));
      return;
    }
    if (!selectedDate) {
      showNotification(t('createAbnormalPost.messages.selectDate'));
      return;
    }
    if (selectedSymptoms.length === 0) {
      showNotification(t('createAbnormalPost.messages.selectAtLeastOneSymptom'));
      return;
    }
    
    // 建立貼文
    handleCreatePost();
  };

  // 創建貼文
  const handleCreatePost = async () => {
    try {
      setLoading(true);
      
      // 準備貼文資料
      const postData = {
        pet: {
          id: selectedPet.id
        },
        date: selectedDate ? 
          `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}T12:00:00Z` 
          : null,
        isEmergency,
        symptoms: reverseTranslateSymptoms(selectedSymptoms).map(symptom => ({
          text: typeof symptom === 'string' ? symptom : symptom.text
        })),
        bodyStats,
        images: selectedImages.map(img => ({
          dataUrl: img.dataUrl,
          name: img.file?.name || `image_${Date.now()}.jpg`
        })),
        description
      };
      
      // 呼叫API創建異常記錄
      const result = await createAbnormalPost(postData);
      console.log('異常記錄創建成功:', result);
      
      // 創建成功後清除草稿和重置狀態
      clearDraft();
      
      // 重置所有表單狀態
      setSelectedPet(null);
      setSelectedDate(null);
      setIsEmergency(false);
      setSelectedSymptoms([]);
      setSelectedSymptomOption('');
      setBodyStats({
        weight: '',
        waterIntake: '',
        temperature: ''
      });
      setSelectedImages([]);
      setDescription('');
      
      showNotification(t('createAbnormalPost.messages.recordCreated'));
      setTimeout(() => {
        navigate('/pet');
      }, 1500);
      
    } catch (error) {
      console.error('創建異常記錄失敗:', error);
      
      // 處理不同類型的錯誤
      let errorMessage = t('createAbnormalPost.messages.createFailed');

      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.response?.status === 400) {
        errorMessage = t('createAbnormalPost.messages.invalidData');
      } else if (error.response?.status === 401) {
        errorMessage = t('createAbnormalPost.messages.loginRequired');
      } else if (error.response?.status === 404) {
        errorMessage = t('createAbnormalPost.messages.petNotFound');
      } else if (error.response?.status >= 500) {
        errorMessage = t('createAbnormalPost.messages.serverError');
      }
      
      showNotification(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // 渲染第一頁內容
  const renderFirstPage = () => (
    <>
      <div className={styles.titleSection}>
        <h2 className={styles.title}>{t('createAbnormalPost.title')}</h2>
        {draftSaved && (
          <span className={styles.draftIndicator}>{t('common.draftSaved')}</span>
        )}
      </div>
      <div className={styles.divider}></div>
      
      {/* 選擇寵物區塊 */}
      <div className={styles.section}>
        <label className={styles.sectionLabel}>{t('createAbnormalPost.petSelection.selectPet')}</label>
        <div className={styles.petSwitcher}>
          {allPets.map((pet) => (
            <div
              key={pet.id}
              className={`${styles.petItem} ${selectedPet?.id === pet.id ? styles.activePet : ''}`}
              onClick={() => handlePetSelect(pet)}
            >
              <img
                src={pet.avatarUrl || '/assets/icon/DefaultAvatar.jpg'}
                alt={pet.pet_name}
                className={styles.petAvatar}
              />
            </div>
          ))}
        </div>
      </div>

      {/* 日期選擇 */}
      <div className={styles.section}>
        <div className={styles.dateRow}>
          <div className={styles.dateSection}>
            <label className={styles.dateLabel}>{t('createAbnormalPost.dateSelection.date')}</label>
            <div className={styles.dateInputWrapper}>
              <input
                ref={hiddenDateInputRef}
                type="date"
                className={styles.dateInput}
                value={formatDateForInput(selectedDate)}
                onChange={handleDateChange}
                onClick={handleDateInputClick}
              />
              <span className={styles.datePlaceholder}>
                {selectedDate ? formatDateDisplay(selectedDate) : t('common.selectDate')}
              </span>
            </div>
          </div>
          <div className={styles.emergencyCheckbox}>
            <input
              type="checkbox"
              checked={isEmergency}
              onChange={(e) => setIsEmergency(e.target.checked)}
              className={styles.checkbox}
              id="emergency"
            />
            <label htmlFor="emergency" className={styles.checkboxLabel}>
              {t('createAbnormalPost.dateSelection.emergency')}
            </label>
          </div>
        </div>
      </div>

      {/* 症狀選擇 */}
      <div className={styles.section}>
        <label className={styles.sectionLabel}>{t('createAbnormalPost.symptoms.title')}</label>
        <div className={styles.symptomSection}>
          {/* 已選擇的症狀顯示 */}
          {selectedSymptoms.length > 0 && (
            <div ref={symptomContainerRef} className={styles.selectedSymptomsContainer}>
              {selectedSymptoms.map((symptom) => (
                <div key={symptom.id} className={styles.selectedSymptom}>
                  <span className={styles.symptomText}>{translateSingleSymptom(symptom.text)}</span>
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
                <option value="">{t('createAbnormalPost.symptoms.selectSymptom')}</option>
                {availableSymptoms
                  .filter(symptom => {
                    const symptomText = typeof symptom === 'string' ? symptom : symptom.text || symptom;
                    return !selectedSymptoms.some(s => {
                      const selectedText = typeof s === 'string' ? s : s.text;
                      return selectedText === symptomText;
                    });
                  })
                  .map((symptom, index) => {
                    const symptomText = typeof symptom === 'string' ? symptom : symptom.text || symptom;
                    return (
                      <option key={index} value={symptomText}>{symptomText}</option>
                    );
                  })
                }
              </select>
            </div>
            <button
              className={styles.addSymptomBtn}
              onClick={handleAddSymptom}
            >
              {t('common.add')}
            </button>
          </div>
          
          <span className={styles.symptomCounter}>
            {t('createAbnormalPost.symptoms.counter', { count: selectedSymptoms.length })}
          </span>
        </div>
      </div>

      {/* 身體數值記錄 */}
      <div className={styles.section}>
        <label className={styles.sectionLabel}>{t('createAbnormalPost.bodyStats.title')}</label>
        <div className={styles.bodyStatsContainer}>
          <div className={styles.statRow}>
            <span className={styles.statLabel}>{t('createAbnormalPost.bodyStats.weight')}</span>
            <div className={styles.statInputWrapper}>
              <input 
                type="number"
                value={bodyStats.weight}
                onChange={(e) => handleBodyStatChange('weight', e.target.value)}
                className={styles.statInput}
                placeholder="0"
                min="0"
                step="0.1"
              />
              <span className={styles.statUnit}>{t('createAbnormalPost.bodyStats.units.kg')}</span>
            </div>
          </div>
          <div className={styles.statRow}>
            <span className={styles.statLabel}>{t('createAbnormalPost.bodyStats.waterIntake')}</span>
            <div className={styles.statInputWrapper}>
              <input 
                type="number"
                value={bodyStats.waterIntake}
                onChange={(e) => handleBodyStatChange('waterIntake', e.target.value)}
                className={styles.statInput}
                placeholder="0"
                min="0"
                step="0.01"
              />
              <span className={styles.statUnit}>{t('createAbnormalPost.bodyStats.units.liters')}</span>
            </div>
          </div>
          <div className={styles.statRow}>
            <span className={styles.statLabel}>{t('createAbnormalPost.bodyStats.temperature')}</span>
            <div className={styles.statInputWrapper}>
              <input 
                type="number"
                value={bodyStats.temperature}
                onChange={(e) => handleBodyStatChange('temperature', e.target.value)}
                className={styles.statInput}
                placeholder="0"
                min="0"
                step="0.1"
              />
              <span className={styles.statUnit}>{t('createAbnormalPost.bodyStats.units.celsius')}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 圖片上傳區域 */}
      <div className={styles.section}>
        <label className={styles.sectionLabel}>{t('createAbnormalPost.imageUpload.title')}</label>
        <div className={styles.imageSection}>
          {selectedImages.length === 0 ? (
            <div className={styles.noImageState}>
              <img 
                src="/assets/icon/RegisterPage_NotCheckIcon.png" 
                alt="未選擇圖片" 
                className={styles.warningIcon}
              />
              <p className={styles.noImageText}>{t('createAbnormalPost.imageUpload.noImageSelected')}</p>
            </div>
          ) : (
            <div ref={imagePreviewContainerRef} className={styles.imagePreviewContainer}>
              {selectedImages.map((image) => (
                <div key={image.id} className={styles.imagePreview}>
                  <img src={image.preview} alt="預覽" />
                  <button 
                    className={styles.removeImageBtn}
                    onClick={() => handleRemoveImage(image.id)}
                  >
                    X
                  </button>
                </div>
              ))}
            </div>
          )}
          
          <div className={styles.imageControls}>
            <button
              className={styles.addImageBtn}
              onClick={handleAddImage}
            >
              {t('createAbnormalPost.imageUpload.addImage')}
            </button>
            <span className={styles.imageCounter}>
              {t('createAbnormalPost.imageUpload.imageCounter', { count: selectedImages.length })}
            </span>
          </div>
          
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleImageSelect}
            className={styles.hiddenInput}
          />
        </div>
      </div>

      {/* 文字描述區域 */}
      <div className={styles.section}>
        <label className={styles.sectionLabel}>{t('createAbnormalPost.description.title')}</label>
        <div className={styles.descriptionSection}>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t('createAbnormalPost.description.placeholder')}
            className={styles.descriptionInput}
            rows="6"
          />
        </div>
      </div>
    </>
  );

  return (
    <NotificationProvider>
      <div className={styles.container}>
        <TopNavbar />
        {notification && (
          <Notification message={notification} onClose={hideNotification} />
        )}
        
        {showConfirmNotification && (
          <ConfirmNotification 
            message={confirmMessage}
            onConfirm={handleConfirmAction}
            onCancel={handleCancelAction}
          />
        )}
        
        <div className={styles.content}>
          {loading ? (
            <div className={styles.loadingContainer}>{t('common.loading')}</div>
          ) : (
            <>
              {renderFirstPage()}
              
              {/* 操作按鈕 */}
              <div className={styles.actionButtons}>
                <button 
                  className={styles.cancelButton}
                  onClick={handleBack}
                >
                  {t('common.back')}
                </button>
                <button 
                  className={styles.createButton}
                  onClick={handleCreate}
                  disabled={loading}
                >
                  {loading ? t('common.creating') : t('common.create')}
                </button>
              </div>
            </>
          )}
        </div>

        
        <BottomNavbar />
      </div>
    </NotificationProvider>
  );
};

export default CreateAbnormalPostPage;