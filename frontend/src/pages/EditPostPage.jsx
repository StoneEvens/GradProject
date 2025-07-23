import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import TopNavbar from '../components/TopNavbar';
import BottomNavbar from '../components/BottomNavigationbar';
import Notification from '../components/Notification';
import Annotation from '../components/Annotation';
import ImageEditor from '../components/ImageEditor';
import ConfirmNotification from '../components/ConfirmNotification';
import { NotificationProvider } from '../context/NotificationContext';
import { getUserProfile } from '../services/userService';
import styles from '../styles/EditPostPage.module.css';

const EditPostPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { postId } = useParams();
  
  // localStorage 清理函數
  const clearAllCachedData = () => {
    try {
      const ANNOTATIONS_KEY = 'imageAnnotations';
      const DRAFT_KEY = 'createPostDraft';
      const ABNORMAL_DRAFT_KEY = 'createAbnormalPostDraft';
      const EDIT_DRAFT_KEY = `editPostDraft_${postId}`;
      
      // 清除主要的緩存資料
      localStorage.removeItem(ANNOTATIONS_KEY);
      localStorage.removeItem(DRAFT_KEY);
      localStorage.removeItem(ABNORMAL_DRAFT_KEY);
      localStorage.removeItem(EDIT_DRAFT_KEY);
      
      // 清除所有可能的草稿和標註相關資料
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (
          key.includes('postDraft') || 
          key.includes('imageAnnotations') || 
          key.includes('annotationTemp') ||
          key.includes(`editPost_${postId}`)
        )) {
          keysToRemove.push(key);
        }
      }
      
      keysToRemove.forEach(key => {
        localStorage.removeItem(key);
      });
      
      console.log('✅ EditPostPage localStorage 清理完成');
    } catch (error) {
      console.error('❌ EditPostPage localStorage 清理失敗:', error);
    }
  };
  const [user, setUser] = useState(null);
  const [selectedLocation, setSelectedLocation] = useState('');
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [notification, setNotification] = useState('');
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showAnnotationDots, setShowAnnotationDots] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showImageEditor, setShowImageEditor] = useState(false);
  const [editingImageIndex, setEditingImageIndex] = useState(null);
  const [hashtags, setHashtags] = useState([]);
  const [hashtagInput, setHashtagInput] = useState('');
  const descriptionRef = useRef(null);
  const imageContainerRef = useRef(null);
  const hashtagContainerRef = useRef(null);
  
  // 拖動排序相關狀態
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  
  // 確認刪除相關狀態
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteImageIndex, setDeleteImageIndex] = useState(null);
  
  // 確認離開頁面相關狀態
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  
  // 新增圖片相關狀態
  const fileInputRef = useRef(null);
  
  // 編輯的貼文資料
  const [postData, setPostData] = useState({
    images: [],
    description: '',
    hashtags: [],
    location: ''
  });

  // 原始貼文資料（用於取消編輯時恢復）
  const [originalPostData, setOriginalPostData] = useState({
    images: [],
    description: '',
    hashtags: [],
    location: ''
  });

  // 追蹤變更的狀態
  const [pendingChanges, setPendingChanges] = useState({
    deletedImageIds: [], // 要刪除的圖片 ID
    imageOrderChanges: null, // 圖片順序變更
    annotationChanges: {}, // 圖片標註變更 {imageId: [annotations]}
    hasContentChanges: false // 是否有內容變更
  });

  // 預設位置選項
  const locationOptions = [
    '台北市', '新北市', '桃園市', '台中市', '台南市', '高雄市',
    '基隆市', '新竹市', '嘉義市', '新竹縣', '苗栗縣', '彰化縣',
    '南投縣', '雲林縣', '嘉義縣', '屏東縣', '宜蘭縣', '花蓮縣',
    '台東縣', '澎湖縣', '金門縣', '連江縣'
  ];

  // 檢查是否有未保存的變更
  const hasUnsavedChanges = () => {
    // 檢查是否有新增的圖片
    const hasNewImages = postData.images.some(img => img.isNew);
    
    return (
      pendingChanges.deletedImageIds.length > 0 ||
      pendingChanges.imageOrderChanges !== null ||
      Object.keys(pendingChanges.annotationChanges).length > 0 ||
      postData.description !== originalPostData.description ||
      selectedLocation !== originalPostData.location ||
      JSON.stringify(hashtags) !== JSON.stringify(originalPostData.hashtags) ||
      hasNewImages
    );
  };

  // 攔截導航的目標路徑
  const [pendingNavigationPath, setPendingNavigationPath] = useState(null);

  // 恢復到原始狀態
  const resetToOriginalState = () => {
    setPostData(JSON.parse(JSON.stringify(originalPostData)));
    setSelectedLocation(originalPostData.location || '');
    setHashtags(originalPostData.hashtags || []);
    setPendingChanges({
      deletedImageIds: [],
      imageOrderChanges: null,
      annotationChanges: {},
      hasContentChanges: false
    });
    setCurrentImageIndex(0);
  };

  // 修改確認離開頁面函數以處理不同的導航目標
  const handleConfirmLeaveWithPath = () => {
    setShowLeaveConfirm(false);
    resetToOriginalState();
    
    if (pendingNavigationPath) {
      navigate(pendingNavigationPath);
      setPendingNavigationPath(null);
    } else {
      navigate(-1);
    }
  };

  // 攔截瀏覽器返回和頁面切換
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasUnsavedChanges()) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    // 監聽瀏覽器的 beforeunload 事件
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [pendingChanges, postData, originalPostData, selectedLocation, hashtags]);

  // 載入貼文資料
  useEffect(() => {
    const loadPostData = async () => {
      try {
        // 優先使用傳入的資料（如果有）
        if (location.state && location.state.postData) {
          const { postData: receivedData } = location.state;
          setPostData(receivedData);
          setOriginalPostData(JSON.parse(JSON.stringify(receivedData))); // 深拷貝原始資料
          setSelectedLocation(receivedData.location || '');
          setHashtags(receivedData.hashtags || []);
          return;
        }
        
        // 如果沒有傳入資料，從 API 獲取
        if (postId) {
          showNotification('正在載入貼文資料...');
          
          const { getPost } = await import('../services/socialService');
          const result = await getPost(postId);
          
          if (result.success) {
            const postData = result.data;
            
            // 處理貼文內容
            const content = postData.content?.content_text || '';
            const location = postData.content?.location || '';
            const backendImages = postData.images || [];
            const backendAnnotations = postData.annotations || [];
            
            // 處理圖片資料（不在圖片物件中嵌入標註）
            const processedImages = backendImages.map(image => ({
              id: image.id,
              dataUrl: image.firebase_url,
              url: image.url,
              firebase_url: image.firebase_url
            }));
            
            console.log('Processed images from backend:', processedImages);
            
            // 處理標註資料（跟 Post 組件一樣放在 postData.annotations）
            const processedAnnotations = backendAnnotations.map(annotation => ({
              id: annotation.id,
              firebase_url: annotation.firebase_url,
              x_position: annotation.x_position,
              y_position: annotation.y_position,
              x: annotation.x_position, // 兼容舊格式
              y: annotation.y_position, // 兼容舊格式
              display_name: annotation.display_name,
              target_type: annotation.target_type,
              target_id: annotation.target_id,
              created_by: annotation.created_by
            }));
            
            // 處理 hashtag 資料，轉換為前端需要的格式
            const backendHashtags = postData.hashtags || [];
            const frontendHashtags = backendHashtags.map(hashtagObj => ({
              id: hashtagObj.id,
              text: hashtagObj.tag
            }));
            
            
            const processedPostData = {
              images: processedImages,
              description: content,
              location: location,
              hashtags: frontendHashtags,
              annotations: processedAnnotations
            };
            
            setPostData(processedPostData);
            setOriginalPostData(JSON.parse(JSON.stringify(processedPostData))); // 深拷貝原始資料
            setSelectedLocation(location);
            setHashtags(frontendHashtags);
            
            hideNotification();
          } else {
            throw new Error(result.error || '獲取貼文失敗');
          }
        } else {
          // 沒有 postId，使用預設資料
          setPostData({
            images: [],
            description: '',
            location: ''
          });
        }
      } catch (error) {
        console.error('載入貼文資料失敗:', error);
        showNotification(`載入貼文失敗: ${error.message}`);
        
        // 失敗時使用預設資料
        setPostData({
          images: [],
          description: '',
          location: ''
        });
      }
    };
    
    loadPostData();
  }, [postId, location.state]);

  // 獲取當前圖片的標註（按照 Post 組件的方式）
  const getImageAnnotations = (imageIndex) => {
    if (!postData.annotations || !Array.isArray(postData.annotations)) {
      return [];
    }
    
    const currentImage = postData.images?.[imageIndex];
    const currentImageUrl = currentImage?.firebase_url;
    const currentImageId = currentImage?.id;
    
    // 過濾出屬於當前圖片的標註（支持新增圖片和原始圖片）
    const filtered = postData.annotations.filter(annotation => {
      // 匹配 image_index
      if (annotation.image_index === imageIndex) {
        return true;
      }
      
      // 匹配 firebase_url（原始圖片）
      if (currentImageUrl && annotation.firebase_url === currentImageUrl) {
        return true;
      }
      
      // 匹配 temp_image_id（新增圖片）
      if (currentImage?.isNew && annotation.temp_image_id === currentImageId) {
        return true;
      }
      
      return false;
    });
    
    return filtered;
  };

  // 獲取用戶資料
  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        const userProfile = await getUserProfile();
        setUser(userProfile);
      } catch (error) {
        console.error('獲取用戶資料失敗:', error);
        showNotification('獲取用戶資料失敗');
      }
    };

    fetchUserProfile();
  }, []);

  // 鍵盤導航支援
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (postData.images && postData.images.length > 1 && !showImageEditor) {
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          handlePrevImage();
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          handleNextImage();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [postData.images, showImageEditor]);

  // 處理滑鼠滾輪橫向滾動 - 圖片容器
  useEffect(() => {
    // 只有當有圖片時才設置監聽器
    if (!postData.images || postData.images.length === 0) {
      return;
    }

    // 等待下一個 tick 確保 DOM 已渲染
    const timeoutId = setTimeout(() => {
      const container = imageContainerRef.current;
      if (!container) {
        return;
      }
      
      const handleWheel = (e) => {
        if (e.deltaY !== 0) {
          e.preventDefault();
          container.scrollLeft += e.deltaY;
        }
      };

      container.addEventListener('wheel', handleWheel, { passive: false });
      
      // 返回清理函數
      return () => {
        container.removeEventListener('wheel', handleWheel);
      };
    }, 100);

    // 清理 timeout
    return () => {
      clearTimeout(timeoutId);
    };
  }, [postData.images]);

  // 處理滑鼠滾輪橫向滾動 - hashtag 容器
  useEffect(() => {
    // 只有當有 hashtag 時才設置監聽器
    if (!hashtags || hashtags.length === 0) {
      return;
    }

    // 等待下一個 tick 確保 DOM 已渲染
    const timeoutId = setTimeout(() => {
      const container = hashtagContainerRef.current;
      if (!container) {
        return;
      }
      
      const handleWheel = (e) => {
        if (e.deltaY !== 0) {
          e.preventDefault();
          container.scrollLeft += e.deltaY;
        }
      };

      container.addEventListener('wheel', handleWheel, { passive: false });
      
      // 返回清理函數
      return () => {
        container.removeEventListener('wheel', handleWheel);
      };
    }, 100);

    // 清理 timeout
    return () => {
      clearTimeout(timeoutId);
    };
  }, [hashtags]);

  // 顯示通知
  const showNotification = (msg) => {
    setNotification(msg);
  };

  // 隱藏通知
  const hideNotification = () => {
    setNotification('');
  };

  // 處理位置選擇
  const handleLocationSelect = (location) => {
    setSelectedLocation(location);
    setShowLocationModal(false);
    setPostData(prev => ({ ...prev, location }));
  };

  // 切換標註點顯示
  const toggleAnnotationDots = () => {
    setShowAnnotationDots(!showAnnotationDots);
  };

  // 處理圖片滑動
  const handlePrevImage = () => {
    setCurrentImageIndex(prev => 
      prev > 0 ? prev - 1 : postData.images.length - 1
    );
    setShowAnnotationDots(false);
  };

  const handleNextImage = () => {
    setCurrentImageIndex(prev => 
      prev < postData.images.length - 1 ? prev + 1 : 0
    );
    setShowAnnotationDots(false);
  };

  // 處理觸控滑動
  const handleTouchStart = (e) => {
    const touch = e.touches[0];
    e.currentTarget.startX = touch.clientX;
  };

  const handleTouchEnd = (e) => {
    const touch = e.changedTouches[0];
    const diffX = e.currentTarget.startX - touch.clientX;
    
    if (Math.abs(diffX) > 50) {
      if (diffX > 0) {
        handleNextImage();
      } else {
        handlePrevImage();
      }
    }
  };

  // 處理圖片點擊 - 開啟圖片編輯器
  const handleImageClick = (index) => {
    setEditingImageIndex(index);
    setShowImageEditor(true);
  };

  // 處理圖片編輯保存
  const handleImageEditorSave = (editedImage) => {
    if (editingImageIndex !== null) {
      const currentImage = postData.images[editingImageIndex];
      
      // 更新圖片資料（包含 annotations）
      const updatedImages = [...postData.images];
      updatedImages[editingImageIndex] = editedImage;
      setPostData(prev => ({ ...prev, images: updatedImages }));
      
      // 追蹤 annotation 變更到 pendingChanges
      const imageId = currentImage.id;
      const newAnnotations = editedImage.annotations || [];
      
      setPendingChanges(prev => ({
        ...prev,
        annotationChanges: {
          ...prev.annotationChanges,
          [imageId]: newAnnotations
        }
      }));
      
      // 更新當前 postData 中的 annotations（用於即時顯示）
      setPostData(prevData => {
        const updatedAnnotations = [...(prevData.annotations || [])];
        
        if (currentImage.isNew) {
          // 對於新增的圖片，移除該圖片的舊標註（使用臨時 ID）
          const filteredAnnotations = updatedAnnotations.filter(
            annotation => annotation.temp_image_id !== currentImage.id
          );
          
          // 添加新標註（使用臨時標識）
          const imageAnnotations = newAnnotations.map(annotation => ({
            ...annotation,
            temp_image_id: currentImage.id, // 使用臨時圖片 ID
            image_index: editingImageIndex
          }));
          
          return {
            ...prevData,
            annotations: [...filteredAnnotations, ...imageAnnotations]
          };
        } else {
          // 對於原始圖片，使用 firebase_url
          const filteredAnnotations = updatedAnnotations.filter(
            annotation => annotation.firebase_url !== currentImage.firebase_url
          );
          
          // 添加新標註
          const imageAnnotations = newAnnotations.map(annotation => ({
            ...annotation,
            firebase_url: currentImage.firebase_url,
            image_index: editingImageIndex
          }));
          
          return {
            ...prevData,
            annotations: [...filteredAnnotations, ...imageAnnotations]
          };
        }
      });
      
      // 檢查是否有新增或修改標註（不包括純刪除）
      const hasAddedOrModifiedAnnotations = newAnnotations.some(annotation => {
        if (currentImage.isNew) {
          return true; // 新圖片上的所有標註都是新增的
        }
        return !annotation.id || // 新增的標註
          originalPostData.annotations?.some(orig => 
            orig.firebase_url === currentImage.firebase_url && 
            orig.id === annotation.id && 
            (orig.x_position !== annotation.x_position || orig.y_position !== annotation.y_position)
          ); // 修改的標註
      });
    }
    setShowImageEditor(false);
    setEditingImageIndex(null);
  };

  // 處理拖動開始
  const handleDragStart = (e, index) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    // 添加拖動效果
    e.target.style.opacity = '0.5';
  };

  // 處理拖動結束
  const handleDragEnd = (e) => {
    e.target.style.opacity = '1';
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  // 處理拖動經過
  const handleDragOver = (e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    
    if (draggedIndex !== null && draggedIndex !== index) {
      setDragOverIndex(index);
    }
  };

  // 處理拖動離開
  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  // 處理放置（僅前端預覽，不立即更新後端）
  const handleDrop = (e, dropIndex) => {
    e.preventDefault();
    
    if (draggedIndex === null || draggedIndex === dropIndex) {
      return;
    }

    const oldImages = [...postData.images];
    const draggedImage = oldImages[draggedIndex];
    
    // 移除拖動的圖片
    const updatedImages = [...oldImages];
    updatedImages.splice(draggedIndex, 1);
    
    // 在新位置插入圖片
    updatedImages.splice(dropIndex, 0, draggedImage);
    
    // 更新前端狀態
    setPostData(prev => {
      // 同時更新標註的 image_index
      const updatedAnnotations = prev.annotations ? prev.annotations.map(annotation => {
        // 找到標註原本屬於的圖片
        const originalImageIndex = oldImages.findIndex(img => {
          // 檢查各種匹配條件
          if (annotation.image_index !== undefined && annotation.image_index < oldImages.length) {
            return oldImages[annotation.image_index].id === img.id;
          }
          if (annotation.firebase_url && img.firebase_url) {
            return annotation.firebase_url === img.firebase_url;
          }
          if (annotation.temp_image_id && img.isNew && img.id) {
            return annotation.temp_image_id === img.id;
          }
          return false;
        });
        
        if (originalImageIndex !== -1) {
          // 找到這張圖片在新順序中的位置
          const originalImage = oldImages[originalImageIndex];
          const newImageIndex = updatedImages.findIndex(img => img.id === originalImage.id);
          
          if (newImageIndex !== -1) {
            // 更新標註的 image_index
            return {
              ...annotation,
              image_index: newImageIndex
            };
          }
        }
        
        return annotation;
      }) : [];
      
      return {
        ...prev,
        images: updatedImages,
        annotations: updatedAnnotations
      };
    });
    
    // 記錄圖片順序變更
    const imageOrders = updatedImages.map((image, index) => ({
      image_id: image.id,
      sort_order: index
    }));
    
    // 更新標註關聯：由於圖片順序改變，需要重新映射標註
    setPendingChanges(prev => {
      const newAnnotationChanges = { ...prev.annotationChanges };
      
      // 創建新的標註映射
      updatedImages.forEach((image, newIndex) => {
        const oldIndex = oldImages.findIndex(oldImg => oldImg.id === image.id);
        
        // 如果這張圖片的標註已經被修改過
        if (prev.annotationChanges[image.id]) {
          // 保持相同的標註數據，因為標註是綁定到圖片ID的，不是位置
          // 這裡不需要特別處理，因為標註已經正確關聯到圖片ID
        }
      });
      
      return {
        ...prev,
        imageOrderChanges: imageOrders,
        annotationChanges: newAnnotationChanges
      };
    });
    
    // 如果當前顯示的圖片被移動，更新當前索引
    if (currentImageIndex === draggedIndex) {
      setCurrentImageIndex(dropIndex);
    } else if (draggedIndex < currentImageIndex && dropIndex >= currentImageIndex) {
      setCurrentImageIndex(currentImageIndex - 1);
    } else if (draggedIndex > currentImageIndex && dropIndex <= currentImageIndex) {
      setCurrentImageIndex(currentImageIndex + 1);
    }
    
    // 重置拖動狀態
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  // 處理刪除圖片（僅前端預覽，不立即刪除後端）
  const handleDeleteImage = () => {
    if (deleteImageIndex === null) return;
    
    const imageToDelete = postData.images[deleteImageIndex];
    const updatedImages = [...postData.images];
    updatedImages.splice(deleteImageIndex, 1);
    
    // 檢查刪除後是否會沒有圖片
    // 計算：原始圖片數量 - 已刪除數量 + 新增圖片數量 - 1（當前要刪除的）
    const originalImageCount = originalPostData.images.length;
    const newImagesCount = postData.images.filter(img => img.isNew).length;
    const currentDeletedCount = pendingChanges.deletedImageIds.length;
    
    // 如果要刪除的是新圖片，從新圖片數量中減去
    // 如果要刪除的是原始圖片，從刪除數量中加一
    let finalImageCount;
    if (imageToDelete.isNew) {
      finalImageCount = originalImageCount - currentDeletedCount + (newImagesCount - 1);
    } else {
      finalImageCount = originalImageCount - (currentDeletedCount + 1) + newImagesCount;
    }
    
    if (finalImageCount < 1) {
      showNotification('貼文至少需要保留一張圖片');
      setDeleteImageIndex(null);
      setShowDeleteConfirm(false);
      return;
    }
    
    // 更新前端狀態
    setPostData(prev => ({ ...prev, images: updatedImages }));
    
    // 只有非新增的圖片才需要記錄到待刪除列表中
    if (!imageToDelete.isNew) {
      setPendingChanges(prev => ({
        ...prev,
        deletedImageIds: [...prev.deletedImageIds, imageToDelete.id]
      }));
    }
    
    // 如果刪除的是當前顯示的圖片，調整當前索引
    if (currentImageIndex >= updatedImages.length) {
      setCurrentImageIndex(Math.max(0, updatedImages.length - 1));
    } else if (deleteImageIndex < currentImageIndex) {
      setCurrentImageIndex(currentImageIndex - 1);
    }
    
    // 重置刪除狀態
    setDeleteImageIndex(null);
    setShowDeleteConfirm(false);
  };

  // 取消刪除
  const handleCancelDelete = () => {
    setDeleteImageIndex(null);
    setShowDeleteConfirm(false);
  };

  // 處理描述更新
  const handleDescriptionChange = (e) => {
    setPostData(prev => ({ ...prev, description: e.target.value }));
  };

  // 新增 hashtag
  const handleAddHashtag = () => {
    const tagText = hashtagInput.trim();
    
    if (!tagText) {
      showNotification('請輸入標籤內容');
      return;
    }
    
    if (hashtags.some(tag => {
      const existingTagText = tag.tag || tag.text || (typeof tag === 'string' ? tag : '');
      return existingTagText === tagText;
    })) {
      showNotification('此標籤已存在');
      return;
    }
    
    if (hashtags.length >= 10) {
      showNotification('最多只能新增10個標籤');
      return;
    }
    
    const newHashtag = {
      id: Date.now() + Math.random(),
      text: tagText
    };
    
    setHashtags(prev => [...prev, newHashtag]);
    setPostData(prev => ({ ...prev, hashtags: [...prev.hashtags, newHashtag] }));
    setHashtagInput('');
  };

  // 移除 hashtag
  const handleRemoveHashtag = (tagId) => {
    setHashtags(prev => prev.filter(tag => tag.id !== tagId));
    setPostData(prev => ({ ...prev, hashtags: prev.hashtags.filter(tag => tag.id !== tagId) }));
  };

  // 處理 hashtag 輸入框 Enter 鍵
  const handleHashtagKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddHashtag();
    }
  };

  // 處理新增圖片按鈕點擊
  const handleAddImageClick = () => {
    fileInputRef.current?.click();
  };

  // 處理圖片選擇
  const handleImageSelect = (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach(file => {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const newImage = {
            id: Date.now() + Math.random(), // 臨時 ID
            dataUrl: event.target.result,
            file: file, // 保存文件對象用於上傳
            isNew: true, // 標記為新圖片
            annotations: [] // 初始化空標註陣列
          };

          // 添加到圖片列表
          setPostData(prev => ({
            ...prev,
            images: [...prev.images, newImage]
          }));

        };
        reader.readAsDataURL(file);
      }
    });

    // 重置文件輸入
    e.target.value = '';
  };

  // 返回上一頁
  const handleCancel = () => {
    if (hasUnsavedChanges()) {
      setShowLeaveConfirm(true);
    } else {
      navigate(-1);
    }
  };

  // 確認離開頁面
  const handleConfirmLeave = () => {
    handleConfirmLeaveWithPath();
  };

  // 取消離開頁面
  const handleCancelLeave = () => {
    setShowLeaveConfirm(false);
    setPendingNavigationPath(null);
  };

  // 處理新增圖片的標註
  const handleNewImageAnnotations = async (updatedPostData, newImages, newImageMapping = {}) => {
    const { createAnnotation } = await import('../services/socialService');
    
    console.log('處理新增圖片標註:', {
      pendingChanges: pendingChanges.annotationChanges,
      newImages: newImages.map(img => ({ id: img.id, isNew: img.isNew })),
      newImageMapping,
      updatedPostData: updatedPostData
    });
    
    try {
      // 檢查新增圖片是否有標註需要處理
      for (const [imageId, annotations] of Object.entries(pendingChanges.annotationChanges)) {
        // 查找新增圖片
        const localImage = postData.images.find(img => img.id && img.id.toString() === imageId && img.isNew);
        
        console.log('檢查圖片:', { imageId, localImage, annotations });
        
        if (!localImage || !annotations || annotations.length === 0) {
          continue;
        }
        
        // 從映射中獲取圖片信息
        const mappingInfo = newImageMapping[imageId];
        if (!mappingInfo) {
          console.log('找不到圖片映射信息');
          continue;
        }
        
        // 從更新後的貼文資料中找到對應的圖片
        const allImages = updatedPostData.images || [];
        
        console.log('尋找服務器圖片:', {
          mappingInfo,
          allImagesLength: allImages.length,
          allImages: allImages.map(img => ({ 
            sort_order: img.sort_order, 
            firebase_url: img.firebase_url 
          }))
        });
        
        // 找出所有新上傳的圖片（它們沒有在原始圖片中）
        const originalImageIds = originalPostData.images.map(img => img.id);
        const newServerImages = allImages.filter(img => 
          !originalImageIds.includes(img.id)
        );
        
        console.log('新上傳的服務器圖片:', {
          originalImageIds,
          newServerImages: newServerImages.map(img => ({
            id: img.id,
            sort_order: img.sort_order,
            firebase_url: img.firebase_url
          }))
        });
        
        // 根據上傳順序找到對應的服務器圖片
        const serverImage = newServerImages[mappingInfo.uploadIndex];
        
        console.log('找到的服務器圖片:', {
          uploadIndex: mappingInfo.uploadIndex,
          serverImage
        });
        
        if (!serverImage || !serverImage.firebase_url) {
          console.log('找不到服務器圖片或沒有 firebase_url');
          continue;
        }
        
        // 為這個圖片創建標註
        for (const annotation of annotations) {
          // 對於新圖片，所有標註都是新的，需要創建
          console.log('創建標註:', {
            firebase_url: serverImage.firebase_url,
            annotation
          });
          
          const createResult = await createAnnotation({
            firebase_url: serverImage.firebase_url,
            x_position: annotation.x_position,
            y_position: annotation.y_position,
            display_name: annotation.display_name,
            target_type: annotation.target_type,
            target_id: annotation.target_id
          });
          
          console.log('創建標註結果:', createResult);
          
          if (!createResult.success) {
            console.error(`為新圖片創建標註失敗: ${createResult.error}`);
          } else {
            console.log('成功為新圖片創建標註');
            
            // 更新前端標註資料，將臨時標註替換為真實標註
            if (createResult.data) {
              setPostData(prevData => {
                const updatedAnnotations = [...(prevData.annotations || [])];
                
                // 找到並替換對應的臨時標註
                const annotationIndex = updatedAnnotations.findIndex(ann => 
                  ann.temp_image_id === localImage.id &&
                  ann.x_position === annotation.x_position &&
                  ann.y_position === annotation.y_position
                );
                
                if (annotationIndex !== -1) {
                  // 替換為真實標註資料
                  updatedAnnotations[annotationIndex] = {
                    ...createResult.data,
                    image_index: mappingInfo.actualIndex
                  };
                }
                
                return {
                  ...prevData,
                  annotations: updatedAnnotations
                };
              });
            }
          }
        }
      }
      
      console.log('處理新增圖片標註完成');
    } catch (error) {
      console.error('處理新增圖片標註失敗:', error);
    }
  };

  // 更新貼文
  const handleUpdate = async () => {
    if (!selectedLocation) {
      showNotification('請選擇位置');
      return;
    }
    
    if (isUpdating) {
      return;
    }
    
    try {
      setIsUpdating(true);
      showNotification('正在更新貼文...');
      
      const { updatePost, deletePostImage, reorderPostImages, createAnnotation, updateAnnotation, deleteAnnotation } = await import('../services/socialService');
      
      // 1. 先處理圖片刪除
      if (pendingChanges.deletedImageIds.length > 0) {
        // 檢查刪除後是否還有圖片（包含新增的圖片）
        // 直接檢查當前 postData.images 的總數，這已經反映了所有用戶操作
        const finalImageCount = postData.images.length;
        
        if (finalImageCount < 1) {
          throw new Error('貼文至少需要保留一張圖片');
        }
        
        // 檢查是否有新圖片，如果有則允許刪除最後的原始圖片
        const hasNewImages = postData.images.some(img => img.isNew);
        
        for (const imageId of pendingChanges.deletedImageIds) {
          const deleteResult = await deletePostImage(postId, imageId, hasNewImages);
          if (!deleteResult.success) {
            throw new Error(`刪除圖片失敗: ${deleteResult.error}`);
          }
        }
      }
      
      // 2. 處理圖片排序（只處理已存在的圖片）
      if (pendingChanges.imageOrderChanges) {
        // 過濾掉新增的圖片，只保留已存在的圖片
        const existingImageOrders = [];
        let existingImageIndex = 0;
        
        pendingChanges.imageOrderChanges.forEach(order => {
          // 檢查是否為原始圖片（不是新增的）
          const isOriginalImage = originalPostData.images.some(img => img.id === order.image_id);
          // 檢查是否不在刪除列表中
          const isNotDeleted = !pendingChanges.deletedImageIds.includes(order.image_id);
          
          if (isOriginalImage && isNotDeleted) {
            existingImageOrders.push({
              image_id: order.image_id,
              sort_order: existingImageIndex // 使用連續的索引
            });
            existingImageIndex++;
          }
        });
        
        console.log('圖片排序:', {
          original: pendingChanges.imageOrderChanges,
          filtered: existingImageOrders
        });
        
        if (existingImageOrders.length > 0) {
          const reorderResult = await reorderPostImages(postId, existingImageOrders);
          if (!reorderResult.success) {
            throw new Error(`更新圖片順序失敗: ${reorderResult.error}`);
          }
        }
      }
      
      // 3. 處理標註變更（只處理原始圖片的標註）
      if (Object.keys(pendingChanges.annotationChanges).length > 0) {
        for (const [imageId, newAnnotations] of Object.entries(pendingChanges.annotationChanges)) {
          // 查找原始圖片
          const image = originalPostData.images.find(img => img.id.toString() === imageId);
          
          if (!image) {
            continue; // 新增圖片的標註在第4步處理
          }
          
          const firebase_url = image.firebase_url;
          
          // 獲取原始標註
          const originalAnnotations = originalPostData.annotations?.filter(
            annotation => annotation.firebase_url === firebase_url
          ) || [];
          
          // 比較原始標註和新標註，決定需要創建、更新或刪除的標註
          const originalAnnotationMap = new Map(
            originalAnnotations.map(annotation => [annotation.id, annotation])
          );
          
          const newAnnotationMap = new Map(
            newAnnotations.filter(annotation => annotation.id).map(annotation => [annotation.id, annotation])
          );
          
          // 刪除不存在於新標註中的原始標註
          for (const originalAnnotation of originalAnnotations) {
            if (!newAnnotationMap.has(originalAnnotation.id)) {
              const deleteResult = await deleteAnnotation(originalAnnotation.id);
              if (!deleteResult.success) {
                console.error(`刪除標註失敗: ${deleteResult.error}`);
              }
            }
          }
          
          // 更新或創建標註
          for (const newAnnotation of newAnnotations) {
            if (newAnnotation.id && originalAnnotationMap.has(newAnnotation.id)) {
              // 更新現有標註
              const originalAnnotation = originalAnnotationMap.get(newAnnotation.id);
              
              // 檢查是否有任何變化：位置或標註對象
              const positionChanged = originalAnnotation.x_position !== newAnnotation.x_position || 
                                    originalAnnotation.y_position !== newAnnotation.y_position;
              const targetChanged = originalAnnotation.target_type !== newAnnotation.target_type ||
                                  originalAnnotation.target_id !== newAnnotation.target_id;
              
              if (positionChanged || targetChanged) {
                // 準備更新資料
                const updateData = {
                  x_position: newAnnotation.x_position,
                  y_position: newAnnotation.y_position
                };
                
                // 如果標註對象改變了，需要刪除舊標註並創建新標註
                if (targetChanged) {
                  // 刪除舊標註
                  const deleteResult = await deleteAnnotation(newAnnotation.id);
                  if (!deleteResult.success) {
                    console.error(`刪除舊標註失敗: ${deleteResult.error}`);
                  }
                  
                  // 創建新標註
                  const createResult = await createAnnotation({
                    firebase_url: firebase_url,
                    x_position: newAnnotation.x_position,
                    y_position: newAnnotation.y_position,
                    target_type: newAnnotation.target_type,
                    target_id: newAnnotation.target_id
                  });
                  if (!createResult.success) {
                    console.error(`創建新標註失敗: ${createResult.error}`);
                  }
                } else {
                  // 只更新位置
                  const updateResult = await updateAnnotation(newAnnotation.id, updateData);
                  if (!updateResult.success) {
                    console.error(`更新標註失敗: ${updateResult.error}`);
                  }
                }
              }
            } else {
              // 創建新標註（包括沒有ID或有臨時ID但不在原始標註中的）
              const createResult = await createAnnotation({
                firebase_url: firebase_url,
                x_position: newAnnotation.x_position,
                y_position: newAnnotation.y_position,
                target_type: newAnnotation.target_type,
                target_id: newAnnotation.target_id
              });
              if (!createResult.success) {
                console.error(`創建標註失敗: ${createResult.error}`);
              }
            }
          }
        }
      }
      
      // 4. 更新貼文內容（包含新圖片上傳）
      const newImages = postData.images.filter(image => image.isNew && image.file);
      
      if (newImages.length > 0) {
        // 有新圖片需要上傳，使用 FormData
        const formData = new FormData();
        formData.append('content', postData.description);
        formData.append('location', selectedLocation);
        formData.append('hashtags', hashtags.map(tag => 
          tag.tag || tag.text || (typeof tag === 'string' ? tag : '')
        ).join(','));
        
        // 添加新圖片文件，並記錄它們的臨時ID和實際順序
        const newImageMapping = {};
        newImages.forEach((image, index) => {
          formData.append('images', image.file);
          // 記錄臨時ID和在 postData.images 中的實際位置
          const actualIndex = postData.images.findIndex(img => img.id === image.id);
          newImageMapping[image.id] = {
            uploadIndex: index,  // 上傳順序
            actualIndex: actualIndex,  // 在所有圖片中的實際位置
            tempId: image.id
          };
        });
        
        console.log('新圖片映射:', newImageMapping);
        
        const result = await updatePost(postId, formData, true); // 第三個參數表示使用 FormData
        
        if (result.success) {
          // 圖片上傳成功後，處理新增圖片的標註
          if (result.data) {
            await handleNewImageAnnotations(result.data, newImages, newImageMapping);
          }
          
          // 5. 如果有新圖片上傳且有圖片排序變更，需要重新排序所有圖片以確保順序正確
          if (result.data && result.data.images && pendingChanges.imageOrderChanges && newImages.length > 0) {
            // 獲取上傳後的所有圖片
            const allImagesAfterUpload = result.data.images;
            
            // 創建最終的圖片順序，基於前端的 postData.images 順序
            const finalImageOrders = [];
            let sortOrderIndex = 0;
            
            postData.images.forEach((frontendImage, index) => {
              // 找到對應的後端圖片
              let backendImage = null;
              
              if (frontendImage.isNew) {
                // 新圖片：根據上傳順序找到對應的後端圖片
                const mapping = newImageMapping[frontendImage.id];
                if (mapping) {
                  // 找到所有新上傳的圖片（通常是 sort_order 最大的那些）
                  const allImagesSorted = allImagesAfterUpload.sort((a, b) => b.sort_order - a.sort_order);
                  const uploadedImages = allImagesSorted.slice(0, newImages.length);
                  // 按照上傳時的順序重新排序
                  uploadedImages.sort((a, b) => a.sort_order - b.sort_order);
                  backendImage = uploadedImages[mapping.uploadIndex];
                }
              } else {
                // 原有圖片：通過 ID 直接匹配
                backendImage = allImagesAfterUpload.find(img => img.id === frontendImage.id);
              }
              
              if (backendImage && backendImage.id) {
                finalImageOrders.push({
                  image_id: backendImage.id,
                  sort_order: sortOrderIndex
                });
                sortOrderIndex++;
              }
            });
            
            console.log('最終圖片排序:', finalImageOrders);
            
            // 執行最終排序
            if (finalImageOrders.length > 0) {
              const finalReorderResult = await reorderPostImages(postId, finalImageOrders);
              if (!finalReorderResult.success) {
                console.error('最終圖片排序失敗:', finalReorderResult.error);
              } else {
                console.log('最終圖片排序成功');
              }
            }
          }
          
          // 清除待處理的變更
          setPendingChanges({
            deletedImageIds: [],
            imageOrderChanges: null,
            annotationChanges: {},
            hasContentChanges: false
          });
          
          showNotification('貼文更新成功！');
          setTimeout(() => {
            navigate(-1, { 
              state: { 
                postUpdated: true, 
                updatedPostId: postId,
                timestamp: Date.now()
              }
            }); // 返回上一頁並傳遞更新標記
          }, 1500);
        } else {
          throw new Error(result.error || '更新失敗');
        }
      } else {
        // 沒有新圖片，使用普通 JSON 更新
        const updateData = {
          content: postData.description,
          location: selectedLocation,
          hashtags: hashtags.map(tag => 
            tag.tag || tag.text || (typeof tag === 'string' ? tag : '')
          ).join(',')
        };
        
        
        const result = await updatePost(postId, updateData);
        
        if (result.success) {
          // 清除待處理的變更
          setPendingChanges({
            deletedImageIds: [],
            imageOrderChanges: null,
            annotationChanges: {},
            hasContentChanges: false
          });
          
          // 清理 localStorage 中的相關資料
          clearAllCachedData();
          
          showNotification('貼文更新成功！');
          setTimeout(() => {
            navigate(-1, { 
              state: { 
                postUpdated: true, 
                updatedPostId: postId,
                timestamp: Date.now()
              }
            }); // 返回上一頁並傳遞更新標記
          }, 1500);
        } else {
          throw new Error(result.error || '更新失敗');
        }
      }
      
    } catch (error) {
      console.error('更新貼文失敗:', error);
      let errorMsg = error.message;
      
      // 友善的錯誤訊息
      if (errorMsg.includes('network') || errorMsg.includes('Network')) {
        errorMsg = '網路連線錯誤，請檢查網路連線後重試';
      } else if (errorMsg.includes('timeout')) {
        errorMsg = '請求逾時，請稍後重試';
      } else if (errorMsg.includes('權限')) {
        errorMsg = '您沒有權限編輯此貼文';
      } else if (errorMsg.includes('找不到')) {
        errorMsg = '找不到指定的貼文';
      }
      
      showNotification(`更新失敗: ${errorMsg}`);
    } finally {
      setIsUpdating(false);
    }
  };

  if (!user || !postData) {
    return (
      <NotificationProvider>
        <div className={styles.container}>
          <TopNavbar />
          <div className={styles.loading}>載入中...</div>
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
          <h2 className={styles.title}>編輯貼文</h2>
          <div className={styles.divider}></div>
          
          {/* 貼文編輯卡片 */}
          <div className={styles.postCard}>
            {/* 用戶資訊區域 */}
            <div className={styles.userInfo}>
              <img 
                src={user.headshot_url || '/assets/icon/DefaultAvatar.jpg'} 
                alt="用戶頭像" 
                className={styles.userAvatar}
              />
              <div className={styles.userDetails}>
                <h3 className={styles.userName}>{user.user_account}</h3>
                <button 
                  className={styles.locationButton}
                  onClick={() => setShowLocationModal(true)}
                >
                  {selectedLocation || '選擇位置'}
                </button>
              </div>
            </div>

            {/* 圖片區域 */}
            {postData.images && postData.images.length > 0 && (
              <div className={styles.imageSection}>
                <div 
                  className={styles.imageCarousel}
                  onTouchStart={handleTouchStart}
                  onTouchEnd={handleTouchEnd}
                >
                  <div className={styles.mainImageContainer}>
                    <img 
                      src={postData.images[currentImageIndex].dataUrl || 
                           postData.images[currentImageIndex].url ||
                           postData.images[currentImageIndex].firebase_url} 
                      alt={`貼文圖片 ${currentImageIndex + 1}`}
                      className={styles.postImage}
                      onClick={() => handleImageClick(currentImageIndex)}
                    />
                    
                    {/* 編輯提示 */}
                    <div className={styles.editHint}>
                      點擊圖片編輯標註
                    </div>
                    
                    {/* 標註圖示 */}
                    {(() => {
                      const currentImageAnnotations = getImageAnnotations(currentImageIndex);
                      return currentImageAnnotations.length > 0 && (
                        <div 
                          className={styles.annotationIcon}
                          onClick={toggleAnnotationDots}
                          title={`${currentImageAnnotations.length} 個標註`}
                        >
                          <img 
                            src="/assets/icon/PostAnnotation.png" 
                            alt="標註" 
                            className={styles.annotationIconImage}
                          />
                        </div>
                      );
                    })()}
                    
                    {/* 標註點顯示 */}
                    {showAnnotationDots && (() => {
                      const currentImageAnnotations = getImageAnnotations(currentImageIndex);
                      return currentImageAnnotations.map((annotation) => (
                        <Annotation
                          key={annotation.id}
                          annotation={annotation}
                          x={annotation.x_position || annotation.x}
                          y={annotation.y_position || annotation.y}
                          isVisible={true}
                          onClick={() => {}}
                        />
                      ));
                    })()}
                    
                    {/* 圖片指示器 */}
                    {postData.images.length > 1 && (
                      <div className={styles.imageIndicator}>
                        {currentImageIndex + 1}/{postData.images.length}
                      </div>
                    )}
                  </div>
                </div>
                
                {/* 圖片縮圖預覽 */}
                {(postData.images.length > 0 || true) && (
                  <div ref={imageContainerRef} className={styles.imagePreviewContainer}>
                    {postData.images.map((image, index) => (
                      <div 
                        key={index} 
                        className={`${styles.imagePreview} ${index === currentImageIndex ? styles.activePreview : ''} ${dragOverIndex === index ? styles.dragOver : ''}`}
                        onClick={() => setCurrentImageIndex(index)}
                        draggable
                        onDragStart={(e) => handleDragStart(e, index)}
                        onDragEnd={handleDragEnd}
                        onDragOver={(e) => handleDragOver(e, index)}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDrop(e, index)}
                      >
                        <img 
                          src={image.dataUrl || image.url || image.firebase_url} 
                          alt={`圖片 ${index + 1}`}
                          className={styles.previewImage}
                        />
                        {/* 刪除按鈕 */}
                        <button 
                          className={styles.removeImageBtn}
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteImageIndex(index);
                            setShowDeleteConfirm(true);
                          }}
                          title="刪除圖片"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    
                    {/* 新增圖片按鈕 */}
                    <div className={styles.addImageButton} onClick={handleAddImageClick}>
                      <img 
                        src="/assets/icon/PostAddImageIcon.png" 
                        alt="新增圖片" 
                        className={styles.addImageIcon}
                      />
                      <span className={styles.addImageLabel}>新增圖片</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 描述文字編輯區 */}
            <div className={styles.descriptionSection}>
              <textarea
                ref={descriptionRef}
                className={styles.descriptionInput}
                value={postData.description}
                onChange={handleDescriptionChange}
                placeholder="撰寫貼文內容..."
                rows={4}
                maxLength={500}
              />
              <div className={styles.charCount}>
                {postData.description.length}/500
              </div>
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
                    placeholder="輸入標籤"
                    className={styles.hashtagInput}
                  />
                </div>
                <button 
                  className={styles.addHashtagBtn}
                  onClick={handleAddHashtag}
                >
                  新增
                </button>
              </div>
              
              <span className={styles.hashtagCounter}>
                標籤數量：{hashtags.length}/10
              </span>
            </div>
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
              className={`${styles.updateButton} ${isUpdating ? styles.updating : ''}`}
              onClick={handleUpdate}
              disabled={isUpdating}
            >
              {isUpdating ? '更新中...' : '更新貼文'}
            </button>
          </div>
        </div>

        {/* 位置選擇 Modal */}
        {showLocationModal && (
          <div className={styles.modalOverlay} onClick={() => setShowLocationModal(false)}>
            <div className={styles.locationModal} onClick={(e) => e.stopPropagation()}>
              <h3 className={styles.modalTitle}>選擇位置</h3>
              <div className={styles.locationList}>
                {locationOptions.map((location) => (
                  <button
                    key={location}
                    className={`${styles.locationOption} ${
                      location === selectedLocation ? styles.selected : ''
                    }`}
                    onClick={() => handleLocationSelect(location)}
                  >
                    {location}
                  </button>
                ))}
              </div>
              <button 
                className={styles.modalCloseButton}
                onClick={() => setShowLocationModal(false)}
              >
                取消
              </button>
            </div>
          </div>
        )}

        {/* 圖片編輯器 */}
        {showImageEditor && editingImageIndex !== null && postData.images[editingImageIndex] && (
          <ImageEditor
            image={{
              ...postData.images[editingImageIndex],
              annotations: getImageAnnotations(editingImageIndex)
            }}
            isOpen={showImageEditor}
            mode="edit"
            onClose={() => {
              setShowImageEditor(false);
              setEditingImageIndex(null);
            }}
            onSave={handleImageEditorSave}
          />
        )}

        {/* 刪除確認對話框 */}
        {showDeleteConfirm && (
          <ConfirmNotification
            message="確定要刪除此圖片嗎？圖片將在點擊「更新貼文」時刪除，圖片中的標註也會一併刪除。"
            onConfirm={handleDeleteImage}
            onCancel={handleCancelDelete}
          />
        )}

        {/* 離開頁面確認對話框 */}
        {showLeaveConfirm && (
          <ConfirmNotification
            message="確定要離開編輯頁面嗎？未保存的修改將會遺失。"
            onConfirm={handleConfirmLeave}
            onCancel={handleCancelLeave}
          />
        )}

        {/* 隱藏的文件輸入 */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          style={{ display: 'none' }}
          onChange={handleImageSelect}
        />
        
        <BottomNavbar />
      </div>
    </NotificationProvider>
  );
};

export default EditPostPage;