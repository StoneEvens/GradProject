import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from '../styles/AddPetPage.module.css';
import TopNavbar from '../components/TopNavbar';
import BottomNavbar from '../components/BottomNavigationbar';
import Notification from '../components/Notification';
import { NotificationProvider } from '../context/NotificationContext';
import petService from '../services/petService';
import { handleImageSelection, revokeImagePreview, createProgressCallback } from '../utils/imageUtils';

const AddPetPage = () => {
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

  const catBreeds = [
    '米克斯貓', '美國短毛貓', '英國短毛貓', '蘇格蘭摺耳貓', '布偶貓',
    '暹羅貓', '波斯貓', '孟加拉貓', '緬因貓', '異國短毛貓', '其他'
  ];

  const dogBreeds = [
    '米克斯犬', '柴犬', '貴賓犬', '黃金獵犬', '拉布拉多', '哈士奇',
    '法國鬥牛犬', '博美犬', '約克夏', '馬爾濟斯', '其他'
  ];

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
    setProcessMessage('開始處理...');

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
      showNotification('圖片處理失敗，請重試');
    } finally {
      setImageProcessing(false);
      setProcessProgress(0);
      setProcessMessage('');
    }
  };

  const handleSubmit = async () => {
    if (!petData.name || !petData.breed || !petData.age || !petData.weight || !petData.height) {
      showNotification('請填寫所有必填欄位');
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
      showNotification('新增寵物成功！');
      setTimeout(() => {
        navigate('/pet');
      }, 1500); // 顯示成功訊息後再導航
    } catch (error) {
      console.error('新增寵物失敗:', error);
      
      // 改善錯誤訊息顯示
      let errorMessage = '新增寵物失敗，請稍後再試';
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.response?.data?.errors) {
        // 顯示具體的驗證錯誤
        const errors = error.response.data.errors;
        const errorFields = Object.keys(errors);
        if (errorFields.length > 0) {
          errorMessage = `資料驗證錯誤：${errorFields.join(', ')}`;
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
            <h2 className={styles.title}>我的寵物是...</h2>
            
            <div className={styles.petTypeSection}>
              <div className={styles.iconsAndDivider}>
                <div className={styles.petTypeIcons}>
                  <div className={styles.petIconWrapper}>
                    <img 
                      src="/assets/icon/PetpageTypeCat.png" 
                      alt="貓" 
                      className={styles.petIcon}
                    />
                  </div>
                  <div className={styles.petIconWrapper}>
                    <img 
                      src="/assets/icon/PetpageTypeDog.png" 
                      alt="狗" 
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
                  貓
                </button>
                <button 
                  className={styles.petTypeButton}
                  onClick={() => handlePetTypeSelect('dog')}
                >
                  狗
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
                      <img src={imagePreview} alt="寵物大頭照" />
                    ) : (
                      <span>上傳大頭照</span>
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
                  {petType === 'cat' ? '貓咪' : '狗狗'}基本資料
                </h2>
              </div>
            </div>
            
            {/* 新增分隔線 */}
            <div className={styles.phaseTwoSeparator}></div>
            
            <div className={styles.formFields}>
              <div className={styles.formGroup}>
                <label>名字</label>
                <input
                  type="text"
                  name="name"
                  value={petData.name}
                  onChange={handleInputChange}
                  placeholder="請輸入寵物名字"
                />
              </div>
              
              <div className={styles.formGroup}>
                <label>品種</label>
                <select
                  name="breed"
                  value={petData.breed}
                  onChange={handleInputChange}
                >
                  <option value="">選擇{petType === 'cat' ? '貓' : '狗'}</option>
                  {(petType === 'cat' ? catBreeds : dogBreeds).map(breed => (
                    <option key={breed} value={breed}>{breed}</option>
                  ))}
                </select>
              </div>
              
              <div className={styles.formGroup}>
                <label>年齡</label>
                <input
                  type="number"
                  name="age"
                  value={petData.age}
                  onChange={handleInputChange}
                  placeholder="請輸入年齡（歲）"
                  min="0"
                  step="0.1"
                />
              </div>
              
              <div className={styles.formGroup}>
                <label>體重</label>
                <input
                  type="number"
                  name="weight"
                  value={petData.weight}
                  onChange={handleInputChange}
                  placeholder="請輸入體重（公斤）"
                  min="0"
                  step="0.1"
                />
              </div>
              
              <div className={styles.formGroup}>
                <label>身高</label>
                <input
                  type="number"
                  name="height"
                  value={petData.height}
                  onChange={handleInputChange}
                  placeholder="請輸入身高（公分）"
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
                placeholder="請簡單介紹你的寵物"
                rows="4"
              />
            </div>
            
            <div className={styles.actionButtons}>
              <button 
                className={styles.backButton} 
                onClick={handleBack}
                disabled={loading}
              >
                返回
              </button>
              <button 
                className={styles.submitButton} 
                onClick={handleSubmit}
                disabled={loading}
              >
                {loading ? '處理中...' : '完成'}
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