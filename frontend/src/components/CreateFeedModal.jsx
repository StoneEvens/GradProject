import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import axios from '../utils/axios';
import styles from '../styles/CreateFeedModal.module.css';
import NotificationComponent from './Notification';

const CreateFeedModal = ({ isOpen, onClose, onConfirm, defaultPetType = 'cat' }) => {
  const { t } = useTranslation('feed');
  const [step, setStep] = useState(1); // 1: 基本資訊, 2: 確認資訊
  const [frontImage, setFrontImage] = useState(null);
  const [nutritionImage, setNutritionImage] = useState(null);
  const [frontPreview, setFrontPreview] = useState(null);
  const [nutritionPreview, setNutritionPreview] = useState(null);
  const [petType, setPetType] = useState(defaultPetType);
  const [feedName, setFeedName] = useState(''); // 飼料名稱
  const [feedBrand, setFeedBrand] = useState(''); // 飼料品牌
  const [feedPrice, setFeedPrice] = useState(''); // 飼料價格
  const [nutrients, setNutrients] = useState({
    protein: '',
    fat: '',
    carbohydrate: '',
    calcium: '',
    phosphorus: '',
    magnesium: '',
    sodium: ''
  }); // OCR 提取的營養成分
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

  // 處理下一步 (Step 1 -> Step 2: 調用 OCR API)
  const handleNext = async () => {
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      // 調用 OCR API 提取營養成分
      const ocrForm = new FormData();
      ocrForm.append('image', nutritionImage);
      const ocrRes = await axios.post('/feeds/ocr/', ocrForm, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      const extractedNutrients = ocrRes.data.extracted_nutrients || {};

      // 設置營養成分
      setNutrients({
        protein: extractedNutrients.protein || '',
        fat: extractedNutrients.fat || '',
        carbohydrate: extractedNutrients.carbohydrate || '',
        calcium: extractedNutrients.calcium || '',
        phosphorus: extractedNutrients.phosphorus || '',
        magnesium: extractedNutrients.magnesium || '',
        sodium: extractedNutrients.sodium || ''
      });

      // 進入第二步
      setStep(2);
    } catch (error) {
      console.error('OCR failed:', error);
      showNotification('OCR 辨識失敗，請重試或手動輸入營養成分');
    } finally {
      setLoading(false);
    }
  };

  // 處理上一步
  const handleBack = () => {
    setStep(1);
  };

  // 處理最終確認 (Step 2: 提交飼料)
  const handleFinalConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm({
        frontImage,
        nutritionImage,
        petType,
        feedName: feedName.trim(),
        feedBrand: feedBrand.trim(),
        feedPrice: parseFloat(feedPrice),
        nutrients
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
    setStep(1);
    setFrontImage(null);
    setNutritionImage(null);
    setFrontPreview(null);
    setNutritionPreview(null);
    setPetType('cat');
    setFeedName('');
    setFeedBrand('');
    setFeedPrice('');
    setNutrients({
      protein: '',
      fat: '',
      carbohydrate: '',
      calcium: '',
      phosphorus: '',
      magnesium: '',
      sodium: ''
    });
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
          <h2>{step === 1 ? t('createModal.title') : '確認飼料資訊'}</h2>
        </div>

        <div className={styles.modalBody}>
          {step === 1 ? (
            // Step 1: 基本資訊表單
            <>
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
              <div className={styles.inputSection} data-step="feed-name">
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
              <div className={styles.inputSection} data-step="feed-brand">
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

              {/* 圖片上傳區域 - 並排佈局 */}
              <div className={styles.uploadRow}>
                {/* 正面圖片上傳 */}
                <div className={styles.uploadColumn}>
                  <div className={styles.uploadHeader}>
                    <span className={styles.uploadLabel}>{t('createModal.labels.frontImage')}</span>
                    <button
                      className={styles.uploadBtn}
                      onClick={() => frontInputRef.current?.click()}
                      disabled={loading}
                    >
                      {t('createModal.buttons.upload')}
                    </button>
                  </div>
                  <div className={`${styles.imageBox} ${frontPreview ? styles.hasImage : ''}`}>
                    {!frontPreview ? (
                      <img
                        src="/assets/icon/PetpageFeedButton.png"
                        alt="placeholder"
                        className={styles.placeholderIcon}
                      />
                    ) : (
                      <>
                        <img src={frontPreview} alt={t('createModal.alt.frontImage')} className={styles.previewImage} />
                        <button
                          className={styles.removeImageBtn}
                          onClick={handleRemoveFrontImage}
                          disabled={loading}
                        >
                          ×
                        </button>
                      </>
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

                {/* 營養標示圖片上傳 */}
                <div className={styles.uploadColumn}>
                  <div className={styles.uploadHeader}>
                    <span className={styles.uploadLabel}>{t('createModal.labels.nutritionImage')}</span>
                    <button
                      className={styles.uploadBtn}
                      onClick={() => nutritionInputRef.current?.click()}
                      disabled={loading}
                    >
                      {t('createModal.buttons.upload')}
                    </button>
                  </div>
                  <div className={`${styles.imageBox} ${nutritionPreview ? styles.hasImage : ''}`}>
                    {!nutritionPreview ? (
                      <img
                        src="/assets/icon/PetpageFeedButton.png"
                        alt="placeholder"
                        className={styles.placeholderIcon}
                      />
                    ) : (
                      <>
                        <img src={nutritionPreview} alt={t('createModal.alt.nutritionImage')} className={styles.previewImage} />
                        <button
                          className={styles.removeImageBtn}
                          onClick={handleRemoveNutritionImage}
                          disabled={loading}
                        >
                          ×
                        </button>
                      </>
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
            </>
          ) : (
            // Step 2: 確認資訊頁面
            <>
              {/* 基本資訊 */}
              <div className={styles.confirmSection}>
                <h3 className={styles.sectionTitle}>基本資訊</h3>

                <div className={styles.inputSection}>
                  <label className={styles.inputLabel}>寵物類型</label>
                  <select
                    className={styles.petTypeSelect}
                    value={petType}
                    onChange={(e) => setPetType(e.target.value)}
                    disabled={loading}
                  >
                    <option value="cat">貓</option>
                    <option value="dog">狗</option>
                  </select>
                </div>

                <div className={styles.inputSection}>
                  <label className={styles.inputLabel}>飼料名稱</label>
                  <input
                    type="text"
                    className={styles.textInput}
                    value={feedName}
                    onChange={(e) => setFeedName(e.target.value)}
                    maxLength="100"
                    disabled={loading}
                  />
                </div>

                <div className={styles.inputSection}>
                  <label className={styles.inputLabel}>飼料品牌</label>
                  <input
                    type="text"
                    className={styles.textInput}
                    value={feedBrand}
                    onChange={(e) => setFeedBrand(e.target.value)}
                    maxLength="100"
                    disabled={loading}
                  />
                </div>

                <div className={styles.inputSection}>
                  <label className={styles.inputLabel}>飼料價格</label>
                  <input
                    type="number"
                    className={styles.textInput}
                    value={feedPrice}
                    onChange={(e) => setFeedPrice(e.target.value)}
                    min="0"
                    step="0.01"
                    disabled={loading}
                  />
                </div>
              </div>

              {/* 營養成分 */}
              <div className={styles.confirmSection}>
                <h3 className={styles.sectionTitle}>營養成分 (%)</h3>
                <p className={styles.sectionHint}>以下為 OCR 辨識結果，請確認並修改</p>

                <div className={styles.nutrientsGrid}>
                  <div className={styles.nutrientInput}>
                    <label className={styles.inputLabel}>蛋白質</label>
                    <input
                      type="number"
                      className={styles.textInput}
                      value={nutrients.protein}
                      onChange={(e) => setNutrients({...nutrients, protein: e.target.value})}
                      placeholder="0.0"
                      step="0.01"
                      disabled={loading}
                    />
                  </div>

                  <div className={styles.nutrientInput}>
                    <label className={styles.inputLabel}>脂肪</label>
                    <input
                      type="number"
                      className={styles.textInput}
                      value={nutrients.fat}
                      onChange={(e) => setNutrients({...nutrients, fat: e.target.value})}
                      placeholder="0.0"
                      step="0.01"
                      disabled={loading}
                    />
                  </div>

                  <div className={styles.nutrientInput}>
                    <label className={styles.inputLabel}>碳水化合物</label>
                    <input
                      type="number"
                      className={styles.textInput}
                      value={nutrients.carbohydrate}
                      onChange={(e) => setNutrients({...nutrients, carbohydrate: e.target.value})}
                      placeholder="0.0"
                      step="0.01"
                      disabled={loading}
                    />
                  </div>

                  <div className={styles.nutrientInput}>
                    <label className={styles.inputLabel}>鈣</label>
                    <input
                      type="number"
                      className={styles.textInput}
                      value={nutrients.calcium}
                      onChange={(e) => setNutrients({...nutrients, calcium: e.target.value})}
                      placeholder="0.0"
                      step="0.01"
                      disabled={loading}
                    />
                  </div>

                  <div className={styles.nutrientInput}>
                    <label className={styles.inputLabel}>磷</label>
                    <input
                      type="number"
                      className={styles.textInput}
                      value={nutrients.phosphorus}
                      onChange={(e) => setNutrients({...nutrients, phosphorus: e.target.value})}
                      placeholder="0.0"
                      step="0.01"
                      disabled={loading}
                    />
                  </div>

                  <div className={styles.nutrientInput}>
                    <label className={styles.inputLabel}>鎂</label>
                    <input
                      type="number"
                      className={styles.textInput}
                      value={nutrients.magnesium}
                      onChange={(e) => setNutrients({...nutrients, magnesium: e.target.value})}
                      placeholder="0.0"
                      step="0.01"
                      disabled={loading}
                    />
                  </div>

                  <div className={styles.nutrientInput}>
                    <label className={styles.inputLabel}>鈉</label>
                    <input
                      type="number"
                      className={styles.textInput}
                      value={nutrients.sodium}
                      onChange={(e) => setNutrients({...nutrients, sodium: e.target.value})}
                      placeholder="0.0"
                      step="0.01"
                      disabled={loading}
                    />
                  </div>
                </div>
              </div>

              {/* 圖片預覽 */}
              <div className={styles.confirmSection}>
                <h3 className={styles.sectionTitle}>圖片預覽</h3>
                <div className={styles.imagesPreviewGrid}>
                  {frontPreview && (
                    <div className={styles.previewItem}>
                      <label className={styles.inputLabel}>正面圖片</label>
                      <img src={frontPreview} alt="正面圖片" className={styles.confirmImage} />
                    </div>
                  )}
                  {nutritionPreview && (
                    <div className={styles.previewItem}>
                      <label className={styles.inputLabel}>營養標示</label>
                      <img src={nutritionPreview} alt="營養標示" className={styles.confirmImage} />
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        <div className={styles.modalFooter}>
          {step === 1 ? (
            // Step 1 按鈕
            <>
              <button
                className={styles.cancelButton}
                onClick={handleClose}
                disabled={loading}
              >
                {t('createModal.buttons.cancel')}
              </button>
              <button
                className={styles.confirmButton}
                onClick={handleNext}
              >
                {loading ? 'OCR 辨識中...' : '下一步'}
              </button>
            </>
          ) : (
            // Step 2 按鈕
            <>
              <button
                className={styles.cancelButton}
                onClick={handleBack}
                disabled={loading}
              >
                上一步
              </button>
              <button
                className={styles.confirmButton}
                onClick={handleFinalConfirm}
                disabled={loading}
              >
                {loading ? t('createModal.buttons.processing') : '確認新增'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default CreateFeedModal;