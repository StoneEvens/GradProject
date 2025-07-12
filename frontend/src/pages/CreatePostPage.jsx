import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import TopNavbar from '../components/TopNavbar';
import BottomNavbar from '../components/BottomNavigationbar';
import Notification from '../components/Notification';
import { NotificationProvider } from '../context/NotificationContext';
import styles from '../styles/CreatePostPage.module.css';

const CreatePostPage = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const imageContainerRef = useRef(null);
  const [selectedImages, setSelectedImages] = useState([]);
  const [description, setDescription] = useState('');
  const [notification, setNotification] = useState('');

  // 顯示通知
  const showNotification = (msg) => {
    setNotification(msg);
  };

  // 隱藏通知
  const hideNotification = () => {
    setNotification('');
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
    const newImages = files.map(file => ({
      file,
      preview: URL.createObjectURL(file),
      id: Date.now() + Math.random()
    }));

    setSelectedImages(prev => [...prev, ...newImages]);
  };

  // 移除圖片
  const handleRemoveImage = (imageId) => {
    setSelectedImages(prev => {
      const updated = prev.filter(img => img.id !== imageId);
      // 清理 URL
      const removedImage = prev.find(img => img.id === imageId);
      if (removedImage) {
        URL.revokeObjectURL(removedImage.preview);
      }
      return updated;
    });
  };

  // 新增圖片按鈕點擊
  const handleAddImage = () => {
    if (selectedImages.length >= 10) {
      showNotification('最多只能選擇10張圖片');
      return;
    }
    fileInputRef.current?.click();
  };

  // 取消按鈕
  const handleCancel = () => {
    // 清理所有預覽URL
    selectedImages.forEach(img => URL.revokeObjectURL(img.preview));
    navigate(-1); // 返回上一頁
  };

  // 下一步按鈕
  const handleNext = () => {
    if (selectedImages.length === 0 && !description.trim()) {
      showNotification('請至少選擇一張圖片或輸入描述');
      return;
    }
    
    // TODO: 這裡可以將資料傳遞到下一階段或提交到後端
    showNotification('功能開發中...');
  };

  // 清理 URL 當組件卸載時
  React.useEffect(() => {
    return () => {
      selectedImages.forEach(img => URL.revokeObjectURL(img.preview));
    };
  }, []);

  // 處理滑鼠滾輪橫向滾動
  React.useEffect(() => {
    const container = imageContainerRef.current;
    if (!container) return;

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
  }, [selectedImages]);

  return (
    <NotificationProvider>
      <div className={styles.container}>
        <TopNavbar />
        {notification && (
          <Notification message={notification} onClose={hideNotification} />
        )}
        
        <div className={styles.content}>
          <h2 className={styles.title}>發布日常貼文</h2>
          <div className={styles.divider}></div>
          {/* 圖片上傳區域 */}
          <div className={styles.imageSection}>
            {selectedImages.length === 0 ? (
              // 沒有圖片時顯示警告圖標
              <div className={styles.noImageState}>
                <img 
                  src="/assets/icon/RegisterPage_NotCheckIcon.png" 
                  alt="未選擇圖片" 
                  className={styles.warningIcon}
                />
                <p className={styles.noImageText}>還沒有新增任何圖片</p>
              </div>
            ) : (
              // 有圖片時顯示預覽
              <div ref={imageContainerRef} className={styles.imagePreviewContainer}>
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

          {/* 描述輸入區域 */}
          <div className={styles.descriptionSection}>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="輸入描述"
              className={styles.descriptionInput}
              rows="4"
            />
          </div>

          {/* 操作按鈕 */}
          <div className={styles.actionButtons}>
            <button 
              className={styles.cancelButton}
              onClick={handleCancel}
            >
              取消
            </button>
            <button 
              className={styles.nextButton}
              onClick={handleNext}
            >
              下一步
            </button>
          </div>
        </div>
        
        <BottomNavbar />
      </div>
    </NotificationProvider>
  );
};

export default CreatePostPage; 