import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import TopNavbar from '../components/TopNavbar';
import BottomNavbar from '../components/BottomNavigationbar';
import Notification from '../components/Notification';
import ConfirmNotification from '../components/ConfirmNotification';
import DatePicker from '../components/DatePicker';
import { NotificationProvider } from '../context/NotificationContext';
import { getUserPets, getSymptoms, getAbnormalPostDetail, updateAbnormalPost } from '../services/petService';
import styles from '../styles/CreateAbnormalPostPage.module.css';

const EditAbnormalPostPage = () => {
  const navigate = useNavigate();
  const { petId, postId } = useParams();
  const fileInputRef = useRef(null);
  
  // 狀態管理
  const [allPets, setAllPets] = useState([]);
  const [selectedPet, setSelectedPet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
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
  const [hasChanges, setHasChanges] = useState(false);
  
  // 追蹤變更的狀態 (參考 EditPostPage)
  const [pendingChanges, setPendingChanges] = useState({
    deletedImageIds: [] // 要刪除的原始圖片 ID
  });
  const [originalData, setOriginalData] = useState(null);
  
  // Refs
  const symptomContainerRef = useRef(null);
  const imagePreviewContainerRef = useRef(null);
  const isInitialLoad = useRef(true);

  // 載入異常記錄資料
  useEffect(() => {
    loadAbnormalPostData();
  }, [petId, postId]);

  // 獲取寵物資料
  useEffect(() => {
    const fetchPets = async () => {
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
          
          // 在寵物列表載入後，設置原始選中的寵物
          const originalPet = formattedPets.find(p => p.id === parseInt(petId));
          if (originalPet) {
            setSelectedPet(originalPet);
          }
        }
      } catch (error) {
        console.error('獲取寵物資料失敗:', error);
        showNotification('獲取寵物資料失敗，請稍後再試');
      }
    };

    fetchPets();
  }, []);

  // 獲取症狀列表
  useEffect(() => {
    const fetchSymptoms = async () => {
      try {
        const symptoms = await getSymptoms();
        setAvailableSymptoms(symptoms.map(symptom => 
          typeof symptom === 'string' ? symptom : symptom.symptom_name
        ).filter(name => typeof name === 'string'));
      } catch (error) {
        console.error('獲取症狀列表失敗:', error);
        // 如果 API 失敗，使用預設症狀列表
        setAvailableSymptoms([
          '打噴嚏', '掉毛', '嘔吐', '腹瀉', '食慾不振', '精神萎靡', 
          '發燒', '咳嗽', '皮膚搔癢', '呼吸急促', '流鼻水', '眼睛紅腫'
        ]);
      }
    };

    fetchSymptoms();
  }, []);

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

  // 載入異常記錄資料
  const loadAbnormalPostData = async () => {
    try {
      setLoading(true);
      const postData = await getAbnormalPostDetail(petId, postId);
      
      if (postData) {
        // 設置日期
        if (postData.record_date) {
          setSelectedDate(new Date(postData.record_date));
        }
        
        // 設置是否為緊急記錄
        setIsEmergency(postData.is_emergency || false);
        
        // 設置症狀
        if (postData.symptoms && Array.isArray(postData.symptoms)) {
          const formattedSymptoms = postData.symptoms.map((symptom, index) => ({
            id: Date.now() + index,
            text: symptom.symptom_name
          }));
          setSelectedSymptoms(formattedSymptoms);
        }
        
        // 設置身體數值
        setBodyStats({
          weight: postData.weight || '',
          waterIntake: postData.water_amount ? (postData.water_amount / 1000).toString() : '', // 從毫升轉換為公升
          temperature: postData.body_temperature || ''
        });
        
        // 設置描述
        setDescription(postData.content || '');
        
        // 儲存原始資料以供比較
        setOriginalData({
          petId: parseInt(petId),
          date: postData.record_date,
          isEmergency: postData.is_emergency || false,
          symptoms: postData.symptoms ? postData.symptoms.map(s => s.symptom_name) : [],
          bodyStats: {
            weight: postData.weight || '',
            waterIntake: postData.water_amount ? (postData.water_amount / 1000).toString() : '',
            temperature: postData.body_temperature || ''
          },
          description: postData.content || '',
          imageIds: postData.images ? postData.images.map(img => img.id) : []
        });
        
        // 設置圖片 - 轉換為預覽格式
        if (postData.images && Array.isArray(postData.images)) {
          const imagePromises = postData.images.map(async (image, index) => {
            try {
              const imageUrl = image.url || image.firebase_url;
              if (!imageUrl) return null;
              
              // 使用現有URL作為預覽
              const imageData = {
                id: image.id, // 使用真實的資料庫 ID
                preview: imageUrl,
                dataUrl: imageUrl,
                file: null, // 編輯模式下，現有圖片沒有File對象
                isNew: false, // 標記為原始圖片 (參考 EditPostPage)
                existingId: image.id // 保留向後相容性
              };
              console.log('載入現有圖片:', { id: image.id, type: typeof image.id, imageData });
              return imageData;
            } catch (error) {
              console.error('處理圖片失敗:', error);
              return null;
            }
          });
          
          const images = await Promise.all(imagePromises);
          const validImages = images.filter(img => img !== null);
          setSelectedImages(validImages);
        }
      } else {
        showNotification('找不到指定的異常記錄');
        navigate(`/pet/${petId}/abnormal-posts`);
      }
    } catch (error) {
      console.error('載入異常記錄失敗:', error);
      showNotification('載入異常記錄失敗');
      navigate(`/pet/${petId}/abnormal-posts`);
    } finally {
      setLoading(false);
      // 初次載入完成後，稍後開始監控變更
      setTimeout(() => {
        isInitialLoad.current = false;
      }, 1000);
    }
  };

  // 檢查是否有變更
  const checkForChanges = () => {
    if (!originalData || isInitialLoad.current) return false;
    
    const currentData = {
      petId: selectedPet ? selectedPet.id : null,
      date: selectedDate ? selectedDate.toISOString() : null,
      isEmergency,
      symptoms: selectedSymptoms.map(s => s.text).sort(),
      bodyStats: {
        weight: bodyStats.weight,
        waterIntake: bodyStats.waterIntake,
        temperature: bodyStats.temperature
      },
      description,
      imageIds: selectedImages.filter(img => !img.isNew).map(img => img.id).sort()
    };
    
    const originalDate = originalData.date ? new Date(originalData.date).toISOString() : null;
    
    const changed = 
      currentData.petId !== originalData.petId ||
      currentData.date !== originalDate ||
      currentData.isEmergency !== originalData.isEmergency ||
      JSON.stringify(currentData.symptoms.sort()) !== JSON.stringify(originalData.symptoms.sort()) ||
      currentData.bodyStats.weight !== originalData.bodyStats.weight ||
      currentData.bodyStats.waterIntake !== originalData.bodyStats.waterIntake ||
      currentData.bodyStats.temperature !== originalData.bodyStats.temperature ||
      currentData.description !== originalData.description ||
      JSON.stringify(currentData.imageIds.sort()) !== JSON.stringify(originalData.imageIds.sort()) ||
      selectedImages.some(img => img.isNew) || // 有新圖片
      pendingChanges.deletedImageIds.length > 0; // 有刪除圖片
    
    return changed;
  };
  
  // 監控資料變更
  useEffect(() => {
    const changed = checkForChanges();
    setHasChanges(changed);
  }, [selectedDate, isEmergency, selectedSymptoms, bodyStats, description, selectedImages, originalData, pendingChanges]);
  
  // 處理頁面離開確認 (瀏覽器關閉/重新整理)
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [hasChanges]);
  
  // 處理路由導航放棄確認 - 攻節瀏覽器返回按鈕
  useEffect(() => {
    let isConfirming = false;
    
    const handlePopState = (event) => {
      if (hasChanges && !isConfirming) {
        // 防止預設的返回行為
        window.history.pushState(null, '', window.location.pathname + window.location.search);
        
        isConfirming = true;
        
        showConfirmDialog(
          '確定放棄編輯?',
          () => {
            isConfirming = false;
            // 直接跳轉到目標頁面
            navigate(`/pet/${petId}/abnormal-post/${postId}`, { replace: true });
          },
          () => {
            isConfirming = false;
            // 留在當前頁面
          }
        );
      }
    };
    
    if (hasChanges) {
      // 新增一個歷史狀態以便攻節
      window.history.pushState(null, '', window.location.pathname + window.location.search);
      window.addEventListener('popstate', handlePopState);
      
      return () => {
        window.removeEventListener('popstate', handlePopState);
      };
    }
  }, [hasChanges, navigate, petId, postId]);

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
      showNotification('請選擇症狀');
      return;
    }
    
    if (selectedSymptoms.some(symptom => symptom.text === selectedSymptomOption)) {
      showNotification('此症狀已存在');
      return;
    }
    
    if (selectedSymptoms.length >= 10) {
      showNotification('最多只能新增10個症狀');
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
  const handlePetSelect = (pet) => {
    if (selectedPet?.id !== pet.id) {
      // 如果要切換寵物，先確認
      showConfirmDialog(
        `確定要切換記錄對象嗎？`,
        () => {
          setSelectedPet(pet);
        },
        () => {
          // 取消切換，保持原始寵物
        }
      );
    }
  };

  // 處理日期選擇
  const handleDateSelect = (date) => {
    setSelectedDate(date);
  };

  // 打開日期選擇器
  const handleOpenDatePicker = () => {
    setShowDatePicker(true);
  };

  // 關閉日期選擇器
  const handleCloseDatePicker = () => {
    setShowDatePicker(false);
  };

  // 格式化日期顯示
  const formatDateDisplay = (date) => {
    if (!date) return '選擇日期';
    const weekDays = ['日', '一', '二', '三', '四', '五', '六'];
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const weekDay = weekDays[date.getDay()];
    return `${month}/${day} (${weekDay})`;
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
      showNotification('最多只能選擇10張圖片');
      return;
    }

    // 檢查每個檔案
    for (let file of files) {
      if (file.size > 5 * 1024 * 1024) {
        showNotification('圖片大小不能超過 5MB');
        return;
      }
      
      if (!file.type.startsWith('image/')) {
        showNotification('請選擇圖片檔案');
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
            id: Date.now() + Math.random(), // 臨時 ID (參考 EditPostPage)
            isNew: true // 標記為新圖片 (參考 EditPostPage)
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

  // 移除圖片 (參考 EditPostPage 邏輯)
  const handleRemoveImage = (imageId) => {
    const imageToDelete = selectedImages.find(img => img.id === imageId);
    if (!imageToDelete) return;
    
    // 前端立即移除顯示
    const updatedImages = selectedImages.filter(img => img.id !== imageId);
    setSelectedImages(updatedImages);
    
    // 只有原始圖片才加入待刪除列表
    if (!imageToDelete.isNew) {
      setPendingChanges(prev => ({
        ...prev,
        deletedImageIds: [...prev.deletedImageIds, imageToDelete.id]
      }));
    }
  };

  // 新增圖片按鈕點擊
  const handleAddImage = () => {
    if (selectedImages.length >= 10) {
      showNotification('最多只能選擇10張圖片');
      return;
    }
    fileInputRef.current?.click();
  };

  // 處理返回按鈕
  const handleBack = () => {
    if (hasChanges) {
      showConfirmDialog(
        '確定放棄編輯?',
        () => {
          navigate(`/pet/${petId}/abnormal-post/${postId}`);
        }
      );
    } else {
      navigate(`/pet/${petId}/abnormal-post/${postId}`);
    }
  };

  // 處理更新按鈕
  const handleUpdate = () => {
    // 表單驗證
    if (!selectedPet) {
      showNotification('請選擇寵物');
      return;
    }
    if (!selectedDate) {
      showNotification('請選擇日期');
      return;
    }
    if (selectedSymptoms.length === 0) {
      showNotification('請至少選擇一個症狀');
      return;
    }
    
    // 更新貼文
    handleUpdatePost();
  };

  // 更新貼文
  const handleUpdatePost = async () => {
    try {
      setLoading(true);
      
      // 準備貼文資料
      const postData = {
        pet: {
          id: selectedPet.id
        },
        date: selectedDate?.toISOString(),
        isEmergency,
        symptoms: selectedSymptoms.map(symptom => ({
          text: typeof symptom === 'string' ? symptom : symptom.text
        })),
        bodyStats: {
          weight: bodyStats.weight,
          waterIntake: bodyStats.waterIntake,
          temperature: bodyStats.temperature
        },
        images: selectedImages.map(img => {
          if (!img.isNew) {
            // 現有圖片 (參考 EditPostPage)
            return {
              id: img.id,
              isExisting: true
            };
          } else {
            // 新圖片 (參考 EditPostPage)
            return {
              dataUrl: img.dataUrl,
              name: img.file?.name || `image_${Date.now()}.jpg`,
              isExisting: false
            };
          }
        }),
        description
      };
      
      console.log('準備發送的 postData:', JSON.stringify(postData, null, 2));
      console.log('selectedImages 詳細:', selectedImages.map(img => ({
        id: img.id,
        isNew: img.isNew,
        preview: img.preview?.substring(0, 50) + '...',
        hasFile: !!img.file
      })));
      
      // 呼叫更新API - 使用選中的寵物ID
      const result = await updateAbnormalPost(selectedPet.id, postId, postData);
      console.log('更新異常記錄成功:', result);
      
      // 更新成功後清除變更狀態 (參考 EditPostPage)
      setHasChanges(false);
      setPendingChanges({
        deletedImageIds: []
      });
      
      showNotification('異常記錄已更新');
      
      // 根據是否切換了寵物來決定導航目標
      setTimeout(() => {
        if (selectedPet.id !== parseInt(petId)) {
          // 切換了寵物，導航到新寵物的該異常記錄詳細頁面
          navigate(`/pet/${selectedPet.id}/abnormal-post/${postId}`);
        } else {
          // 沒有切換寵物，返回原詳細頁面
          navigate(`/pet/${petId}/abnormal-post/${postId}`);
        }
      }, 1500);
      
    } catch (error) {
      console.error('更新異常記錄失敗:', error);
      
      // 處理不同類型的錯誤
      let errorMessage = '更新異常記錄失敗，請稍後再試';
      
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.response?.status === 400) {
        errorMessage = '資料格式有誤，請檢查輸入內容';
      } else if (error.response?.status === 401) {
        errorMessage = '請先登入';
      } else if (error.response?.status === 404) {
        errorMessage = '找不到指定的異常記錄';
      } else if (error.response?.status >= 500) {
        errorMessage = '伺服器錯誤，請稍後再試';
      }
      
      showNotification(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // 渲染頁面內容
  const renderContent = () => (
    <>
      <div className={styles.titleSection}>
        <h2 className={styles.title}>編輯異常紀錄</h2>
      </div>
      <div className={styles.divider}></div>
      
      {/* 選擇寵物區塊 */}
      <div className={styles.section}>
        <label className={styles.sectionLabel}>寵物:</label>
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
            <label className={styles.dateLabel}>日期:</label>
            <button 
              className={`${styles.dateButton} ${selectedDate ? styles.active : ''}`}
              onClick={handleOpenDatePicker}
            >
              {formatDateDisplay(selectedDate)}
            </button>
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
              為就醫紀錄
            </label>
          </div>
        </div>
      </div>

      {/* 症狀選擇 */}
      <div className={styles.section}>
        <label className={styles.sectionLabel}>寵物症狀:</label>
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
              新增
            </button>
          </div>
          
          <span className={styles.symptomCounter}>
            已選擇症狀：{selectedSymptoms.length}/10
          </span>
        </div>
      </div>

      {/* 身體數值記錄 */}
      <div className={styles.section}>
        <label className={styles.sectionLabel}>身體數值紀錄:</label>
        <div className={styles.bodyStatsContainer}>
          <div className={styles.statRow}>
            <span className={styles.statLabel}>體重</span>
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
              <span className={styles.statUnit}>公斤</span>
            </div>
          </div>
          <div className={styles.statRow}>
            <span className={styles.statLabel}>喝水量</span>
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
              <span className={styles.statUnit}>公升</span>
            </div>
          </div>
          <div className={styles.statRow}>
            <span className={styles.statLabel}>體溫</span>
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
              <span className={styles.statUnit}>度</span>
            </div>
          </div>
        </div>
      </div>

      {/* 圖片上傳區域 */}
      <div className={styles.section}>
        <label className={styles.sectionLabel}>圖片紀錄:</label>
        <div className={styles.imageSection}>
          {selectedImages.length === 0 ? (
            <div className={styles.noImageState}>
              <img 
                src="/assets/icon/RegisterPage_NotCheckIcon.png" 
                alt="未選擇圖片" 
                className={styles.warningIcon}
              />
              <p className={styles.noImageText}>還沒有新增任何圖片</p>
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
              新增圖片
            </button>
            <span className={styles.imageCounter}>
              選擇的圖片：{selectedImages.length}/10
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
        <label className={styles.sectionLabel}>補充描述:</label>
        <div className={styles.descriptionSection}>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="文字描述"
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
            <div className={styles.loadingContainer}>載入中...</div>
          ) : (
            <>
              {renderContent()}
              
              {/* 操作按鈕 */}
              <div className={styles.actionButtons}>
                <button 
                  className={styles.cancelButton}
                  onClick={handleBack}
                >
                  取消
                </button>
                <button 
                  className={styles.createButton}
                  onClick={handleUpdate}
                  disabled={loading}
                >
                  {loading ? '更新中...' : '更新'}
                </button>
              </div>
            </>
          )}
        </div>

        {/* 日期選擇器 */}
        <DatePicker
          isOpen={showDatePicker}
          onClose={handleCloseDatePicker}
          selectedDate={selectedDate}
          onDateSelect={handleDateSelect}
        />
        
        <BottomNavbar />
      </div>
    </NotificationProvider>
  );
};

export default EditAbnormalPostPage;