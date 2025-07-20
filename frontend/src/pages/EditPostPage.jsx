import React, { useState, useEffect, useRef } from 'react';
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
        // 正確的方式：只設置 returnValue，不調用 preventDefault
        const confirmationMessage = '確定要離開編輯頁面嗎？未保存的修改將會遺失。';
        e.returnValue = confirmationMessage;
        return confirmationMessage;
      }
    };

    // 添加事件監聽器時指定 passive: false
    window.addEventListener('beforeunload', handleBeforeUnload, { passive: false });

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload, { passive: false });
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
    
    const currentImageUrl = postData.images?.[imageIndex]?.firebase_url;
    
    // 過濾出屬於當前圖片的標註（使用與 Post 組件相同的雙重匹配邏輯）
    const filtered = postData.annotations.filter(annotation => 
      annotation.image_index === imageIndex || 
      annotation.firebase_url === currentImageUrl
    );
    
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
        
        // 移除該圖片的舊標註
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
      });
      
      // 檢查是否有新增或修改標註（不包括純刪除）
      const hasAddedOrModifiedAnnotations = newAnnotations.some(annotation => 
        !annotation.id || // 新增的標註
        originalPostData.annotations?.some(orig => 
          orig.firebase_url === currentImage.firebase_url && 
          orig.id === annotation.id && 
          (orig.x_position !== annotation.x_position || orig.y_position !== annotation.y_position)
        ) // 修改的標註
      );
      
      if (hasAddedOrModifiedAnnotations) {
        showNotification('標註變更將在更新貼文時保存');
      }
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

    const updatedImages = [...postData.images];
    const draggedImage = updatedImages[draggedIndex];
    
    // 移除拖動的圖片
    updatedImages.splice(draggedIndex, 1);
    
    // 在新位置插入圖片
    updatedImages.splice(dropIndex, 0, draggedImage);
    
    // 更新前端狀態
    setPostData(prev => ({ ...prev, images: updatedImages }));
    
    // 記錄圖片順序變更
    const imageOrders = updatedImages.map((image, index) => ({
      image_id: image.id,
      sort_order: index
    }));
    
    setPendingChanges(prev => ({
      ...prev,
      imageOrderChanges: imageOrders
    }));
    
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
    showNotification('圖片順序將在更新貼文時保存');
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
    if (!imageToDelete.isNew) {
      showNotification('圖片將在更新貼文時刪除');
    }
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
            isNew: true // 標記為新圖片
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
  const handleNewImageAnnotations = async (updatedPostData, newImages) => {
    const { createAnnotation } = await import('../services/socialService');
    
    try {
      // 檢查新增圖片是否有標註需要處理
      for (const [imageId, annotations] of Object.entries(pendingChanges.annotationChanges)) {
        // 查找新增圖片
        const localImage = postData.images.find(img => img.id && img.id.toString() === imageId && img.isNew);
        
        if (!localImage || !annotations || annotations.length === 0) {
          continue;
        }
        
        // 找到對應的服務器圖片
        const newImageIndex = newImages.indexOf(localImage);
        if (newImageIndex === -1) continue;
        
        // 從更新後的貼文資料中找到對應的圖片
        const allImages = updatedPostData.images || [];
        const originalImageCount = originalPostData.images.length;
        const serverImage = allImages.find(img => 
          img.sort_order >= originalImageCount && 
          allImages.indexOf(img) - originalImageCount === newImageIndex
        );
        
        if (!serverImage || !serverImage.firebase_url) {
          continue;
        }
        
        // 為這個圖片創建標註
        for (const annotation of annotations) {
          if (!annotation.id) { // 只處理新標註
            const createResult = await createAnnotation({
              firebase_url: serverImage.firebase_url,
              x_position: annotation.x_position,
              y_position: annotation.y_position,
              target_type: annotation.target_type,
              target_id: annotation.target_id
            });
            
            if (!createResult.success) {
              console.error(`為新圖片創建標註失敗: ${createResult.error}`);
            }
          }
        }
      }
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
        const originalImageCount = originalPostData.images.length;
        const deletedImageCount = pendingChanges.deletedImageIds.length;
        const newImagesCount = postData.images.filter(img => img.isNew).length;
        const finalImageCount = originalImageCount - deletedImageCount + newImagesCount;
        
        if (finalImageCount < 1) {
          throw new Error('貼文至少需要保留一張圖片');
        }
        
        for (const imageId of pendingChanges.deletedImageIds) {
          const deleteResult = await deletePostImage(postId, imageId);
          if (!deleteResult.success) {
            throw new Error(`刪除圖片失敗: ${deleteResult.error}`);
          }
        }
      }
      
      // 2. 處理圖片排序
      if (pendingChanges.imageOrderChanges) {
        const reorderResult = await reorderPostImages(postId, pendingChanges.imageOrderChanges);
        if (!reorderResult.success) {
          throw new Error(`更新圖片順序失敗: ${reorderResult.error}`);
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
        
        // 添加新圖片文件
        newImages.forEach(image => {
          formData.append('images', image.file);
        });
        
        
        const result = await updatePost(postId, formData, true); // 第三個參數表示使用 FormData
        
        if (result.success) {
          // 圖片上傳成功後，處理新增圖片的標註
          if (result.data) {
            await handleNewImageAnnotations(result.data, newImages);
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