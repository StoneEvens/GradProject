import React, { useState, useEffect } from 'react';
import TopNavbar from '../components/TopNavbar.jsx';
import BottomNavbar from '../components/BottomNavigationbar';
import styles from '../styles/CalculatorPageV2.module.css';
import { getUserPets } from '../services/petService';
import axios from '../utils/axios';
import CreateFeedModal from '../components/CreateFeedModal';
import FeedSelectModal from '../components/FeedSelectModal';
import NotificationComponent from '../components/Notification';
import HistoryRecordModal from '../components/HistoryRecordModal';
import defaultAvatar from '../MockPicture/mockCat1.jpg';
import mockFeed1 from '../MockPicture/mockFeed1.png';
import mockFeed2 from '../MockPicture/mockFeed2.png';
import mockFeed3 from '../MockPicture/mockFeed3.png';
import { useUser } from '../context/UserContext';
import { saveHistoryRecord } from '../utils/historyRecordStorage';

const CONDITION_OPTIONS = [
  '慢性腎臟病', '肝臟疾病', '關節炎/肥胖', '心臟病', '糖尿病',
  '泌尿道結石', '胰臟炎', '食物過敏/腸胃敏感', '皮膚問題'
];

const speciesMap = {
  cat: '貓',
  dog: '狗',
};

const speciesReverseMap = {
  '貓': 'cat',
  '狗': 'dog',
};

