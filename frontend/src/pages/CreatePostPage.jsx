import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import TopNavbar from '../components/TopNavbar';
import BottomNavbar from '../components/BottomNavigationbar';
import Notification from '../components/Notification';
import ConfirmNotification from '../components/ConfirmNotification';
import ImageEditor from '../components/ImageEditor';
import { NotificationProvider } from '../context/NotificationContext';
import { useTutorial } from '../context/TutorialContext';
import styles from '../styles/CreatePostPage.module.css';

const CreatePostPage = () => {
  const { t } = useTranslation('posts');
  const navigate = useNavigate();
  const { isTutorialMode } = useTutorial();
  const fileInputRef = useRef(null);
  const imageContainerRef = useRef(null);
  const hashtagContainerRef = useRef(null);
  const [selectedImages, setSelectedImages] = useState([]);
  const [description, setDescription] = useState('');
  const [hashtags, setHashtags] = useState([]);
  const [hashtagInput, setHashtagInput] = useState('');
  const [notification, setNotification] = useState('');
  const [draftSaved, setDraftSaved] = useState(false);
  const [showImageEditor, setShowImageEditor] = useState(false);
  const [editingImage, setEditingImage] = useState(null);
  const [showConfirmNotification, setShowConfirmNotification] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState('');
  const [confirmAction, setConfirmAction] = useState(null);
  const [cancelAction, setCancelAction] = useState(null);

  // 草稿緩存的鍵名
  const DRAFT_KEY = 'createPostDraft';
  const ANNOTATIONS_KEY = 'imageAnnotations';

  // 轉換舊格式標註資料為新格式
  const convertLegacyAnnotation = (annotation) => {
    if (annotation.x_position !== undefined) {
      // 已經是新格式
      return annotation;
    }
    
    // 轉換舊格式為新格式
    return {
      id: annotation.id,
      x_position: annotation.x,
      y_position: annotation.y,
      imageId: annotation.imageId,
      display_name: annotation.displayName || '',
      target_id: annotation.targetId,
      target_type: annotation.targetType || 'user',
      created_by: annotation.created_by || null
    };
  };

  // 清除所有暫存資料
  const clearAllCachedData = () => {
    try {
      // 清除草稿資料
      localStorage.removeItem(DRAFT_KEY);
      console.log('✅ 已清除草稿資料');
      
      // 清除圖片標註資料
      localStorage.removeItem(ANNOTATIONS_KEY);
      console.log('✅ 已清除圖片標註資料');
      
      // 清除其他可能的暫存資料
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        // 清除與當前貼文相關的暫存資料
        if (key && (key.includes('postDraft') || key.includes('imageAnnotations') || key.includes('annotationTemp'))) {
          keysToRemove.push(key);
        }
      }
      
      keysToRemove.forEach(key => {
        localStorage.removeItem(key);
        console.log(`✅ 已清除暫存資料: ${key}`);
      });
      
      console.log('🧹 所有暫存資料清理完成');
      
    } catch (error) {
      console.error('❌ 清除暫存資料失敗:', error);
    }
  };

  // 載入草稿
  const loadDraft = async () => {
    try {
      const savedDraft = localStorage.getItem(DRAFT_KEY);
      if (savedDraft) {
        const draft = JSON.parse(savedDraft);
        
        // 載入文字資料
        if (draft.description) setDescription(draft.description);
        if (draft.hashtags && Array.isArray(draft.hashtags)) setHashtags(draft.hashtags);
        
        // 載入圖片資料（重新創建 blob URLs）
        if (draft.images && Array.isArray(draft.images) && draft.images.length > 0) {
          try {
            const imagePromises = draft.images.map(async (imageData) => {
              try {
                // 驗證資料完整性
                if (!imageData.dataUrl || !imageData.id) {
                  console.warn('圖片資料不完整:', imageData);
                  return null;
                }
                
                // 從 base64 重新創建 File 物件
                const response = await fetch(imageData.dataUrl);
                const blob = await response.blob();
                
                // 驗證 blob 大小
                if (blob.size === 0) {
                  console.warn('圖片 blob 為空:', imageData.name);
                  return null;
                }
                
                const file = new File([blob], imageData.name || 'image.jpg', { 
                  type: imageData.type || 'image/jpeg' 
                });
                
                return {
                  file,
                  preview: imageData.dataUrl, // 直接使用 base64
                  dataUrl: imageData.dataUrl, // 保留 dataUrl
                  id: imageData.id,
                  annotations: (imageData.annotations || []).map(convertLegacyAnnotation) // 轉換並保留標註資料
                };
              } catch (error) {
                console.error('載入單張圖片失敗:', imageData.name, error);
                return null;
              }
            });
            
            const images = await Promise.all(imagePromises);
            const validImages = images.filter(img => img !== null);
            
            if (validImages.length > 0) {
              setSelectedImages(validImages);
            } else if (draft.images.length > 0) {
              showNotification(t('createPost.messages.loadImagesFailed'));
            }
          } catch (error) {
            console.error('載入圖片過程出錯:', error);
            showNotification(t('createPost.messages.loadImagesError'));
          }
        }
      }
    } catch (error) {
      console.error('載入草稿失敗:', error);
      showNotification(t('createPost.messages.loadDraftError'));
      // 如果草稿損壞，清除它
      try {
        localStorage.removeItem(DRAFT_KEY);
      } catch (e) {
        console.error('清除損壞草稿失敗:', e);
      }
    }
  };

  // 保存草稿
  const saveDraft = async () => {
    // 教學模式時不儲存草稿
    if (isTutorialMode) {
      console.log('[CreatePostPage] 教學模式 - 跳過儲存草稿');
      return;
    }
    try {
      // 使用 FileReader 轉換圖片為 base64（如果檔案太大則壓縮）
      const imageDataPromises = selectedImages.map(async (image) => {
        try {
          // 如果圖片超過 1MB，嘗試壓縮
          if (image.file.size > 1 * 1024 * 1024) {
            return new Promise((resolve) => {
              const canvas = document.createElement('canvas');
              const ctx = canvas.getContext('2d');
              const img = new Image();
              
              img.onload = () => {
                // 計算壓縮後的尺寸
                const maxWidth = 800;
                const maxHeight = 800;
                let { width, height } = img;
                
                if (width > maxWidth || height > maxHeight) {
                  const ratio = Math.min(maxWidth / width, maxHeight / height);
                  width *= ratio;
                  height *= ratio;
                }
                
                canvas.width = width;
                canvas.height = height;
                ctx.drawImage(img, 0, 0, width, height);
                
                const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.7);
                resolve({
                  id: image.id,
                  name: image.file.name,
                  type: 'image/jpeg',
                  size: image.file.size,
                  dataUrl: compressedDataUrl,
                  compressed: true,
                  annotations: (image.annotations || []).map(convertLegacyAnnotation) // 轉換並保留標註資料
                });
              };
              
              img.onerror = () => {
                console.error('壓縮圖片失敗:', image.file.name);
                resolve(null);
              };
              
              img.src = image.preview;
            });
          } else {
            // 小圖片直接保存
            return new Promise((resolve) => {
              const reader = new FileReader();
              reader.onload = (e) => {
                resolve({
                  id: image.id,
                  name: image.file.name,
                  type: image.file.type,
                  size: image.file.size,
                  dataUrl: e.target.result,
                  compressed: false,
                  annotations: (image.annotations || []).map(convertLegacyAnnotation) // 轉換並保留標註資料
                });
              };
              reader.onerror = () => {
                console.error('讀取圖片失敗:', image.file.name);
                resolve(null);
              };
              reader.readAsDataURL(image.file);
            });
          }
        } catch (error) {
          console.error('轉換圖片失敗:', error);
          return null;
        }
      });

      const imageData = await Promise.all(imageDataPromises);
      const validImageData = imageData.filter(data => data !== null);

      const draft = {
        description,
        hashtags,
        images: validImageData,
        timestamp: Date.now()
      };

      // 檢查草稿大小並採取適當策略
      let finalDraft = draft;
      let draftString = JSON.stringify(finalDraft);
      
      // 如果草稿太大，逐步降級
      if (draftString.length > 5 * 1024 * 1024) { // 超過 5MB
        // 嘗試只保存前3張圖片
        if (validImageData.length > 3) {
          finalDraft = {
            ...draft,
            images: validImageData.slice(0, 3)
          };
          draftString = JSON.stringify(finalDraft);
          showNotification(t('createPost.messages.draftTooLarge'));
        }
        
        // 如果還是太大，只保存文字
        if (draftString.length > 5 * 1024 * 1024) {
          finalDraft = {
            description,
            hashtags,
            images: [],
            timestamp: Date.now()
          };
          draftString = JSON.stringify(finalDraft);
          showNotification(t('createPost.messages.draftTooLarge'));
        }
      }
      
      localStorage.setItem(DRAFT_KEY, draftString);
      
      setDraftSaved(true);
      
      // 3秒後隱藏保存提示
      setTimeout(() => {
        setDraftSaved(false);
      }, 3000);
    } catch (error) {
      console.error('保存草稿失敗:', error);
      if (error.name === 'QuotaExceededError') {
        showNotification(t('createPost.messages.storageQuotaExceeded'));
        // 嘗試只保存文字內容
        try {
          const textOnlyDraft = {
            description,
            hashtags,
            images: [],
            timestamp: Date.now()
          };
          localStorage.setItem(DRAFT_KEY, JSON.stringify(textOnlyDraft));
        } catch (e) {
          console.error('無法保存草稿:', e);
        }
      }
    }
  };

  // 清除草稿
  const clearDraft = () => {
    clearAllCachedData();
  };

  // 顯示通知
  const showNotification = (msg) => {
    setNotification(msg);
  };

  // 隱藏通知
  const hideNotification = () => {
    setNotification('');
  };

  // 顯示確認通知
  const showConfirmDialog = (message, onConfirm, onCancel = null) => {
    setConfirmMessage(message);
    setConfirmAction(() => onConfirm);
    setCancelAction(() => onCancel);
    setShowConfirmNotification(true);
  };

  // 處理確認通知的確認按鈕
  const handleConfirmAction = () => {
    if (confirmAction) {
      confirmAction();
    }
    setShowConfirmNotification(false);
    setConfirmAction(null);
    setCancelAction(null);
  };

  // 處理確認通知的取消按鈕
  const handleCancelAction = () => {
    if (cancelAction) {
      cancelAction();
    }
    setShowConfirmNotification(false);
    setConfirmAction(null);
    setCancelAction(null);
  };

  // 處理圖片選擇
  const handleImageSelect = (e) => {
    const files = Array.from(e.target.files);
    
    if (selectedImages.length + files.length > 10) {
      showNotification(t('createPost.messages.maxImagesReached'));
      return;
    }

    // 檢查每個檔案
    for (let file of files) {
      if (file.size > 5 * 1024 * 1024) {
        showNotification(t('createPost.messages.imageTooLarge'));
        return;
      }
      
      if (!file.type.startsWith('image/')) {
        showNotification(t('createPost.messages.invalidFileType'));
        return;
      }
    }

    // 創建預覽圖片（使用 base64）
    const newImagePromises = files.map(file => {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          resolve({
            file,
            preview: e.target.result, // 使用 base64
            dataUrl: e.target.result, // 保留 dataUrl
            id: Date.now() + Math.random()
          });
        };
        reader.onerror = () => {
          console.error('讀取圖片失敗:', file.name);
          resolve(null);
        };
        reader.readAsDataURL(file);
      });
    });

    Promise.all(newImagePromises).then(newImages => {
      const validImages = newImages.filter(img => img !== null);
      setSelectedImages(prev => [...prev, ...validImages]);
    });
  };

  // 移除圖片
  const handleRemoveImage = (imageId) => {
    setSelectedImages(prev => {
      return prev.filter(img => img.id !== imageId);
      // base64 dataUrl 不需要手動清理
    });
  };

  // 新增圖片按鈕點擊
  const handleAddImage = () => {
    if (selectedImages.length >= 10) {
      showNotification(t('createPost.messages.maxImagesReached'));
      return;
    }
    fileInputRef.current?.click();
  };

  // 新增 hashtag
  const handleAddHashtag = () => {
    const tagText = hashtagInput.trim();
    
    if (!tagText) {
      showNotification(t('createPost.messages.enterHashtagContent'));
      return;
    }
    
    if (hashtags.some(tag => {
      const existingTagText = tag.tag || tag.text || (typeof tag === 'string' ? tag : '');
      return existingTagText === tagText;
    })) {
      showNotification(t('createPost.messages.hashtagExists'));
      return;
    }
    
    if (hashtags.length >= 10) {
      showNotification(t('createPost.messages.maxHashtagsReached'));
      return;
    }
    
    const newHashtag = {
      id: Date.now() + Math.random(),
      text: tagText
    };
    
    setHashtags(prev => [...prev, newHashtag]);
    setHashtagInput('');
  };

  // 移除 hashtag
  const handleRemoveHashtag = (tagId) => {
    setHashtags(prev => prev.filter(tag => tag.id !== tagId));
  };

  // 處理 hashtag 輸入框 Enter 鍵
  const handleHashtagKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddHashtag();
    }
  };

  // 處理圖片點擊 - 開啟圖片編輯器
  const handleImageClick = (image) => {
    // 確保傳遞包含標註的完整圖片對象
    const imageWithAnnotations = selectedImages.find(img => img.id === image.id) || image;
    setEditingImage(imageWithAnnotations);
    setShowImageEditor(true);
  };

  // 處理圖片編輯保存
  const handleImageEditSave = (editedImage) => {
    // 更新圖片的標註資料
    setSelectedImages(prev => 
      prev.map(img => 
        img.id === editingImage.id 
          ? { ...img, annotations: editedImage.annotations || [] }
          : img
      )
    );
    setShowImageEditor(false);
    setEditingImage(null);
  };

  // 關閉圖片編輯器
  const handleImageEditClose = () => {
    setShowImageEditor(false);
    setEditingImage(null);
  };

  // 取消按鈕
  const handleCancel = async () => {
    const hasContent = selectedImages.length > 0 || description.trim() || hashtags.length > 0;
    
    if (hasContent) {
      // 直接保存草稿並返回
      try {
        await saveDraft();
      } catch (error) {
        console.error('保存草稿失敗:', error);
      }
    }
    navigate(-1);
  };

  // 下一步按鈕
  const handleNext = async () => {
    if (selectedImages.length === 0 && !description.trim()) {
      showNotification(t('createPost.messages.requireContent'));
      return;
    }
    
    // 保存草稿
    await saveDraft();
    
    // 準備貼文資料（使用 dataUrl）
    const postData = {
      images: selectedImages.map(img => ({
        id: img.id,
        dataUrl: img.dataUrl || img.preview, // 使用 dataUrl
        name: img.file.name,
        type: img.file.type,
        annotations: img.annotations || [] // 包含標註資料
      })),
      description: description,
      hashtags: hashtags
    };
    
    // 導航到預覽頁面，並傳遞資料
    navigate('/create-post-preview', { state: postData });
  };

  // 組件載入時載入草稿
  React.useEffect(() => {
    loadDraft();
  }, []);

  // 自動保存草稿（當內容變化時）
  React.useEffect(() => {
    const timeoutId = setTimeout(async () => {
      if (selectedImages.length > 0 || description.trim() || hashtags.length > 0) {
        try {
          await saveDraft();
        } catch (error) {
          console.error('自動保存失敗:', error);
          // 靜默失敗，不打擾用戶
        }
      }
    }, 2000); // 延遲2秒保存，避免頻繁保存

    return () => clearTimeout(timeoutId);
  }, [selectedImages, description, hashtags]);

  // 組件卸載時的清理（由於使用 base64，不需要清理 blob URL）
  React.useEffect(() => {
    return () => {
      // base64 dataUrl 不需要手動清理
      console.log('CreatePostPage 組件卸載');
    };
  }, []);

  // 處理滑鼠滾輪橫向滾動 - 圖片容器
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

  // 處理滑鼠滾輪橫向滾動 - hashtag 容器
  React.useEffect(() => {
    const container = hashtagContainerRef.current;
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
  }, [hashtags]);

  return (
    <NotificationProvider>
      <div className={styles.container}>
        <TopNavbar />
        {notification && (
          <Notification message={notification} onClose={hideNotification} />
        )}
        
        {showConfirmNotification && (
          <ConfirmNotification 
            message={confirmMessage}
            onConfirm={handleConfirmAction}
            onCancel={handleCancelAction}
          />
        )}
        
        <div className={styles.content}>
          <div className={styles.titleSection}>
            <h2 className={styles.title}>{t('createPost.title')}</h2>
            {draftSaved && (
              <span className={styles.draftIndicator}>{t('common.draftSaved')}</span>
            )}
          </div>
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
                <p className={styles.noImageText}>{t('createPost.imageUpload.noImageSelected')}</p>
              </div>
            ) : (
              // 有圖片時顯示預覽
              <div ref={imageContainerRef} className={styles.imagePreviewContainer}>
                {selectedImages.map((image) => (
                  <div key={image.id} className={styles.imagePreview}>
                    <img 
                      src={image.preview} 
                      alt="預覽" 
                      onClick={() => handleImageClick(image)}
                      className={styles.clickableImage}
                    />
                    <button 
                      className={styles.removeImageBtn}
                      onClick={() => handleRemoveImage(image.id)}
                    >
                      X
                    </button>
                    {/* 標註指示器 */}
                    {image.annotations && image.annotations.length > 0 && (
                      <div className={styles.annotationIndicator}>
                        {image.annotations.length}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            
            <div className={styles.imageControls}>
              <button
                className={styles.addImageBtn}
                onClick={handleAddImage}
              >
                {t('createPost.imageUpload.addImage')}
              </button>
              <span className={styles.imageCounter}>
                {t('createPost.imageUpload.imageCounter', { count: selectedImages.length })}
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
              placeholder={t('createPost.placeholders.description')}
              className={styles.descriptionInput}
              rows="4"
            />
          </div>

          {/* Hashtag 區域 */}
          <div className={styles.hashtagSection}>
            
            {/* 已新增的 hashtag 顯示區域 */}
            {hashtags.length > 0 && (
              <div ref={hashtagContainerRef} className={styles.hashtagPreviewContainer}>
                {hashtags.map((tag, index) => (
                  <div key={tag.id || index} className={styles.hashtagPreview}>
                    <span className={styles.hashtagText}># {tag.tag || tag.text || (typeof tag === 'string' ? tag : '')}</span>
                    <button 
                      className={styles.removeHashtagBtn}
                      onClick={() => handleRemoveHashtag(tag.id || index)}
                    >
                      X
                    </button>
                  </div>
                ))}
              </div>
            )}
            
            {/* Hashtag 輸入區域 */}
            <div className={styles.hashtagInputSection}>
              <div className={styles.hashtagInputContainer}>
                <span className={styles.hashSymbol}>#</span>
                <input
                  type="text"
                  value={hashtagInput}
                  onChange={(e) => setHashtagInput(e.target.value)}
                  onKeyDown={handleHashtagKeyDown}
                  placeholder={t('createPost.placeholders.hashtag')}
                  className={styles.hashtagInput}
                />
              </div>
              <button
                className={styles.addHashtagBtn}
                onClick={handleAddHashtag}
              >
                {t('common.add')}
              </button>
            </div>
            
            <span className={styles.hashtagCounter}>
              {t('createPost.hashtags.counter', { count: hashtags.length })}
            </span>
          </div>

          {/* 操作按鈕 */}
          <div className={styles.actionButtons}>
            <button 
              className={styles.cancelButton}
              onClick={handleCancel}
            >
              {t('common.cancel')}
            </button>
            <button 
              className={styles.nextButton}
              onClick={handleNext}
            >
              {t('common.next')}
            </button>
          </div>
        </div>

        {/* 圖片編輯器 */}
        <ImageEditor
          image={editingImage}
          isOpen={showImageEditor}
          onClose={handleImageEditClose}
          onSave={handleImageEditSave}
        />
        
        <BottomNavbar />
      </div>
    </NotificationProvider>
  );
};

export default CreatePostPage; 