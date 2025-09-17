import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import styles from '../styles/CreateFeedModal.module.css';
import NotificationComponent from './Notification';

const CreateFeedModal = ({ isOpen, onClose, onConfirm, defaultPetType = 'cat' }) => {
  const { t } = useTranslation('feed');
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
        showNotification(t('createModal.messages.imageTooLarge'));
        return;
      }
      
      if (!file.type.startsWith('image/')) {
        showNotification(t('createModal.messages.selectImageFile'));
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
        showNotification(t('createModal.messages.imageTooLarge'));
        return;
      }
      
      if (!file.type.startsWith('image/')) {
        showNotification(t('createModal.messages.selectImageFile'));
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
      showNotification(t('createModal.messages.enterFeedName'));
      return false;
    }
    
    if (!feedBrand.trim()) {
      showNotification(t('createModal.messages.enterFeedBrand'));
      return false;
    }
    
    if (feedName.trim().length > 100) {
      showNotification(t('createModal.messages.feedNameTooLong'));
      return false;
    }
    
    if (feedBrand.trim().length > 100) {
      showNotification(t('createModal.messages.brandNameTooLong'));
      return false;
    }
    
    if (!feedPrice || feedPrice.trim() === '') {
      showNotification(t('createModal.messages.enterFeedPrice'));
      return false;
    }
    
    if (isNaN(feedPrice)) {
      showNotification(t('createModal.messages.invalidPrice'));
      return false;
    }
    
    if (parseFloat(feedPrice) < 0) {
      showNotification(t('createModal.messages.invalidPrice'));
      return false;
    }
    
    if (!frontImage) {
      showNotification(t('createModal.messages.uploadFrontImage'));
      return false;
    }
    
    if (!nutritionImage) {
      showNotification(t('createModal.messages.uploadNutritionImage'));
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
      console.error('Create feed failed:', error);
      showNotification(t('page.messages.addFeedFailed'));
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
          <h2>{t('createModal.title')}</h2>
        </div>
        
        <div className={styles.modalBody}>
          {/* 寵物類型選擇區域 */}
          <div className={styles.selectSection}>
            <label className={styles.selectLabel}>{t('createModal.labels.petType')}</label>
            <select 
              className={styles.petTypeSelect}
              value={petType}
              onChange={(e) => setPetType(e.target.value)}
              disabled={loading}
            >
              <option value="cat">{t('createModal.petType.cat')}</option>
              <option value="dog">{t('createModal.petType.dog')}</option>
            </select>
          </div>

          {/* 飼料名稱輸入區域 */}
          <div className={styles.inputSection}>
            <label className={styles.inputLabel}>{t('createModal.labels.feedName')}</label>
            <input
              type="text"
              className={styles.textInput}
              value={feedName}
              onChange={(e) => setFeedName(e.target.value)}
              placeholder={t('createModal.placeholders.feedName')}
              maxLength="100"
              disabled={loading}
            />
          </div>

          {/* 飼料品牌輸入區域 */}
          <div className={styles.inputSection}>
            <label className={styles.inputLabel}>{t('createModal.labels.feedBrand')}</label>
            <input
              type="text"
              className={styles.textInput}
              value={feedBrand}
              onChange={(e) => setFeedBrand(e.target.value)}
              placeholder={t('createModal.placeholders.feedBrand')}
              maxLength="100"
              disabled={loading}
            />
          </div>

          {/* 飼料價格輸入區域 */}
          <div className={styles.inputSection}>
            <label className={styles.inputLabel}>{t('createModal.labels.feedPrice')}</label>
            <input
              type="number"
              className={styles.textInput}
              value={feedPrice}
              onChange={(e) => setFeedPrice(e.target.value)}
              placeholder={t('createModal.placeholders.feedPrice')}
              min="0"
              step="0.01"
              disabled={loading}
            />
          </div>

          {/* 正面圖片上傳區域 */}
          <div className={styles.uploadSection}>
            <label className={styles.uploadLabel}>{t('createModal.labels.frontImage')}</label>
            <div className={styles.imageSection}>
              {!frontPreview ? (
                <div className={styles.noImageState}>
                  <button
                    className={styles.uploadButton}
                    onClick={() => frontInputRef.current?.click()}
                    disabled={loading}
                  >
                    {t('createModal.buttons.uploadFront')}
                  </button>
                  <p className={styles.uploadHint}>{t('createModal.messages.uploadFrontImage')}</p>
                </div>
              ) : (
                <div className={styles.imagePreview}>
                  <img src={frontPreview} alt={t('createModal.alt.frontImage')} />
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
            <label className={styles.uploadLabel}>{t('createModal.labels.nutritionImage')}</label>
            <div className={styles.imageSection}>
              {!nutritionPreview ? (
                <div className={styles.noImageState}>
                  <button
                    className={styles.uploadButton}
                    onClick={() => nutritionInputRef.current?.click()}
                    disabled={loading}
                  >
                    {t('createModal.buttons.uploadNutrition')}
                  </button>
                  <p className={styles.uploadHint}>{t('createModal.messages.uploadNutritionImage')}</p>
                </div>
              ) : (
                <div className={styles.imagePreview}>
                  <img src={nutritionPreview} alt={t('createModal.alt.nutritionImage')} />
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
            {t('createModal.buttons.cancel')}
          </button>
          <button 
            className={styles.confirmButton} 
            onClick={handleConfirm}
            disabled={loading}
          >
            {loading ? t('createModal.buttons.processing') : t('createModal.buttons.confirm')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateFeedModal;