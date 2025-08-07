import React, { useState, useRef, useEffect } from 'react';
import styles from '../styles/CreateFeedModal.module.css';
import NotificationComponent from './Notification';

const CreateFeedModal = ({ isOpen, onClose, onConfirm, defaultPetType = 'cat' }) => {
  const [frontImage, setFrontImage] = useState(null);
  const [nutritionImage, setNutritionImage] = useState(null);
  const [frontPreview, setFrontPreview] = useState(null);
  const [nutritionPreview, setNutritionPreview] = useState(null);
  const [petType, setPetType] = useState(defaultPetType);
  const [feedName, setFeedName] = useState(''); // 飼料名稱
  const [feedBrand, setFeedBrand] = useState(''); // 飼料品牌
  const [feedPrice, setFeedPrice] = useState(''); // 飼料價格
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState('');
  
  const frontInputRef = useRef(null);
  const nutritionInputRef = useRef(null);

  // 當 defaultPetType 改變時更新 petType
  useEffect(() => {
    setPetType(defaultPetType);
  }, [defaultPetType]);

  // 顯示通知
  const showNotification = (message) => {
    setNotification(message);
  };

  // 隱藏通知
  const hideNotification = () => {
    setNotification('');
  };

  // 處理正面圖片選擇
  const handleFrontImageSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        showNotification('圖片大小不能超過 5MB');
        return;
      }
      
      if (!file.type.startsWith('image/')) {
        showNotification('請選擇圖片檔案');
        return;
      }
      
      setFrontImage(file);
      const url = URL.createObjectURL(file);
      setFrontPreview(url);
    }
  };

  // 處理營養標示圖片選擇
  const handleNutritionImageSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        showNotification('圖片大小不能超過 5MB');
        return;
      }
      
      if (!file.type.startsWith('image/')) {
        showNotification('請選擇圖片檔案');
        return;
      }
      
      setNutritionImage(file);
      const url = URL.createObjectURL(file);
      setNutritionPreview(url);
    }
  };

  // 移除正面圖片
  const handleRemoveFrontImage = () => {
    setFrontImage(null);
    setFrontPreview(null);
    if (frontInputRef.current) {
      frontInputRef.current.value = '';
    }
  };

  // 移除營養標示圖片
  const handleRemoveNutritionImage = () => {
    setNutritionImage(null);
    setNutritionPreview(null);
    if (nutritionInputRef.current) {
      nutritionInputRef.current.value = '';
    }
  };

  // 驗證表單
  const validateForm = () => {
    if (!feedName.trim()) {
      showNotification('請輸入飼料名稱');
      return false;
    }
    
    if (!feedBrand.trim()) {
      showNotification('請輸入飼料品牌');
      return false;
    }
    
    if (feedName.trim().length > 100) {
      showNotification('飼料名稱不能超過100字元');
      return false;
    }
    
    if (feedBrand.trim().length > 100) {
      showNotification('品牌名稱不能超過100字元');
      return false;
    }
    
    if (!feedPrice || feedPrice.trim() === '') {
      showNotification('請輸入飼料價格');
      return false;
    }
    
    if (isNaN(feedPrice)) {
      showNotification('價格必須是數字');
      return false;
    }
    
    if (parseFloat(feedPrice) < 0) {
      showNotification('價格不能是負數');
      return false;
    }
    
    if (!frontImage) {
      showNotification('請上傳飼料正面圖片');
      return false;
    }
    
    if (!nutritionImage) {
      showNotification('請上傳營養成分表圖片');
      return false;
    }
    
    return true;
  };

  // 處理確認
  const handleConfirm = async () => {
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      await onConfirm({
        frontImage,
        nutritionImage,
        petType,
        feedName: feedName.trim(),
        feedBrand: feedBrand.trim(),
        feedPrice: parseFloat(feedPrice)
      });
      handleClose();
    } catch (error) {
      console.error('建立飼料失敗:', error);
      showNotification('建立飼料失敗，請稍後再試');
    } finally {
      setLoading(false);
    }
  };

  // 處理關閉
  const handleClose = () => {
    // 重置所有狀態
    setFrontImage(null);
    setNutritionImage(null);
    setFrontPreview(null);
    setNutritionPreview(null);
    setPetType('cat');
    setFeedName('');
    setFeedBrand('');
    setFeedPrice('');
    setNotification('');
    if (frontInputRef.current) {
      frontInputRef.current.value = '';
    }
    if (nutritionInputRef.current) {
      nutritionInputRef.current.value = '';
    }
    onClose();
  };

  // 處理點擊遮罩關閉 modal
  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay} onClick={handleOverlayClick}>
      {notification && (
        <NotificationComponent
          message={notification}
          onClose={hideNotification}
        />
      )}
      <div className={styles.modalContainer}>
        <div className={styles.modalHeader}>
          <h2>新增飼料</h2>
        </div>
        
        <div className={styles.modalBody}>
          {/* 寵物類型選擇區域 */}
          <div className={styles.selectSection}>
            <label className={styles.selectLabel}>寵物類型</label>
            <select 
              className={styles.petTypeSelect}
              value={petType}
              onChange={(e) => setPetType(e.target.value)}
              disabled={loading}
            >
              <option value="cat">貓咪飼料</option>
              <option value="dog">狗狗飼料</option>
            </select>
          </div>

          {/* 飼料名稱輸入區域 */}
          <div className={styles.inputSection}>
            <label className={styles.inputLabel}>飼料名稱</label>
            <input
              type="text"
              className={styles.textInput}
              value={feedName}
              onChange={(e) => setFeedName(e.target.value)}
              placeholder="請輸入飼料名稱"
              maxLength="100"
              disabled={loading}
            />
          </div>

          {/* 飼料品牌輸入區域 */}
          <div className={styles.inputSection}>
            <label className={styles.inputLabel}>飼料品牌</label>
            <input
              type="text"
              className={styles.textInput}
              value={feedBrand}
              onChange={(e) => setFeedBrand(e.target.value)}
              placeholder="請輸入飼料品牌"
              maxLength="100"
              disabled={loading}
            />
          </div>

          {/* 飼料價格輸入區域 */}
          <div className={styles.inputSection}>
            <label className={styles.inputLabel}>飼料價格</label>
            <input
              type="number"
              className={styles.textInput}
              value={feedPrice}
              onChange={(e) => setFeedPrice(e.target.value)}
              placeholder="請輸入飼料價格"
              min="0"
              step="0.01"
              disabled={loading}
            />
          </div>

          {/* 正面圖片上傳區域 */}
          <div className={styles.uploadSection}>
            <label className={styles.uploadLabel}>飼料正面圖片</label>
            <div className={styles.imageSection}>
              {!frontPreview ? (
                <div className={styles.noImageState}>
                  <button 
                    className={styles.uploadButton}
                    onClick={() => frontInputRef.current?.click()}
                    disabled={loading}
                  >
                    選擇圖片
                  </button>
                  <p className={styles.uploadHint}>請上傳飼料包裝正面圖片</p>
                </div>
              ) : (
                <div className={styles.imagePreview}>
                  <img src={frontPreview} alt="飼料正面" />
                  <button 
                    className={styles.removeImageBtn}
                    onClick={handleRemoveFrontImage}
                    disabled={loading}
                  >
                    ×
                  </button>
                </div>
              )}
            </div>
            <input
              ref={frontInputRef}
              type="file"
              accept="image/*"
              onChange={handleFrontImageSelect}
              className={styles.hiddenInput}
            />
          </div>

          {/* 營養標示圖片上傳區域 */}
          <div className={styles.uploadSection}>
            <label className={styles.uploadLabel}>營養成分表圖片</label>
            <div className={styles.imageSection}>
              {!nutritionPreview ? (
                <div className={styles.noImageState}>
                  <button 
                    className={styles.uploadButton}
                    onClick={() => nutritionInputRef.current?.click()}
                    disabled={loading}
                  >
                    選擇圖片
                  </button>
                  <p className={styles.uploadHint}>請上傳營養成分表圖片</p>
                </div>
              ) : (
                <div className={styles.imagePreview}>
                  <img src={nutritionPreview} alt="營養成分表" />
                  <button 
                    className={styles.removeImageBtn}
                    onClick={handleRemoveNutritionImage}
                    disabled={loading}
                  >
                    ×
                  </button>
                </div>
              )}
            </div>
            <input
              ref={nutritionInputRef}
              type="file"
              accept="image/*"
              onChange={handleNutritionImageSelect}
              className={styles.hiddenInput}
            />
          </div>
        </div>

        <div className={styles.modalFooter}>
          <button 
            className={styles.cancelButton} 
            onClick={handleClose}
            disabled={loading}
          >
            取消
          </button>
          <button 
            className={styles.confirmButton} 
            onClick={handleConfirm}
            disabled={loading}
          >
            {loading ? '處理中...' : '確認'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateFeedModal;