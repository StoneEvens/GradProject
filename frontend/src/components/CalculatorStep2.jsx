import React, { useRef, useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from '../utils/axios';
import styles from '../styles/CalculatorStep2.module.css';
import CreateFeedModal from './CreateFeedModal';
import HistoryRecordModal from './HistoryRecordModal';
import NotificationComponent from './Notification';
import FeedSelectModal from './FeedSelectModal';
import FeedReviewConfirmModal from './FeedReviewConfirmModal';
import FeedReviewModal from './FeedReviewModal';
import mockFeed1 from '../MockPicture/mockFeed1.png';
import mockFeed2 from '../MockPicture/mockFeed2.png';
import mockFeed3 from '../MockPicture/mockFeed3.png';
import { useUser } from '../context/UserContext';

function CalculatorStep2({ onNext, onPrev, selectedPet }) {
  const { user_id } = useParams();
  const navigate = useNavigate();
  const { userData } = useUser();
  const [selectedFeed, setSelectedFeed] = useState(0);
  const [feeds, setFeeds] = useState([]);
  const [showCreateFeedModal, setShowCreateFeedModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showFeedSelectModal, setShowFeedSelectModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [pendingFeedForReview, setPendingFeedForReview] = useState(null);
  const [notification, setNotification] = useState('');
  
  // 過去紀錄按鈕點擊事件
  const handleHistoryClick = () => {
    setShowHistoryModal(true);
  };
  const [feedInfo, setFeedInfo] = useState({
    name: '',
    brand: '',
    carb: '',
    protein: '',
    fat: '',
    ca: '',
    p: '',
    mg: '',
    na: ''
  });

  useEffect(() => {
    // 初始化時不載入任何飼料，用戶需要主動選擇或新增
    setFeeds([]);
    setSelectedFeed(-1);
    setFeedInfo({
      name: '',
      brand: '',
      carb: '',
      protein: '',
      fat: '',
      ca: '',
      p: '',
      mg: '',
      na: ''
    });
  }, [user_id, selectedPet]);

  const handleSelectFeed = (idx, source = feeds) => {
    setSelectedFeed(idx);
    const feed = source[idx];
    setFeedInfo({
      name: feed.name || '',
      brand: feed.brand || '',
      carb: (feed.carb !== undefined && feed.carb !== null) ? feed.carb.toString() : '',
      protein: (feed.protein !== undefined && feed.protein !== null) ? feed.protein.toString() : '',
      fat: (feed.fat !== undefined && feed.fat !== null) ? feed.fat.toString() : '',
      ca: (feed.ca !== undefined && feed.ca !== null) ? feed.ca.toString() : '',
      p: (feed.p !== undefined && feed.p !== null) ? feed.p.toString() : '',
      mg: (feed.mg !== undefined && feed.mg !== null) ? feed.mg.toString() : '',
      na: (feed.na !== undefined && feed.na !== null) ? feed.na.toString() : '',
    });
  };

  const handleFeedInfoChange = (field, value) => {
    setFeedInfo(prev => ({ ...prev, [field]: value }));
  };

  // 顯示新增飼料 modal
  const handleShowCreateFeedModal = () => {
    setShowCreateFeedModal(true);
  };

  // 關閉新增飼料 modal
  const handleCloseCreateFeedModal = () => {
    setShowCreateFeedModal(false);
  };

  // 處理審核確認 modal 的確定按鈕
  const handleConfirmModalConfirm = () => {
    setShowConfirmModal(false);
    setShowReviewModal(true);
  };

  // 處理審核確認 modal 的取消按鈕
  const handleConfirmModalClose = () => {
    setShowConfirmModal(false);
    setPendingFeedForReview(null);
  };

  // 處理審核 modal 的關閉
  const handleReviewModalClose = () => {
    setShowReviewModal(false);
    setPendingFeedForReview(null);
  };

  // 處理審核確認
  const handleReviewConfirm = async (feed) => {
    try {
      // 調用審核 API
      const response = await axios.post(`/feeds/${feed.id}/review/`);
      
      setNotification('審核完成，飼料已加入計算');
      
      // 審核完成後，將飼料加入到列表中
      const reviewedFeed = {
        ...feed,
        is_verified: true,
        review_count: (feed.review_count || 0) + 1
      };
      
      const newFeeds = [...feeds, reviewedFeed];
      setFeeds(newFeeds);
      const newIndex = newFeeds.length - 1;
      setSelectedFeed(newIndex);
      handleSelectFeed(newIndex, newFeeds);
      
    } catch (error) {
      console.error('審核失敗:', error);
      throw error; // 讓 modal 組件處理錯誤
    }
  };

  // 處理錯誤回報
  const handleReportError = async (errorData) => {
    try {
      // 調用錯誤回報 API
      const response = await axios.post('/feeds/error-report/', errorData);
      setNotification('已回報錯誤，感謝您的反饋');
      
    } catch (error) {
      console.error('錯誤回報失敗:', error);
      throw error; // 讓 modal 組件處理錯誤
    }
  };

  // 處理從 FeedSelectModal 選擇的飼料
  const handleFeedSelect = (selectedFeedData) => {
    // 將選擇的飼料加入到飼料列表中（如果不存在的話）
    const existingIndex = feeds.findIndex(feed => feed.id === selectedFeedData.id);
    
    if (existingIndex !== -1) {
      // 如果飼料已存在，直接選擇它
      setSelectedFeed(existingIndex);
      handleSelectFeed(existingIndex);
    } else {
      // 如果飼料不存在，添加到列表並選擇它
      const newFeeds = [...feeds, selectedFeedData];
      setFeeds(newFeeds);
      const newIndex = newFeeds.length - 1;
      setSelectedFeed(newIndex);
      handleSelectFeed(newIndex, newFeeds);
    }
    
    setNotification(`已選擇飼料：${selectedFeedData.brand} - ${selectedFeedData.name}`);
  };

  // 處理新增飼料
  const handleCreateFeed = async ({ frontImage, nutritionImage, petType, feedName, feedBrand, feedPrice }) => {
    try {
      // Step 1: OCR
      const ocrForm = new FormData();
      ocrForm.append('image', nutritionImage);
      const ocrRes = await axios.post('/feeds/ocr/', ocrForm, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      const nutrients = ocrRes.data.extracted_nutrients || {};
      console.log("OCR 結果：", nutrients);

      // 將圖片轉換為 base64，參考 abnormal post 的做法
      const convertToBase64 = (file) => {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.readAsDataURL(file);
          reader.onload = () => resolve(reader.result);
          reader.onerror = error => reject(error);
        });
      };

      // 轉換圖片為 base64
      const frontImageBase64 = frontImage ? await convertToBase64(frontImage) : null;
      const nutritionImageBase64 = nutritionImage ? await convertToBase64(nutritionImage) : null;

      // Step 2: 建立 Feed（包含自動比對邏輯和圖片數據）
      const parseNumber = (val) => typeof val === 'number' ? val : 0;
      const parseMgToG = (val) => (typeof val === 'number' ? val/1000 : 0);
      const createFeedPayload = {
        name: feedName || '自訂飼料',
        brand: feedBrand || '未知品牌',
        pet_type: petType, // 傳送寵物類型
        pet_id: selectedPet?.id, // 傳送寵物 ID
        protein: parseNumber(nutrients.protein),
        fat: parseNumber(nutrients.fat),
        carbohydrate: parseNumber(nutrients.carbohydrate),
        calcium: parseNumber(nutrients.calcium),
        phosphorus: parseNumber(nutrients.phosphorus),
        magnesium: parseMgToG(nutrients.magnesium),
        sodium: parseMgToG(nutrients.sodium),
        price: feedPrice,
        front_image: frontImageBase64,
        nutrition_image: nutritionImageBase64
      };

      const createFeedRes = await axios.post(
        '/feeds/create/',
        createFeedPayload
      );
      
      const responseData = createFeedRes.data;
      const feedData = responseData.data;
      const feedId = responseData.feed_id || responseData.data?.id;

      // 圖片現在在 Feed 創建時已經處理，不需要分離的上傳步驟

      // 根據是否為現有飼料來處理
      if (responseData.is_existing) {
        // 如果是現有飼料，先獲取飼料詳情
        const petType = selectedPet.species === '狗' ? 'dog' : 'cat';
        const feedDetailRes = await axios.get(`/feeds/shared/?pet_type=${petType}`);
        const feedDetailData = feedDetailRes.data.data || feedDetailRes.data;
        const matchedFeed = feedDetailData.find(feed => feed.id === feedId);
        
        if (matchedFeed && !matchedFeed.is_verified) {
          // 檢查是否為飼料創建者本人
          const isCreator = userData && matchedFeed.created_by_id === userData.id;
          
          if (isCreator) {
            // 如果是創建者本人，直接添加到列表，無需審核
            const existingFeed = {
              id: matchedFeed.id,
              name: matchedFeed.name || feedName || '自訂飼料',
              brand: matchedFeed.brand || feedBrand || '未知品牌',
              img: matchedFeed.front_image_url || [mockFeed1, mockFeed2, mockFeed3][0],
              carb: matchedFeed.carbohydrate ?? 0,
              protein: matchedFeed.protein ?? 0,
              fat: matchedFeed.fat ?? 0,
              ca: matchedFeed.calcium ?? 0,
              p: matchedFeed.phosphorus ?? 0,
              mg: (matchedFeed.magnesium ?? 0) * 1000,
              na: (matchedFeed.sodium ?? 0) * 1000,
              price: matchedFeed.price,
              review_count: matchedFeed.review_count ?? 0,
              is_verified: matchedFeed.is_verified ?? false,
              pet_type: matchedFeed.pet_type,
            };
            
            const newFeeds = [...feeds, existingFeed];
            setFeeds(newFeeds);
            const newIndex = newFeeds.length - 1;
            setSelectedFeed(newIndex);
            handleSelectFeed(newIndex, newFeeds);
            setNotification(`已選擇飼料：${matchedFeed.brand} - ${matchedFeed.name}`);
          } else {
            // 如果不是創建者，檢查是否可以使用
            try {
              const reviewCheckResponse = await axios.get(`/feeds/${feedId}/check-review/`);
              
              if (reviewCheckResponse.data.can_use_feed) {
                // 如果可以使用（已審核過或已回報錯誤），直接添加到列表
                const existingFeed = {
                  id: matchedFeed.id,
                  name: matchedFeed.name || feedName || '自訂飼料',
                  brand: matchedFeed.brand || feedBrand || '未知品牌',
                  img: matchedFeed.front_image_url || [mockFeed1, mockFeed2, mockFeed3][0],
                  carb: matchedFeed.carbohydrate ?? 0,
                  protein: matchedFeed.protein ?? 0,
                  fat: matchedFeed.fat ?? 0,
                  ca: matchedFeed.calcium ?? 0,
                  p: matchedFeed.phosphorus ?? 0,
                  mg: (matchedFeed.magnesium ?? 0) * 1000,
                  na: (matchedFeed.sodium ?? 0) * 1000,
                  price: matchedFeed.price,
                  review_count: matchedFeed.review_count ?? 0,
                  is_verified: matchedFeed.is_verified ?? false,
                  pet_type: matchedFeed.pet_type,
                };
                
                const newFeeds = [...feeds, existingFeed];
                setFeeds(newFeeds);
                const newIndex = newFeeds.length - 1;
                setSelectedFeed(newIndex);
                handleSelectFeed(newIndex, newFeeds);
                setNotification(responseData.message);
              } else {
                // 如果未審核過，顯示確認 modal
                const feedForReview = {
                  id: matchedFeed.id,
                  name: matchedFeed.name || feedName || '自訂飼料',
                  brand: matchedFeed.brand || feedBrand || '未知品牌',
                  frontImage: matchedFeed.front_image_url,
                  protein: matchedFeed.protein ?? 0,
                  fat: matchedFeed.fat ?? 0,
                  carbohydrate: matchedFeed.carbohydrate ?? 0,
                  calcium: matchedFeed.calcium ?? 0,
                  phosphorus: matchedFeed.phosphorus ?? 0,
                  magnesium: matchedFeed.magnesium ?? 0,
                  sodium: matchedFeed.sodium ?? 0,
                  price: matchedFeed.price,
                  isVerified: matchedFeed.is_verified ?? false,
                  reviewCount: matchedFeed.review_count ?? 0,
                  pet_type: matchedFeed.pet_type,
                  created_by_name: matchedFeed.created_by_name,
                  created_at: matchedFeed.created_at,
                };
                
                setPendingFeedForReview(feedForReview);
                setShowConfirmModal(true);
                return; // 等待用戶審核決定
              }
            } catch (reviewCheckError) {
              console.error('檢查審核狀態失敗:', reviewCheckError);
              setNotification('檢查飼料狀態失敗，請稍後再試');
            }
          }
        } else {
          // 已驗證的飼料，直接添加
          const existingFeed = {
            id: matchedFeed.id,
            name: matchedFeed.name || feedName || '自訂飼料',
            brand: matchedFeed.brand || feedBrand || '未知品牌',
            img: matchedFeed.front_image_url || [mockFeed1, mockFeed2, mockFeed3][0],
            carb: matchedFeed.carbohydrate ?? 0,
            protein: matchedFeed.protein ?? 0,
            fat: matchedFeed.fat ?? 0,
            ca: matchedFeed.calcium ?? 0,
            p: matchedFeed.phosphorus ?? 0,
            mg: (matchedFeed.magnesium ?? 0) * 1000,
            na: (matchedFeed.sodium ?? 0) * 1000,
            price: matchedFeed.price,
            review_count: matchedFeed.review_count ?? 0,
            is_verified: matchedFeed.is_verified ?? false,
            pet_type: matchedFeed.pet_type,
          };
          
          const newFeeds = [...feeds, existingFeed];
          setFeeds(newFeeds);
          const newIndex = newFeeds.length - 1;
          setSelectedFeed(newIndex);
          handleSelectFeed(newIndex, newFeeds);
          setNotification(responseData.message);
        }
      } else {
        // 如果是新飼料，需要獲取完整資料後加入列表
        const feedDetailRes = await axios.get(`/feeds/shared/?pet_type=${petType}`);
        const feedDetailData = feedDetailRes.data.data || feedDetailRes.data;
        const createdFeed = feedDetailData.find(feed => feed.id === feedId);
        
        const newFeed = {
          id: feedId,
          name: createdFeed?.name || feedName || '自訂飼料',
          brand: createdFeed?.brand || feedBrand || '未知品牌',
          img: createdFeed?.front_image_url || (frontImageBase64 ? frontImageBase64 : mockFeed1),
          carb: createdFeed?.carbohydrate || parseNumber(nutrients.carbohydrate),
          protein: createdFeed?.protein || parseNumber(nutrients.protein),
          fat: createdFeed?.fat || parseNumber(nutrients.fat),
          ca: createdFeed?.calcium || parseNumber(nutrients.calcium),
          p: createdFeed?.phosphorus || parseNumber(nutrients.phosphorus),
          mg: createdFeed?.magnesium != null ? createdFeed.magnesium * 1000 : parseNumber(nutrients.magnesium),
          na: createdFeed?.sodium    != null ? createdFeed.sodium    * 1000 : parseNumber(nutrients.sodium),
          price: createdFeed?.price || feedPrice,
          pet_type: petType
        };
        
        setFeeds(prev => {
          const updated = [...prev, newFeed];
          setSelectedFeed(updated.length - 1);
          handleSelectFeed(updated.length - 1, updated);
          return updated;
        });
        setNotification(responseData.message); // "新飼料建立成功"
      }

    } catch (error) {
      console.error("建立自訂飼料失敗：", error);
      
      // 提供更詳細的錯誤訊息
      let errorMessage = '建立飼料失敗，請稍後再試';
      if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.response?.status === 400) {
        errorMessage = '請檢查上傳的圖片和資料是否正確';
      } else if (error.response?.status === 401) {
        errorMessage = '請重新登入後再試';
      } else if (error.message.includes('Firebase')) {
        errorMessage = '圖片上傳失敗，請檢查網路連線';
      }
      
      console.error('詳細錯誤資訊:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      
      setNotification(errorMessage);
      throw error;
    }
  };



  const handleNext = async () => {
    if (!selectedPet) {
      setNotification("請先選擇寵物");
      return;
    }

    if (feeds.length === 0) {
      setNotification(`目前沒有可用的${selectedPet.species}飼料，請先新增飼料`);
      return;
    }

    const feed = feeds[selectedFeed];
    if (!feed) {
      setNotification("請先選擇飼料");
      return;
    }

    // Step 1: 簡單驗證輸入資料格式（共用颼料不需要後端驗證）
    const validateInputData = () => {
      const requiredFields = {
        '飼料名稱': feedInfo.name,
        '品牌': feedInfo.brand,
        '蛋白質': feedInfo.protein,
        '脂肪': feedInfo.fat,
        '碳水化合物': feedInfo.carb,
        '鈣': feedInfo.ca,
        '磷': feedInfo.p,
        '鎂': feedInfo.mg,
        '鈉': feedInfo.na
      };
      
      const emptyFields = [];
      for (const [fieldName, value] of Object.entries(requiredFields)) {
        if (!value || value.toString().trim() === '') {
          emptyFields.push(fieldName);
        }
      }
      
      if (emptyFields.length > 0) {
        setNotification(`請填寫以下必填欄位： ${emptyFields.join(', ')}`);
        return false;
      }
      
      // 檢查數值是否為正數
      const numericFields = {
        '蛋白質': feedInfo.protein,
        '脂肪': feedInfo.fat,
        '碳水化合物': feedInfo.carb,
        '鈣': feedInfo.ca,
        '磷': feedInfo.p,
        '鎂': feedInfo.mg,
        '鈉': feedInfo.na
      };
      
      const invalidFields = [];
      for (const [fieldName, value] of Object.entries(numericFields)) {
        const numValue = parseFloat(value);
        if (isNaN(numValue) || numValue < 0) {
          invalidFields.push(fieldName);
        }
      }
      
      if (invalidFields.length > 0) {
        setNotification(`以下欄位必須為非負數值： ${invalidFields.join(', ')}`);
        return false;
      }
      
      return true;
    };

    const validationSuccess = validateInputData();
    if (!validationSuccess) return;

    // 立即進入第三步，傳遞飼料資訊和計算狀態
    onNext(feed, { isCalculating: true });

    // 在背景中執行計算
    performCalculation(feed);
  };

  const performCalculation = async (feed) => {
    try {
      // Step 1: 確保 UserFeed 關係存在（用於使用次數統計）
      try {
        await axios.post('/feeds/add-to-user/', {
          feed_id: feed.id,
          pet_id: selectedPet?.id
        });
        console.log('確保 UserFeed 關係已建立');
      } catch (addError) {
        console.warn('建立 UserFeed 關係失敗，但不影響計算：', addError);
      }

    // Step 2: 計算前檢查必要參數
      // Step 2: 計算前檢查必要參數
      if (!selectedPet?.weight) {
        // 顯示通知並通知第三步顯示錯誤
        setNotification('寵物體重為必填欄位，請回上一步編輯寵物資訊');
        onNext(feed, { 
          isCalculating: false, 
          error: '寵物體重為必填欄位，請回上一步編輯寵物資訊' 
        });
        return;
      }

      // 處理數值參數，確保不為空值
      const safeFloat = (value, defaultValue = 0) => {
        const num = parseFloat(value);
        return isNaN(num) ? defaultValue : num;
      };

      const mgToG = (v) => { const n = parseFloat(v); return isNaN(n) ? 0 : (n / 1000); };

      const formData = new FormData();
      formData.append('pet_id', selectedPet?.id || '');
      formData.append('pet_type', selectedPet.species === '狗' ? 'dog' : 'cat');
      formData.append('life_stage', selectedPet.lifestage || 'adult');
      formData.append('weight', safeFloat(selectedPet.weight));
      formData.append('expected_adult_weight', safeFloat(selectedPet.expected_adult_weight));
      formData.append('litter_size', safeFloat(selectedPet.litter_size));
      formData.append('weeks_of_lactation', safeFloat(selectedPet.weeks_of_lactation));
      formData.append('protein', safeFloat(feedInfo.protein));
      formData.append('fat', safeFloat(feedInfo.fat));
      formData.append('carbohydrates', safeFloat(feedInfo.carb));
      formData.append('calcium', safeFloat(feedInfo.ca));
      formData.append('phosphorus', safeFloat(feedInfo.p));
      formData.append('magnesium', mgToG(feedInfo.mg));
      formData.append('sodium', mgToG(feedInfo.na));
      formData.append('feed_id', feed.id);
      formData.append('persist', 'true');
      formData.append('name', (feedInfo.name || '').trim());
      formData.append('brand', (feedInfo.brand || '').trim());
      
      const condsRaw = Array.isArray(selectedPet?.conditions) ? selectedPet.conditions : [];
      const conds = [...new Set(condsRaw.map(c => String(c).trim()).filter(Boolean))];
      if (conds.length) {
        // A: JSON（後端可直接 json.loads）
        formData.append('conditions', JSON.stringify(conds));
        // B: 重複欄位（後端可用 getlist('conditions')）
        conds.forEach(c => formData.append('conditions', c));
      }
      console.log('送出的 conditions:', conds);
      
      console.log('發送到後端的資料:');
      for (let [key, value] of formData.entries()) {
        console.log(`${key}: ${value}`);
      }

      // Step 3: 執行計算
      const res = await axios.post(
        '/calculator/calculation/',
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );
      const pr = res.data.persist_result;
      const usedFeedId = pr?.feed?.id ?? feed.id;   // ← 用新的 id（若有）

      await axios.post('/calculator/feeds/usage/', {
        feed_id: usedFeedId,
        pet_id: selectedPet?.id
      });
      if (pr && pr.feed && pr.feed.id && pr.action) {
        // 更新當前 feed
        setFeeds(prev => {
          const arr = [...prev];
          arr[selectedFeed] = {
            ...arr[selectedFeed],
            id: pr.feed.id,
            name: pr.feed.name,
            brand: pr.feed.brand,
            carb: pr.feed.carbohydrate,
            protein: pr.feed.protein,
            fat: pr.feed.fat,
            ca: pr.feed.calcium,
            p: pr.feed.phosphorus,
            mg: (pr.feed.magnesium ?? 0) * 1000, // 顯示仍用 mg
            na: (pr.feed.sodium ?? 0) * 1000,
          };
          return arr;
        });
      }
      console.log('計算成功：', res.data);
      
      // 計算成功後更新飼料使用次數
      // try {
      //   await axios.post('/calculator/feeds/usage/', {
      //     feed_id: feed.id,
      //     pet_id: selectedPet?.id
      //   });
      //   console.log('飼料使用次數已更新');
      // } catch (usageError) {
      //   console.warn('更新使用次數失敗，但不影響主要功能：', usageError);
      // }
      
      // 通知第三步計算完成
      onNext(feed, {
        isCalculating: false,
        calculationResult: res.data
      });
    } catch (err) {
      console.error('計算失敗：', err.response?.data || err.message);
      console.error('完整錯誤資訊:', {
        status: err.response?.status,
        statusText: err.response?.statusText,
        data: err.response?.data,
        message: err.message
      });
      
      let errorMessage = '計算失敗';
      if (err.response?.data?.error) {
        errorMessage = err.response.data.error;
      } else if (err.response?.status === 400) {
        errorMessage = '資料格式錯誤，請檢查輸入資料';
      } else if (err.response?.status === 404) {
        errorMessage = 'API 路徑不存在，請聯繫管理員';
      } else if (err.response?.status === 500) {
        errorMessage = '伺服器內部錯誤，請稍後再試';
      }
      
      // 通知第三步顯示錯誤
      onNext(feed, {
        isCalculating: false,
        error: errorMessage
      });
    }
  };

  return (
    <>
      <div className={styles.titleSection}>
        <h2 className={styles.title}>營養計算機</h2>
        <button className={styles.historyButton} onClick={handleHistoryClick}>
          過去紀錄
        </button>
      </div>
      <div className={styles.divider}></div>
      
      <div className={styles.stepLabel}>Step 2. 請選擇一款飼料</div>
      
      <div className={styles.section}>
        <label className={styles.sectionLabel}>選擇飼料:</label>
        <div className={styles.feedSelectSection}>
          <div className={styles.selectedFeedDisplay}>
            {feeds.length > 0 && selectedFeed >= 0 ? (
              <div className={styles.selectedFeedInfo}>
                <div className={styles.selectedFeedImage}>
                  <img src={feeds[selectedFeed].img} alt={feeds[selectedFeed].name} />
                  {!feeds[selectedFeed].is_verified && (
                    <div className={styles.verifyingBadge}>
                      <img src="/assets/icon/Verifying.png" alt="審核中" />
                    </div>
                  )}
                </div>
                <div className={styles.selectedFeedDetails}>
                  <div className={styles.selectedFeedName}>{feeds[selectedFeed].name}</div>
                  <div className={styles.selectedFeedBrand}>{feeds[selectedFeed].brand}</div>
                  {feeds[selectedFeed].price && (
                    <div className={styles.selectedFeedPrice}>NT$ {feeds[selectedFeed].price}</div>
                  )}
                  <div className={styles.selectedFeedStatus}>
                    {feeds[selectedFeed].is_verified ? (
                      <span className={styles.verified}>✓ 已驗證</span>
                    ) : (
                      <span className={styles.unverified}>審核中 ({feeds[selectedFeed].review_count}/5)</span>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className={styles.noFeedSelected}>
                <div className={styles.noFeedIcon}>
                  <img src="/assets/icon/SearchNoResult.png" alt="無選擇" />
                </div>
                <div className={styles.noFeedText}>
                  {selectedPet ? '請選擇飼料' : '請先選擇寵物'}
                </div>
              </div>
            )}
          </div>
          <div className={styles.feedActionButtons}>
            <button className={styles.selectFeedBtn} type="button" onClick={() => setShowFeedSelectModal(true)}>
              選擇飼料
            </button>
            <button className={styles.addFeedBtn} type="button" onClick={handleShowCreateFeedModal}>
              新增飼料
            </button>
          </div>
        </div>
      </div>
      
      <div className={styles.section}>
        <label className={styles.sectionLabel}>飼料資訊:</label>
        <div className={styles.feedInfoSection}>
        {[
          ['品名', 'name', 'text'],
          ['品牌', 'brand', 'text'],
          ['碳水化合物', 'carb', 'number', 'g'],
          ['蛋白質', 'protein', 'number', 'g'],
          ['脂肪', 'fat', 'number', 'g'],
          ['鈣', 'ca', 'number', 'g'],
          ['磷', 'p', 'number', 'g'],
          ['鎂', 'mg', 'number', 'mg'],
          ['鈉', 'na', 'number', 'mg'],
        ].map(([label, key, type, unit]) => (
          <div className={styles.feedInfoRow} key={key}>
            <span className={styles.feedInfoLabel}>{label}：</span>
            <input
              className={styles.feedInfoInput}
              type={type}
              value={feedInfo[key]}
              onChange={e => handleFeedInfoChange(key, e.target.value)}
            />
            {unit && <span className={styles.feedInfoUnit}>{unit}</span>}
          </div>
        ))}
        </div>
      </div>
      
      <div className={styles.actionButtons}>
        <button className={styles.prevButton} onClick={onPrev}>上一步</button>
        <button className={styles.nextButton} onClick={handleNext}>下一步</button>
      </div>
      
      <CreateFeedModal
        isOpen={showCreateFeedModal}
        onClose={handleCloseCreateFeedModal}
        onConfirm={handleCreateFeed}
        defaultPetType={selectedPet?.species === '狗' ? 'dog' : 'cat'}
      />
      
      <HistoryRecordModal
        isOpen={showHistoryModal}
        onClose={() => setShowHistoryModal(false)}
      />
      
      <FeedSelectModal
        isOpen={showFeedSelectModal}
        onClose={() => setShowFeedSelectModal(false)}
        onSelectFeed={handleFeedSelect}
        petType={selectedPet?.species === '狗' ? 'dog' : 'cat'}
      />
      
      <FeedReviewConfirmModal
        isVisible={showConfirmModal}
        onClose={handleConfirmModalClose}
        onConfirm={handleConfirmModalConfirm}
      />
      
      <FeedReviewModal
        feed={pendingFeedForReview}
        isOpen={showReviewModal}
        onClose={handleReviewModalClose}
        onConfirm={handleReviewConfirm}
        onReportError={handleReportError}
      />
      
      {notification && (
        <NotificationComponent 
          message={notification} 
          onClose={() => setNotification('')} 
        />
      )}
    </>
  );
}

export default CalculatorStep2;