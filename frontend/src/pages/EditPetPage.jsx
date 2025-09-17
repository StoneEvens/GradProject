import { useState, useRef, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import styles from '../styles/EditPetPage.module.css';
import TopNavbar from '../components/TopNavbar';
import BottomNavbar from '../components/BottomNavigationbar';
import Notification from '../components/Notification';
import { NotificationProvider } from '../context/NotificationContext';
import petService from '../services/petService';
import { handleImageSelection, revokeImagePreview, createProgressCallback } from '../utils/imageUtils';

const EditPetPage = () => {
  const { t } = useTranslation('pet');
  const navigate = useNavigate();
  const { petId } = useParams();
  const fileInputRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [notification, setNotification] = useState('');
  const [petData, setPetData] = useState({
    name: '',
    type: '',
    breed: '',
    age: '',
    weight: '',
    height: '',
    description: '',
    originalAvatarUrl: ''
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

  // 載入寵物資料
  useEffect(() => {
    const loadPetData = async () => {
      try {
        setPageLoading(true);
        const pets = await petService.getUserPets();
        const currentPet = pets.find(pet => pet.pet_id.toString() === petId);
        
        if (!currentPet) {
          showNotification(t('editPage.messages.petNotFound'));
          navigate('/pet');
          return;
        }

        setPetData({
          name: currentPet.pet_name || '',
          type: currentPet.pet_type || '',
          breed: currentPet.breed || '',
          age: currentPet.age?.toString() || '',
          weight: currentPet.weight?.toString() || '',
          height: currentPet.height?.toString() || '',
          description: currentPet.description || '',
          originalAvatarUrl: currentPet.headshot_url || ''
        });

        // 設定大頭照預覽
        if (currentPet.headshot_url) {
          setImagePreview(currentPet.headshot_url);
        }

      } catch (error) {
        console.error('Load pet data failed:', error);
        showNotification(t('editPage.messages.loadError'));
        navigate('/pet');
      } finally {
        setPageLoading(false);
      }
    };

    if (petId) {
      loadPetData();
    }
  }, [petId, navigate]);

  const handleBack = () => {
    navigate('/pet');
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
    if (imagePreview && imagePreview.startsWith('blob:')) {
      revokeImagePreview(imagePreview);
    }

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
        }
      });

      if (result.success) {
        setSelectedImage(result.processedFile);
        setImagePreview(result.previewUrl);
      } else {
        showNotification(result.error);
      }
    } catch (error) {
      console.error('Image processing failed:', error);
      showNotification(t('editPage.messages.imageProcessError'));
    }
  };

  const handleSubmit = async () => {
    if (!petData.name || !petData.breed || !petData.age || !petData.weight || !petData.height) {
      showNotification(t('editPage.messages.requiredFields'));
      return;
    }

    setLoading(true);
    try {
      // 準備更新資料
      const updateData = {
        pet_name: petData.name,
        pet_type: petData.type,
        breed: petData.breed,
        age: parseFloat(petData.age),
        weight: parseFloat(petData.weight),
        height: parseFloat(petData.height),
        description: petData.description
      };

      // 計算寵物階段
      const age = parseFloat(petData.age);
      let petStage = 'adult';
      if (age < 1) {
        petStage = petData.type === 'cat' ? 'kitten' : 'puppy';
      }
      updateData.pet_stage = petStage;
      updateData.predicted_adult_weight = parseFloat(petData.weight);

      // 如果有選擇新圖片，加入到更新資料
      if (selectedImage) {
        updateData.headshot = selectedImage;
      }

      await petService.updatePet(petId, updateData);
      showNotification(t('editPage.messages.updateSuccess'));
      setTimeout(() => {
        navigate('/pet');
      }, 1500);
    } catch (error) {
      console.error('Update pet failed:', error);
      
      let errorMessage = t('editPage.messages.updateError');
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.response?.data?.errors) {
        const errors = error.response.data.errors;
        const errorFields = Object.keys(errors);
        if (errorFields.length > 0) {
          errorMessage = `${t('editPage.messages.validationError')}${errorFields.join(', ')}`;
        }
      }
      
      showNotification(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (pageLoading) {
    return (
      <NotificationProvider>
        <div className={styles.container}>
          <TopNavbar />
          <div className={styles.loadingContainer}>{t('editPage.loading')}</div>
          <BottomNavbar />
        </div>
      </NotificationProvider>
    );
  }

  return (
    <NotificationProvider>
      <div className={styles.container}>
        <TopNavbar />
        {notification && (
          <Notification message={notification} onClose={hideNotification} />
        )}
        
        <div className={styles.content}>
          <div className={styles.phaseTwo}>
            {/* 新的頂部區域：大頭貼左對齊，標題右對齊，底部對齊 */}
            <div className={styles.phaseTwoTopSection}>
              <div className={styles.avatarContainer}>
                <div className={styles.avatarSection}>
                  <div 
                    className={styles.avatarUpload}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {imagePreview ? (
                      <img src={imagePreview} alt={t('editPage.avatarAlt')} />
                    ) : (
                      <span>{t('editPage.uploadAvatar')}</span>
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
                  {petData.type === 'cat' ? t('editPage.titleCat') : t('editPage.titleDog')}
                </h2>
              </div>
            </div>
            
            {/* 新增分隔線 */}
            <div className={styles.phaseTwoSeparator}></div>
            
            <div className={styles.formFields}>
              <div className={styles.formGroup}>
                <label>{t('editPage.labels.name')}</label>
                <input
                  type="text"
                  name="name"
                  value={petData.name}
                  onChange={handleInputChange}
                  placeholder={t('editPage.placeholders.name')}
                />
              </div>
              
              <div className={styles.formGroup}>
                <label>{t('editPage.labels.breed')}</label>
                <select
                  name="breed"
                  value={petData.breed}
                  onChange={handleInputChange}
                >
                  <option value="">{petData.type === 'cat' ? t('editPage.placeholders.breedCat') : t('editPage.placeholders.breedDog')}</option>
                  {(petData.type === 'cat' ? catBreeds : dogBreeds).map(breed => (
                    <option key={breed} value={breed}>{breed}</option>
                  ))}
                </select>
              </div>
              
              <div className={styles.formGroup}>
                <label>{t('editPage.labels.age')}</label>
                <input
                  type="number"
                  name="age"
                  value={petData.age}
                  onChange={handleInputChange}
                  placeholder={t('editPage.placeholders.age')}
                  min="0"
                  step="0.1"
                />
              </div>
              
              <div className={styles.formGroup}>
                <label>{t('editPage.labels.weight')}</label>
                <input
                  type="number"
                  name="weight"
                  value={petData.weight}
                  onChange={handleInputChange}
                  placeholder={t('editPage.placeholders.weight')}
                  min="0"
                  step="0.1"
                />
              </div>
              
              <div className={styles.formGroup}>
                <label>{t('editPage.labels.height')}</label>
                <input
                  type="number"
                  name="height"
                  value={petData.height}
                  onChange={handleInputChange}
                  placeholder={t('editPage.placeholders.height')}
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
                placeholder={t('editPage.placeholders.description')}
                rows="4"
              />
            </div>
            
            <div className={styles.actionButtons}>
              <button
                className={styles.backButton}
                onClick={handleBack}
                disabled={loading}
              >
                {t('editPage.buttons.back')}
              </button>
              <button
                className={styles.submitButton}
                onClick={handleSubmit}
                disabled={loading}
              >
                {loading ? t('editPage.buttons.processing') : t('editPage.buttons.save')}
              </button>
            </div>
          </div>
        </div>
        
        <BottomNavbar />
      </div>
    </NotificationProvider>
  );
};

export default EditPetPage; 