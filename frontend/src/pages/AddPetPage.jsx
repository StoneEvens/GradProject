import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import styles from '../styles/AddPetPage.module.css';
import TopNavbar from '../components/TopNavbar';
import BottomNavbar from '../components/BottomNavigationbar';
import Notification from '../components/Notification';
import { NotificationProvider } from '../context/NotificationContext';
import petService from '../services/petService';
import { handleImageSelection, revokeImagePreview, createProgressCallback } from '../utils/imageUtils';

const AddPetPage = () => {
  const { t } = useTranslation('pet');
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const [phase, setPhase] = useState(1);
  const [petType, setPetType] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [notification, setNotification] = useState('');
  const [imageProcessing, setImageProcessing] = useState(false);
  const [processProgress, setProcessProgress] = useState(0);
  const [processMessage, setProcessMessage] = useState('');
  const [petData, setPetData] = useState({
    name: '',
    breed: '',
    age: '',
    weight: '',
    height: '',
    description: ''
  });

  // 顯示通知
  const showNotification = (msg) => {
    setNotification(msg);
  };

  // 隱藏通知
  const hideNotification = () => {
    setNotification('');
  };

  // 從翻譯檔案獲取品種列表
  const catBreeds = t('addPage.breeds.cat', { returnObjects: true });
  const dogBreeds = t('addPage.breeds.dog', { returnObjects: true });

  const handlePetTypeSelect = (type) => {
    setPetType(type);
    setPhase(2);
  };

  const handleBack = () => {
    if (phase === 2) {
      setPhase(1);
      setPetType('');
      setPetData({
        name: '',
        breed: '',
        age: '',
        weight: '',
        height: '',
        description: ''
      });
      setSelectedImage(null);
      setImagePreview('');
    } else {
      navigate('/pet');
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setPetData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleImageUpload = async (e) => {
    // 清理舊的預覽URL
    if (imagePreview) {
      revokeImagePreview(imagePreview);
    }

    setImageProcessing(true);
    setProcessProgress(0);
    setProcessMessage(t('addPage.imageProcessing.starting'));

    try {
      const result = await handleImageSelection(e, {
        compress: true,
        compressOptions: {
          maxWidth: 800,
          maxHeight: 800,
          quality: 0.8
        },
        validationOptions: {
          maxSize: 10 * 1024 * 1024 // 10MB for original file
        },
        onProgress: createProgressCallback(setProcessProgress, setProcessMessage)
      });

      if (result.success) {
        setSelectedImage(result.processedFile);
        setImagePreview(result.previewUrl);
      } else {
        showNotification(result.error);
      }
    } catch (error) {
      console.error('圖片處理失敗:', error);
      showNotification(t('addPage.imageProcessing.error'));
    } finally {
      setImageProcessing(false);
      setProcessProgress(0);
      setProcessMessage('');
    }
  };

  const handleSubmit = async () => {
    if (!petData.name || !petData.breed || !petData.age || !petData.weight || !petData.height) {
      showNotification(t('addPage.messages.requiredFields'));
      return;
    }

    setLoading(true);
    try {
      // 建立 FormData 物件
      const formData = new FormData();
      formData.append('pet_name', petData.name);
      formData.append('pet_type', petType);
      formData.append('breed', petData.breed);
      formData.append('age', parseFloat(petData.age));
      formData.append('weight', parseFloat(petData.weight));
      formData.append('height', parseFloat(petData.height));
      
      // 根據寵物類型和年齡設定正確的 pet_stage
      const age = parseFloat(petData.age);
      let petStage = 'adult'; // 預設為成年
      if (age < 1) {
        petStage = petType === 'cat' ? 'kitten' : 'puppy';
      }
      formData.append('pet_stage', petStage);
      
      formData.append('predicted_adult_weight', parseFloat(petData.weight));
      formData.append('description', petData.description || '');
      
      // 如果有選擇圖片，加入到 FormData
      if (selectedImage) {
        formData.append('headshot', selectedImage);
      }

      await petService.createPet(formData);
      showNotification(t('addPage.messages.addSuccess'));
      setTimeout(() => {
        navigate('/pet');
      }, 1500); // 顯示成功訊息後再導航
    } catch (error) {
      console.error('新增寵物失敗:', error);
      
      // 改善錯誤訊息顯示
      let errorMessage = t('addPage.messages.addError');
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.response?.data?.errors) {
        // 顯示具體的驗證錯誤
        const errors = error.response.data.errors;
        const errorFields = Object.keys(errors);
        if (errorFields.length > 0) {
          errorMessage = `${t('addPage.messages.validationError')}${errorFields.join(', ')}`;
        }
      }
      
      showNotification(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <NotificationProvider>
      <div className={styles.container}>
        <TopNavbar />
        {notification && (
          <Notification message={notification} onClose={hideNotification} />
        )}
        
        <div className={styles.content}>
        {phase === 1 ? (
          <div className={styles.phaseOne}>
            <h2 className={styles.title}>{t('addPage.phase1.title')}</h2>
            
            <div className={styles.petTypeSection}>
              <div className={styles.iconsAndDivider}>
                <div className={styles.petTypeIcons}>
                  <div className={styles.petIconWrapper}>
                    <img
                      src="/assets/icon/PetpageTypeCat.png"
                      alt={t('addPage.phase1.catAlt')}
                      className={styles.petIcon}
                    />
                  </div>
                  <div className={styles.petIconWrapper}>
                    <img
                      src="/assets/icon/PetpageTypeDog.png"
                      alt={t('addPage.phase1.dogAlt')}
                      className={styles.petIcon}
                    />
                  </div>
                </div>
                <div className={styles.dividerLine}></div>
              </div>
              
              <div className={styles.petTypeButtons}>
                <button
                  className={styles.petTypeButton}
                  onClick={() => handlePetTypeSelect('cat')}
                >
                  {t('addPage.phase1.catButton')}
                </button>
                <button
                  className={styles.petTypeButton}
                  onClick={() => handlePetTypeSelect('dog')}
                >
                  {t('addPage.phase1.dogButton')}
                </button>
              </div>
            </div>
            
          </div>
        ) : (
          <div className={styles.phaseTwo}>
            {/* 新的頂部區域：大頭貼左對齊，標題右對齊，底部對齊 */}
            <div className={styles.phaseTwoTopSection}>
              <div className={styles.avatarContainer}>
                <div className={styles.avatarSection}>
                  <div 
                    className={styles.avatarUpload}
                    onClick={() => !imageProcessing && fileInputRef.current?.click()}
                  >
                    {imageProcessing ? (
                      <div className={styles.processingIndicator}>
                        <div className={styles.progressBar}>
                          <div 
                            className={styles.progressFill} 
                            style={{ width: `${processProgress}%` }}
                          ></div>
                        </div>
                        <span className={styles.processMessage}>{processMessage}</span>
                      </div>
                    ) : imagePreview ? (
                      <img src={imagePreview} alt={t('addPage.phase2.avatarAlt')} />
                    ) : (
                      <span>{t('addPage.phase2.uploadAvatar')}</span>
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className={styles.hiddenInput}
                  />
                </div>
              </div>
              
              <div className={styles.titleContainer}>
                <h2 className={styles.title}>
                  {petType === 'cat' ? t('addPage.phase2.titleCat') : t('addPage.phase2.titleDog')}
                </h2>
              </div>
            </div>
            
            {/* 新增分隔線 */}
            <div className={styles.phaseTwoSeparator}></div>
            
            <div className={styles.formFields}>
              <div className={styles.formGroup}>
                <label>{t('addPage.phase2.labels.name')}</label>
                <input
                  type="text"
                  name="name"
                  value={petData.name}
                  onChange={handleInputChange}
                  placeholder={t('addPage.phase2.placeholders.name')}
                />
              </div>
              
              <div className={styles.formGroup}>
                <label>{t('addPage.phase2.labels.breed')}</label>
                <select
                  name="breed"
                  value={petData.breed}
                  onChange={handleInputChange}
                >
                  <option value="">{petType === 'cat' ? t('addPage.phase2.placeholders.breedCat') : t('addPage.phase2.placeholders.breedDog')}</option>
                  {(petType === 'cat' ? catBreeds : dogBreeds).map(breed => (
                    <option key={breed} value={breed}>{breed}</option>
                  ))}
                </select>
              </div>
              
              <div className={styles.formGroup}>
                <label>{t('addPage.phase2.labels.age')}</label>
                <input
                  type="number"
                  name="age"
                  value={petData.age}
                  onChange={handleInputChange}
                  placeholder={t('addPage.phase2.placeholders.age')}
                  min="0"
                  step="0.1"
                />
              </div>
              
              <div className={styles.formGroup}>
                <label>{t('addPage.phase2.labels.weight')}</label>
                <input
                  type="number"
                  name="weight"
                  value={petData.weight}
                  onChange={handleInputChange}
                  placeholder={t('addPage.phase2.placeholders.weight')}
                  min="0"
                  step="0.1"
                />
              </div>
              
              <div className={styles.formGroup}>
                <label>{t('addPage.phase2.labels.height')}</label>
                <input
                  type="number"
                  name="height"
                  value={petData.height}
                  onChange={handleInputChange}
                  placeholder={t('addPage.phase2.placeholders.height')}
                  min="0"
                  step="0.1"
                />
              </div>
            </div>

            <div className={styles.phaseTwoSeparator2}></div>
            
            <div className={styles.descriptionSection}>
              <textarea
                name="description"
                value={petData.description}
                onChange={handleInputChange}
                placeholder={t('addPage.phase2.placeholders.description')}
                rows="4"
              />
            </div>
            
            <div className={styles.actionButtons}>
              <button
                className={styles.backButton}
                onClick={handleBack}
                disabled={loading}
              >
                {t('addPage.phase2.buttons.back')}
              </button>
              <button
                className={styles.submitButton}
                onClick={handleSubmit}
                disabled={loading}
              >
                {loading ? t('addPage.phase2.buttons.processing') : t('addPage.phase2.buttons.submit')}
              </button>
            </div>
          </div>
        )}
      </div>
      
      <BottomNavbar />
      </div>
    </NotificationProvider>
  );
};

export default AddPetPage;