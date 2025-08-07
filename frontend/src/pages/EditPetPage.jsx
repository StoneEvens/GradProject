import { useState, useRef, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import styles from '../styles/EditPetPage.module.css';
import TopNavbar from '../components/TopNavbar';
import BottomNavbar from '../components/BottomNavigationbar';
import Notification from '../components/Notification';
import { NotificationProvider } from '../context/NotificationContext';
import petService from '../services/petService';
import { handleImageSelection, revokeImagePreview, createProgressCallback } from '../utils/imageUtils';

const EditPetPage = () => {
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

  const catBreeds = [
    '米克斯貓', '美國短毛貓', '英國短毛貓', '蘇格蘭摺耳貓', '布偶貓',
    '暹羅貓', '波斯貓', '孟加拉貓', '緬因貓', '異國短毛貓', '其他'
  ];

  const dogBreeds = [
    '米克斯犬', '柴犬', '貴賓犬', '黃金獵犬', '拉布拉多', '哈士奇',
    '法國鬥牛犬', '博美犬', '約克夏', '馬爾濟斯', '其他'
  ];

  // 載入寵物資料
  useEffect(() => {
    const loadPetData = async () => {
      try {
        setPageLoading(true);
        const pets = await petService.getUserPets();
        const currentPet = pets.find(pet => pet.pet_id.toString() === petId);
        
        if (!currentPet) {
          showNotification('找不到寵物資料');
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
        console.error('載入寵物資料失敗:', error);
        showNotification('載入寵物資料失敗');
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
      console.error('圖片處理失敗:', error);
      showNotification('圖片處理失敗，請重試');
    }
  };

  const handleSubmit = async () => {
    if (!petData.name || !petData.breed || !petData.age || !petData.weight || !petData.height) {
      showNotification('請填寫所有必填欄位');
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
      showNotification('更新寵物資料成功！');
      setTimeout(() => {
        navigate('/pet');
      }, 1500);
    } catch (error) {
      console.error('更新寵物失敗:', error);
      
      let errorMessage = '更新寵物失敗，請稍後再試';
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.response?.data?.errors) {
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

  if (pageLoading) {
    return (
      <NotificationProvider>
        <div className={styles.container}>
          <TopNavbar />
          <div className={styles.loadingContainer}>載入中...</div>
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
                  編輯{petData.type === 'cat' ? '貓咪' : '狗狗'}資料
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
                  <option value="">選擇{petData.type === 'cat' ? '貓' : '狗'}品種</option>
                  {(petData.type === 'cat' ? catBreeds : dogBreeds).map(breed => (
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
                {loading ? '處理中...' : '儲存'}
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