function CalculatorPageV2() {
  const { userData } = useUser();
  const [activeSection, setActiveSection] = useState('pet'); // pet, condition, feed, calculate
  const [pets, setPets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState('');
  
  // Modals
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  
  // 選擇寵物相關
  const [selectedPet, setSelectedPet] = useState(null);
  const [selectedPetIndex, setSelectedPetIndex] = useState(0);
  const [petMode, setPetMode] = useState('select'); // 'select' or 'add'
  const [isLocked, setIsLocked] = useState(false);
  const [editInfo, setEditInfo] = useState({
    weight: '',
    height: '',
  });
  
  // 新增臨時寵物相關
  const [tempPet, setTempPet] = useState({
    pet_name: '',
    species: '貓',
    weight: '',
    height: '',
    pet_stage: 'adult'
  });
  
  // 寵物狀況相關
  const [selectedConditions, setSelectedConditions] = useState([]);
  const [otherChecked, setOtherChecked] = useState(false);
  const [otherText, setOtherText] = useState('');
  
  // 飼料相關
  const [selectedFeed, setSelectedFeed] = useState(null);
  const [feeds, setFeeds] = useState([]);
  const [showCreateFeedModal, setShowCreateFeedModal] = useState(false);
  const [showFeedSelectModal, setShowFeedSelectModal] = useState(false);
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
  
  // 計算結果
  const [calculationResult, setCalculationResult] = useState(null);
  const [calculating, setCalculating] = useState(false);
  const [hasCalculated, setHasCalculated] = useState(false);
  
  // 快速計算相關
  const [lastUsedData, setLastUsedData] = useState(null);

  // 載入寵物資料
  useEffect(() => {
    const fetchPets = async () => {
      try {
        const petsData = await getUserPets();
        const formattedPets = petsData?.map((pet) => ({
          id: pet.pet_id,
          pet_name: pet.pet_name,
          species: speciesMap[pet.pet_type] || pet.pet_type,
          pet_type: pet.pet_type,
          weight: pet.weight || '',
          height: pet.height || '',
          avatar: pet.headshot_url || defaultAvatar,
          pet_stage: pet.pet_stage,
          predicted_adult_weight: pet.predicted_adult_weight,
        })) || [];
        
        setPets(formattedPets);
        if (formattedPets.length > 0) {
          setSelectedPet(formattedPets[0]);
          setEditInfo({
            weight: formattedPets[0].weight,
            height: formattedPets[0].height,
          });
        }
      } catch (error) {
        console.error('載入寵物失敗：', error);
        setPets([]);
      } finally {
        setLoading(false);
      }
    };

    fetchPets();
  }, []);

  // 載入上次使用的資料
  useEffect(() => {
    const savedData = localStorage.getItem('calculatorLastUsedData');
    if (savedData) {
      try {
        setLastUsedData(JSON.parse(savedData));
      } catch (error) {
        console.error('載入上次使用資料失敗:', error);
      }
    }
  }, []);

  // 儲存當前資料為上次使用
  const saveAsLastUsed = () => {
    if (selectedPet && selectedFeed) {
      const dataToSave = {
        pet: {
          id: selectedPet.id,
          pet_name: selectedPet.pet_name,
          species: selectedPet.species,
          pet_type: selectedPet.pet_type,
          weight: editInfo.weight,
          height: editInfo.height,
        },
        feed: selectedFeed,
        feedInfo: feedInfo,
        conditions: selectedConditions,
        otherText: otherText,
        timestamp: new Date().toISOString()
      };
      
      localStorage.setItem('calculatorLastUsedData', JSON.stringify(dataToSave));
      setLastUsedData(dataToSave);
    }
  };

  // 快速載入上次使用的資料
  const quickLoadLastUsed = () => {
    if (!lastUsedData) {
      setNotification('沒有上次使用的資料');
      return;
    }

    try {
      const { pet, feed, feedInfo: savedFeedInfo, conditions, otherText: savedOtherText } = lastUsedData;
      
      // 檢查寵物是否還存在
      const existingPet = pets.find(p => p.id === pet.id);
      if (!existingPet) {
        setNotification('上次使用的寵物已不存在');
        return;
      }

      // 載入寵物資料
      const petIndex = pets.findIndex(p => p.id === pet.id);
      setSelectedPetIndex(petIndex);
      setSelectedPet({
        ...existingPet,
        weight: pet.weight,
        height: pet.height,
      });
      setEditInfo({
        weight: pet.weight,
        height: pet.height,
      });

      // 載入飼料資料
      setSelectedFeed(feed);
      setFeedInfo(savedFeedInfo);
      setFeeds([feed]);

      // 載入狀況資料
      setSelectedConditions(conditions || []);
      setOtherText(savedOtherText || '');

      // 跳轉到飼料選擇頁面
      setActiveSection('feed');
      
      setNotification('已載入上次使用的資料');
      
    } catch (error) {
      console.error('載入失敗:', error);
      setNotification('載入上次使用資料失敗');
    }
  };

  // 重置計算機
  const resetCalculator = () => {
    // 如果有計算結果，先保存到歷史紀錄
    if (calculationResult && selectedPet && selectedFeed) {
      const recordData = {
        petId: selectedPet.id,
        petName: selectedPet.pet_name,
        feedId: selectedFeed.id,
        feedName: selectedFeed.name,
        feedBrand: selectedFeed.brand,
        calculationResult: {
          description: calculationResult.description,
          daily_ME_kcal: calculationResult.daily_ME_kcal,
          daily_feed_amount_g: calculationResult.daily_feed_amount_g,
          recommended_nutrients: calculationResult.recommended_nutrients,
          actual_intake: calculationResult.actual_intake
        }
      };
      saveHistoryRecord(recordData);
    }
    
    // 重置所有狀態到初始狀態
    setActiveSection('pet');
    setPetMode('select');
    setIsLocked(false);
    setSelectedPet(pets.length > 0 ? pets[0] : null);
    setSelectedPetIndex(0);
    setEditInfo({
      weight: pets.length > 0 ? pets[0].weight : '',
      height: pets.length > 0 ? pets[0].height : '',
    });
    setTempPet({
      pet_name: '',
      species: '貓',
      weight: '',
      height: '',
      pet_stage: 'adult'
    });
    setSelectedConditions([]);
    setOtherChecked(false);
    setOtherText('');
    setSelectedFeed(null);
    setFeeds([]);
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
    setCalculationResult(null);
    setCalculating(false);
    setHasCalculated(false);
    
    setNotification('計算機已重置');
  };

  // 按鈕點擊處理
  const handleSectionChange = (section) => {
    // 如果已經計算過，點擊計算按鈕應該直接跳轉到結果頁面
    if (section === 'calculate' && hasCalculated && calculationResult) {
      setActiveSection(section);
      return;
    }
    
    // 驗證前置條件
    if (section === 'condition' && !selectedPet) {
      setNotification('請先選擇寵物');
      return;
    }
    if (section === 'feed' && !selectedPet) {
      setNotification('請先選擇寵物');
      return;
    }
    if (section === 'calculate') {
      if (!selectedPet) {
        setNotification('請先選擇寵物');
        return;
      }
      if (!selectedFeed) {
        setNotification('請先選擇飼料');
        return;
      }
      // 開始計算
      handleCalculate();
    }
    setActiveSection(section);
  };

  // 選擇寵物
  const handleSelectPet = (idx) => {
    setSelectedPetIndex(idx);
    setSelectedPet(pets[idx]);
    setEditInfo({
      weight: pets[idx].weight,
      height: pets[idx].height,
    });
  };

  // 切換寵物模式
  const handlePetModeChange = (mode) => {
    // 如果是鎖定狀態，不允許切換
    if (isLocked && mode !== petMode) {
      return;
    }
    
    setPetMode(mode);
    if (mode === 'add') {
      // 切換到新增模式時，清空當前選擇
      setSelectedPet(null);
      setSelectedPetIndex(-1);
    } else {
      // 切換到選擇模式時，選擇第一隻寵物
      if (pets.length > 0) {
        handleSelectPet(0);
      }
    }
  };

  // 處理臨時寵物資料變更
  const handleTempPetChange = (field, value) => {
    setTempPet(prev => ({...prev, [field]: value}));
  };

  // 處理創建/取消按鈕
  const handleCreateTempPetClick = () => {
    if (isLocked) {
      // 如果是鎖定狀態，點擊是取消選擇
      setIsLocked(false);
      setSelectedPet(null);
      setSelectedPetIndex(-1);
      // 清空臨時寵物資料
      setTempPet({
        pet_name: '',
        species: '貓',
        weight: '',
        height: '',
        pet_stage: 'adult'
      });
      setEditInfo({
        weight: '',
        height: '',
      });
      setNotification('已取消選擇臨時寵物');
    } else {
      // 如果不是鎖定狀態，驗證並創建臨時寵物
      if (createTempPet()) {
        setIsLocked(true);
      }
    }
  };

  // 驗證並創建臨時寵物
  const createTempPet = () => {
    // 驗證必填欄位
    if (!tempPet.pet_name.trim()) {
      setNotification('請輸入寵物名字');
      return false;
    }
    if (!tempPet.weight) {
      setNotification('請輸入體重');
      return false;
    }
    if (!tempPet.height) {
      setNotification('請輸入身高');
      return false;
    }

    // 創建臨時寵物物件
    const newTempPet = {
      id: `temp_${Date.now()}`,
      pet_name: tempPet.pet_name.trim(),
      species: tempPet.species,
      pet_type: speciesReverseMap[tempPet.species],
      weight: parseFloat(tempPet.weight),
      height: parseFloat(tempPet.height),
      avatar: defaultAvatar,
      pet_stage: tempPet.pet_stage,
      isTemporary: true
    };

    setSelectedPet(newTempPet);
    setEditInfo({
      weight: newTempPet.weight,
      height: newTempPet.height,
    });

    setNotification('臨時寵物已創建並鎖定');
    return true;
  };

  // 更新寵物資訊
  const handleInfoChange = (field, value) => {
    setEditInfo((prev) => ({ ...prev, [field]: value }));
    if (selectedPet) {
      setSelectedPet((prev) => ({ ...prev, [field]: value }));
    }
  };

  // 切換慢性病選項
  const toggleCondition = (c) => {
    setSelectedConditions(prev =>
      prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]
    );
  };

  // 選擇飼料
  const handleSelectFeed = (feed) => {
    setSelectedFeed(feed);
    setFeedInfo({
      name: feed.name || '',
      brand: feed.brand || '',
      carb: feed.carbohydrate?.toString() || feed.carb?.toString() || '',
      protein: feed.protein?.toString() || '',
      fat: feed.fat?.toString() || '',
      ca: feed.calcium?.toString() || feed.ca?.toString() || '',
      p: feed.phosphorus?.toString() || feed.p?.toString() || '',
      mg: feed.magnesium ? (feed.magnesium * 1000).toString() : feed.mg?.toString() || '',
      na: feed.sodium ? (feed.sodium * 1000).toString() : feed.na?.toString() || '',
    });
    setFeeds([feed]);
  };

  // 更新飼料資訊
  const handleFeedInfoChange = (field, value) => {
    setFeedInfo(prev => ({ ...prev, [field]: value }));
  };

  // 新增飼料
  const handleCreateFeed = async ({ frontImage, nutritionImage, petType, feedName, feedBrand, feedPrice }) => {
    try {
      // OCR 辨識
      const ocrForm = new FormData();
      ocrForm.append('image', nutritionImage);
      const ocrRes = await axios.post('/feeds/ocr/', ocrForm, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      const nutrients = ocrRes.data.extracted_nutrients || {};

      // 轉換圖片為 base64
      const convertToBase64 = (file) => {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.readAsDataURL(file);
          reader.onload = () => resolve(reader.result);
          reader.onerror = error => reject(error);
        });
      };

      const frontImageBase64 = frontImage ? await convertToBase64(frontImage) : null;
      const nutritionImageBase64 = nutritionImage ? await convertToBase64(nutritionImage) : null;

      // 建立飼料
      const parseNumber = (val) => typeof val === 'number' ? val : 0;
      const parseMgToG = (val) => (typeof val === 'number' ? val/1000 : 0);
      
      const createFeedPayload = {
        name: feedName || '自訂飼料',
        brand: feedBrand || '未知品牌',
        pet_type: petType,
        pet_id: selectedPet?.id,
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

      const createFeedRes = await axios.post('/feeds/create/', createFeedPayload);
      const responseData = createFeedRes.data;
      
      // 處理回應
      const newFeed = {
        id: responseData.feed_id || responseData.data?.id,
        name: feedName || '自訂飼料',
        brand: feedBrand || '未知品牌',
        img: frontImageBase64 || mockFeed1,
        carbohydrate: parseNumber(nutrients.carbohydrate),
        protein: parseNumber(nutrients.protein),
        fat: parseNumber(nutrients.fat),
        calcium: parseNumber(nutrients.calcium),
        phosphorus: parseNumber(nutrients.phosphorus),
        magnesium: parseNumber(nutrients.magnesium),
        sodium: parseNumber(nutrients.sodium),
        price: feedPrice
      };
      
      handleSelectFeed(newFeed);
      setNotification(responseData.message || '飼料建立成功');
      
    } catch (error) {
      console.error("建立飼料失敗：", error);
      setNotification('建立飼料失敗，請稍後再試');
    }
  };

  // 執行計算
  const handleCalculate = async () => {
    if (!selectedPet || !selectedFeed) {
      setNotification('請先選擇寵物和飼料');
      return;
    }

    if (!editInfo.weight) {
      setNotification('請輸入寵物體重');
      return;
    }

    setCalculating(true);
    setCalculationResult(null);

    try {
      // 更新寵物資訊
      if (selectedPet && !selectedPet.isTemporary) {
        const updatePayload = {
          pet_id: selectedPet.id,
          weight: parseFloat(editInfo.weight),
          length: parseFloat(editInfo.height),
        };
        await axios.post('/calculator/pets/update/', updatePayload);
      }

      // 準備計算資料
      const safeFloat = (value, defaultValue = 0) => {
        const num = parseFloat(value);
        return isNaN(num) ? defaultValue : num;
      };

      const mgToG = (v) => { 
        const n = parseFloat(v); 
        return isNaN(n) ? 0 : (n / 1000); 
      };

      const formData = new FormData();
      // 如果是臨時寵物，不傳送 pet_id
      if (!selectedPet.isTemporary) {
        formData.append('pet_id', selectedPet?.id || '');
      }
      formData.append('pet_type', selectedPet.pet_type || (selectedPet.species === '狗' ? 'dog' : 'cat'));
      formData.append('life_stage', selectedPet.pet_stage || 'adult');
      formData.append('weight', safeFloat(editInfo.weight));
      formData.append('expected_adult_weight', safeFloat(selectedPet.predicted_adult_weight));
      formData.append('protein', safeFloat(feedInfo.protein));
      formData.append('fat', safeFloat(feedInfo.fat));
      formData.append('carbohydrates', safeFloat(feedInfo.carb));
      formData.append('calcium', safeFloat(feedInfo.ca));
      formData.append('phosphorus', safeFloat(feedInfo.p));
      formData.append('magnesium', mgToG(feedInfo.mg));
      formData.append('sodium', mgToG(feedInfo.na));

      // 加入慢性病條件
      const conditions = [...selectedConditions];
      if (otherText.trim()) {
        conditions.push(otherText.trim());
      }
      if (conditions.length > 0) {
        formData.append('conditions', JSON.stringify(conditions));
        conditions.forEach(c => formData.append('conditions', c));
      }

      // 執行計算
      const res = await axios.post('/calculator/calculation/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setCalculationResult(res.data);
      setHasCalculated(true);
      
      // 儲存為上次使用的資料
      saveAsLastUsed();
      
      // 不在這裡儲存歷史記錄，而是在重置時才儲存

    } catch (error) {
      console.error('計算失敗：', error);
      setNotification('計算失敗，請稍後再試');
    } finally {
      setCalculating(false);
    }
  };

  // 格式化結果文字
  const formatResultText = (text) => {
    if (!text) return '';
    return text
      .replace(/\*\*/g, '')
      .replace(/\*/g, '')
      .replace(/#{1,6}\s/g, '')
      .replace(/^-\s+/gm, '')
      .trim();
  };

  return (
    <div className={styles.container}>
      <TopNavbar />
      <div className={styles.content}>
        <h2 className={styles.title}>營養計算機</h2>
        
        {/* 功能區域 */}
        <div className={styles.functionArea}>
          <button 
            className={styles.functionButton}
            onClick={resetCalculator}
          >
            重置計算機
          </button>
          
          <button 
            className={styles.functionButton}
            onClick={() => setNotification('快速計算功能正在開發中')}
          >
            快速計算
          </button>
          
          <button 
            className={styles.functionButton}
            onClick={() => setShowHistoryModal(true)}
          >
            歷史紀錄
          </button>
        </div>
        
        {/* 按鈕欄位 */}
        <div className={styles.buttonBar}>
          <button 
            className={`${styles.navButton} ${activeSection === 'pet' ? styles.active : ''}`}
            onClick={() => handleSectionChange('pet')}
          >
            <img src="/assets/icon/CalculatorChoosePetIcon.png" alt="選擇寵物" />
            <span>選擇寵物</span>
          </button>
          
          <span className={styles.operatorSymbol}>+</span>
          
          <button 
            className={`${styles.navButton} ${activeSection === 'condition' ? styles.active : ''}`}
            onClick={() => handleSectionChange('condition')}
          >
            <img src="/assets/icon/CalculatorPetConditionIcon.png" alt="寵物狀況" />
            <span>寵物狀況</span>
          </button>
          
          <span className={styles.operatorSymbol}>+</span>
          
          <button 
            className={`${styles.navButton} ${activeSection === 'feed' ? styles.active : ''}`}
            onClick={() => handleSectionChange('feed')}
          >
            <img src="/assets/icon/PetpageFeedButton.png" alt="選擇飼料" />
            <span>選擇飼料</span>
          </button>
          
          <span className={styles.operatorSymbol}>=</span>
          
          <button 
            className={`${styles.navButton} ${activeSection === 'calculate' ? styles.active : ''}`}
            onClick={() => handleSectionChange('calculate')}
          >
            <img src="/assets/icon/CalculatorCalculateIcon.png" alt={hasCalculated ? "計算結果" : "開始計算"} />
            <span>{hasCalculated ? "計算結果" : "開始計算"}</span>
          </button>
        </div>

        {/* 內容區域 */}
        <div className={styles.contentArea}>
          {loading ? (
            <div className={styles.loadingContainer}>載入中...</div>
          ) : (
            <>
              {/* 選擇寵物區域 */}
              {activeSection === 'pet' && (
                <div className={styles.section}>
                  <div className={styles.sectionHeader}>
                    <div className={styles.petModeToggle}>
                      <button
                        className={`${styles.modeButton} ${petMode === 'select' ? styles.activeModeButton : ''} ${isLocked ? styles.disabled : ''}`}
                        onClick={() => handlePetModeChange('select')}
                        disabled={isLocked}
                      >
                        選擇寵物
                      </button>
                      <button
                        className={`${styles.modeButton} ${petMode === 'add' ? styles.activeModeButton : ''}`}
                        onClick={() => handlePetModeChange('add')}
                      >
                        新增臨時寵物
                      </button>
                    </div>
                  </div>
                  
                  {petMode === 'select' ? (
                    <>
                      <div className={styles.petSwitcher}>
                        {pets.map((pet, idx) => (
                          <div
                            key={pet.id}
                            className={`${styles.petItem} ${selectedPetIndex === idx ? styles.activePet : ''}`}
                            onClick={() => handleSelectPet(idx)}
                          >
                            <img src={pet.avatar} alt={pet.pet_name} />
                            <span>{pet.pet_name}</span>
                          </div>
                        ))}
                      </div>

                      {selectedPet && (
                        <div className={styles.petInfoSection}>
                          <div className={styles.infoRow}>
                            <span className={styles.label}>名字：</span>
                            <span className={styles.value}>{selectedPet.pet_name}</span>
                          </div>
                          <div className={styles.infoRow}>
                            <span className={styles.label}>物種：</span>
                            <span className={styles.value}>{selectedPet.species}</span>
                          </div>
                          <div className={styles.infoRow}>
                            <span className={styles.label}>體重：</span>
                            <input
                              type="number"
                              value={editInfo.weight}
                              onChange={(e) => handleInfoChange('weight', e.target.value)}
                              className={styles.input}
                            />
                            <span className={styles.unit}>公斤</span>
                          </div>
                          <div className={styles.infoRow}>
                            <span className={styles.label}>身高：</span>
                            <input
                              type="number"
                              value={editInfo.height}
                              onChange={(e) => handleInfoChange('height', e.target.value)}
                              className={styles.input}
                            />
                            <span className={styles.unit}>公分</span>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className={styles.tempPetForm}>
                      <div className={styles.petInfoSection}>
                        <div className={styles.infoRow}>
                          <span className={styles.label}>名字：</span>
                          <input
                            type="text"
                            value={tempPet.pet_name}
                            onChange={(e) => handleTempPetChange('pet_name', e.target.value)}
                            className={styles.input}
                            placeholder="請輸入寵物名字"
                          />
                        </div>
                        <div className={styles.infoRow}>
                          <span className={styles.label}>物種：</span>
                          <select
                            value={tempPet.species}
                            onChange={(e) => handleTempPetChange('species', e.target.value)}
                            className={styles.select}
                          >
                            <option value="貓">貓</option>
                            <option value="狗">狗</option>
                          </select>
                        </div>
                        <div className={styles.infoRow}>
                          <span className={styles.label}>體重：</span>
                          <input
                            type="number"
                            value={tempPet.weight}
                            onChange={(e) => handleTempPetChange('weight', e.target.value)}
                            className={styles.input}
                            placeholder="請輸入體重"
                          />
                          <span className={styles.unit}>公斤</span>
                        </div>
                        <div className={styles.infoRow}>
                          <span className={styles.label}>身高：</span>
                          <input
                            type="number"
                            value={tempPet.height}
                            onChange={(e) => handleTempPetChange('height', e.target.value)}
                            className={styles.input}
                            placeholder="請輸入身高"
                          />
                          <span className={styles.unit}>公分</span>
                        </div>
                        <div className={styles.infoRow}>
                          <span className={styles.label}>階段：</span>
                          <select
                            value={tempPet.pet_stage}
                            onChange={(e) => handleTempPetChange('pet_stage', e.target.value)}
                            className={styles.select}
                          >
                            <option value="kitten">幼貓</option>
                            <option value="puppy">幼犬</option>
                            <option value="adult">成年</option>
                            <option value="pregnant">懷孕</option>
                            <option value="lactating">哺乳</option>
                          </select>
                        </div>
                      </div>
                      
                      <div className={styles.tempPetActions}>
                        <button
                          className={`${styles.createTempPetButton} ${isLocked ? styles.locked : ''}`}
                          onClick={handleCreateTempPetClick}
                        >
                          {isLocked ? '取消選擇' : '創建臨時寵物'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 寵物狀況區域 */}
              {activeSection === 'condition' && (
                <div className={styles.section}>
                  <div className={styles.conditionPanel}>
                    <div className={styles.conditionGrid}>
                      {CONDITION_OPTIONS.map(c => (
                        <label 
                          key={c} 
                          className={`${styles.conditionItem} ${selectedConditions.includes(c) ? styles.selected : ''}`}
                        >
                          <input
                            type="checkbox"
                            checked={selectedConditions.includes(c)}
                            onChange={() => toggleCondition(c)}
                          />
                          <span>{c}</span>
                        </label>
                      ))}
                      
                      <label 
                        className={`${styles.conditionItem} ${styles.otherConditionItem} ${(otherChecked || !!otherText) ? styles.selected : ''}`}
                      >
                        <input
                          type="checkbox"
                          checked={otherChecked || !!otherText}
                          onChange={(e) => setOtherChecked(e.target.checked)}
                        />
                        <span>其他：</span>
                        <input
                          type="text"
                          value={otherText}
                          onChange={(e) => setOtherText(e.target.value)}
                          placeholder="請輸入"
                          className={styles.otherInput}
                          maxLength={50}
                        />
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {/* 選擇飼料區域 */}
              {activeSection === 'feed' && (
                <div className={styles.section}>
                  <div className={styles.feedActions}>
                    <button 
                      className={styles.feedActionBtn}
                      onClick={() => setShowFeedSelectModal(true)}
                    >
                      選擇飼料
                    </button>
                    <button 
                      className={styles.feedActionBtn}
                      onClick={() => setShowCreateFeedModal(true)}
                    >
                      新增飼料
                    </button>
                  </div>

                  <div className={styles.feedSelectSection}>
                    {selectedFeed ? (
                      <div className={styles.selectedFeedDisplay}>
                        <img 
                          src={selectedFeed.img || mockFeed1} 
                          alt={selectedFeed.name}
                          className={styles.feedImage}
                        />
                        <div className={styles.feedDetails}>
                          <div className={styles.feedName}>{selectedFeed.name}</div>
                          <div className={styles.feedBrand}>{selectedFeed.brand}</div>
                        </div>
                      </div>
                    ) : (
                      <div className={styles.noFeedSelected}>
                        請選擇或新增飼料
                      </div>
                    )}
                  </div>

                  {selectedFeed && (
                    <div className={styles.feedInfoSection}>
                      <h4>營養成分（每100g）</h4>
                      <div className={styles.nutrientGrid}>
                        {[
                          ['蛋白質', 'protein', 'g'],
                          ['脂肪', 'fat', 'g'],
                          ['碳水化合物', 'carb', 'g'],
                          ['鈣', 'ca', 'g'],
                          ['磷', 'p', 'g'],
                          ['鎂', 'mg', 'mg'],
                          ['鈉', 'na', 'mg'],
                        ].map(([label, key, unit]) => (
                          <div className={styles.nutrientRow} key={key}>
                            <span className={styles.nutrientLabel}>{label}：</span>
                            <input
                              type="number"
                              value={feedInfo[key]}
                              onChange={e => handleFeedInfoChange(key, e.target.value)}
                              className={styles.nutrientInput}
                            />
                            <span className={styles.nutrientUnit}>{unit}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 計算結果區域 */}
              {activeSection === 'calculate' && (
                <div className={styles.section}>
                  {calculating ? (
                    <div className={styles.calculatingContainer}>
                      <div className={styles.spinner}></div>
                      <p>計算中，請稍候...</p>
                    </div>
                  ) : calculationResult ? (
                    <div className={styles.resultContainer}>
                      <div className={styles.resultItem}>
                        <div className={styles.resultRow}>
                          <span className={styles.resultLabel}>每日熱量需求：</span>
                          <span className={styles.resultValue}>{calculationResult.daily_ME_kcal} kcal</span>
                        </div>
                        <div className={styles.resultRow}>
                          <span className={styles.resultLabel}>每日飼料建議量：</span>
                          <span className={styles.resultValue}>{calculationResult.daily_feed_amount_g} 公克</span>
                        </div>
                      </div>

                      {calculationResult.description && (
                        <div className={styles.resultDescription}>
                          <div className={styles.descriptionText}>
                            {formatResultText(calculationResult.description)}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className={styles.noResultContainer}>
                      <p>點擊上方「開始計算」按鈕開始營養計算</p>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
      
      <BottomNavbar />

      {/* Modals */}
      <CreateFeedModal
        isOpen={showCreateFeedModal}
        onClose={() => setShowCreateFeedModal(false)}
        onConfirm={handleCreateFeed}
        defaultPetType={selectedPet?.pet_type || 'cat'}
      />
      
      <FeedSelectModal
        isOpen={showFeedSelectModal}
        onClose={() => setShowFeedSelectModal(false)}
        onSelectFeed={handleSelectFeed}
        petType={selectedPet?.pet_type || 'cat'}
      />
      
      <HistoryRecordModal
        isOpen={showHistoryModal}
        onClose={() => setShowHistoryModal(false)}
      />
      
      {notification && (
        <NotificationComponent 
          message={notification} 
          onClose={() => setNotification('')} 
        />
      )}
    </div>
  );
}

export default CalculatorPageV2;