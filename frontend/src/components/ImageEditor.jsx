/**
 * ImageEditor 組件 - 圖片標註編輯器
 * 
 * 標註資料格式 (符合後端 ImageAnnotation API):
 * {
 *   id: number,                    // 前端臨時ID
 *   x_position: number,            // X 座標（百分比 0-100）
 *   y_position: number,            // Y 座標（百分比 0-100）  
 *   display_name: string,          // 標註顯示名稱
 *   target_type: 'user' | 'pet',   // 標註目標類型
 *   target_id: number,             // 標註目標ID（用戶ID或寵物ID）
 *   created_by: number | null,     // 創建者ID（將在同步到後端時設置）
 *   // firebase_url: string,       // 圖片Firebase URL（暫時跳過）
 * }
 * 
 * 後端同步格式:
 * POST /api/v1/social/annotations/
 * {
 *   "firebase_url": "圖片Firebase URL",
 *   "x_position": 座標,
 *   "y_position": 座標,
 *   "display_name": "顯示名稱",
 *   "target_type": "user/pet",
 *   "target_id": 目標ID
 * }
 */
import React, { useState, useRef, useEffect } from 'react';
import styles from '../styles/ImageEditor.module.css';
import Annotation from './Annotation';
import { getUserPets } from '../services/petService';
import { checkAnnotationPermission } from '../services/socialService';

const ImageEditor = ({ image, isOpen, onClose, onSave, mode = 'create' }) => {
  const [annotations, setAnnotations] = useState([]);
  const [showAnnotations, setShowAnnotations] = useState(false);
  const [showAnnotationDots, setShowAnnotationDots] = useState(false);
  const [editingAnnotation, setEditingAnnotation] = useState(null);
  const [newAnnotation, setNewAnnotation] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [annotationType, setAnnotationType] = useState('user'); // 'user' or 'pet'
  const [selectedPet, setSelectedPet] = useState('');
  const [userPets, setUserPets] = useState([]);
  const [isLoadingPets, setIsLoadingPets] = useState(false);
  const imageRef = useRef(null);
  const modalRef = useRef(null);

  // Debug logging
  useEffect(() => {
    if (image) {
      const imageUrl = image.dataUrl || image.preview || image.url || image.firebase_url;
      console.log('ImageEditor received image:', {
        id: image.id,
        dataUrl: image.dataUrl ? 'present' : 'missing',
        preview: image.preview ? 'present' : 'missing',
        url: image.url ? 'present' : 'missing',
        firebase_url: image.firebase_url ? 'present' : 'missing',
        actualUrl: imageUrl,
        annotations: image.annotations
      });
    }
  }, [image]);

  // 標註資料的 localStorage 鍵名
  const ANNOTATIONS_KEY = 'imageAnnotations';

  // 載入標註資料
  useEffect(() => {
    if (image?.id) {
      loadAnnotations();
    }
  }, [image?.id, image?.annotations]);

  // 載入用戶寵物資料
  useEffect(() => {
    if (isOpen) {
      loadUserPets();
    }
  }, [isOpen]);

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

  // 載入標註資料
  const loadAnnotations = () => {
    try {
      if (mode === 'edit') {
        // edit 模式：從後端傳入的資料載入標註
        if (image?.annotations && image.annotations.length > 0) {
          const convertedAnnotations = image.annotations.map(convertLegacyAnnotation);
          setAnnotations(convertedAnnotations);
        } else {
          setAnnotations([]);
        }
      } else {
        // create 模式：從 localStorage 載入標註
        const savedAnnotations = localStorage.getItem(ANNOTATIONS_KEY);
        if (savedAnnotations) {
          const allAnnotations = JSON.parse(savedAnnotations);
          const imageAnnotations = allAnnotations[image.id] || [];
          // 轉換格式並設置標註
          const convertedAnnotations = imageAnnotations.map(convertLegacyAnnotation);
          setAnnotations(convertedAnnotations);
        } else {
          setAnnotations([]);
        }
      }
    } catch (error) {
      console.error('載入標註資料失敗:', error);
      setAnnotations([]);
    }
  };

  // 同步標註到後端 (暫時為佔位符函數)
  const syncAnnotationsToBackend = async (annotations, imageFirebaseUrl) => {
    // TODO: 實作與後端的同步功能
    // 當 firebase_url 可用時，調用後端 API：
    // POST /api/v1/social/annotations/
    console.log('將來同步到後端的標註資料:', {
      annotations: annotations.map(ann => ({
        firebase_url: imageFirebaseUrl || 'TBD',
        x_position: ann.x_position,
        y_position: ann.y_position,
        display_name: ann.display_name,
        target_type: ann.target_type,
        target_id: ann.target_id
      }))
    });
  };

  // 載入用戶寵物資料
  const loadUserPets = async () => {
    setIsLoadingPets(true);
    try {
      const pets = await getUserPets();
      console.log('載入的寵物資料:', pets);
      setUserPets(pets);
    } catch (error) {
      console.error('載入寵物資料失敗:', error);
    } finally {
      setIsLoadingPets(false);
    }
  };

  // 保存標註資料到 localStorage
  const saveAnnotations = (newAnnotations) => {
    try {
      const savedAnnotations = localStorage.getItem(ANNOTATIONS_KEY);
      const allAnnotations = savedAnnotations ? JSON.parse(savedAnnotations) : {};
      allAnnotations[image.id] = newAnnotations;
      localStorage.setItem(ANNOTATIONS_KEY, JSON.stringify(allAnnotations));
    } catch (error) {
      console.error('保存標註資料失敗:', error);
    }
  };

  // 處理圖片點擊 - 新增標註
  const handleImageClick = (e) => {
    if (!showAnnotations) return;

    const rect = imageRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    // 檢查是否點擊到現有標註
    const clickedAnnotation = annotations.find(annotation => {
      const distance = Math.sqrt(
        Math.pow(annotation.x - x, 2) + Math.pow(annotation.y - y, 2)
      );
      return distance < 5; // 5% 的容錯範圍
    });

    if (clickedAnnotation) {
      // 編輯現有標註
      setEditingAnnotation(clickedAnnotation);
      setSearchQuery(clickedAnnotation.displayName || '');
    } else {
      // 新增標註
      const tempAnnotation = {
        id: Date.now(),
        x_position: x,
        y_position: y,
        imageId: image.id,
        display_name: '',
        target_id: null,
        target_type: 'user', // 'user' 或 'pet'
        // firebase_url: '', // 暫時跳過，後續添加
        created_by: null // 將在保存時設置為當前用戶
      };
      setNewAnnotation(tempAnnotation);
      setSearchQuery('');
    }
  };

  // 確認新增標註
  const handleAddAnnotation = async () => {
    let displayName = '';
    let targetId = '';
    
    if (annotationType === 'user') {
      if (!searchQuery.trim()) {
        return;
      }
      
      // 驗證使用者標註權限
      try {
        const result = await checkAnnotationPermission(searchQuery.trim());
        if (!result.success || !result.data.can_annotate) {
          return;
        }
        displayName = result.data.user_info.user_fullname || result.data.user_info.user_account;
        targetId = result.data.user_info.user_account;
      } catch (error) {
        return;
      }
    } else {
      if (!selectedPet) {
        return;
      }
      if (isLoadingPets) {
        return;
      }
      const pet = userPets.find(p => String(p.pet_id) === String(selectedPet));
      if (!pet) {
        console.error('找不到寵物 (新增):', selectedPet, 'userPets:', userPets.map(p => ({ pet_id: p.pet_id, name: p.pet_name, type: typeof p.pet_id })));
        return;
      }
      displayName = pet.pet_name;
      targetId = pet.pet_id;
    }

    const annotation = {
      ...newAnnotation,
      display_name: displayName,
      target_id: targetId,
      target_type: annotationType,
      created_by: null // 將在實際保存到後端時設置
    };

    const updatedAnnotations = [...annotations, annotation];
    setAnnotations(updatedAnnotations);
    saveAnnotations(updatedAnnotations);
    
    setNewAnnotation(null);
    setSearchQuery('');
    setAnnotationType('user');
    setSelectedPet('');
  };

  // 更新標註
  const handleUpdateAnnotation = async () => {
    let displayName = '';
    let targetId = '';
    
    if (annotationType === 'user') {
      if (!searchQuery.trim()) {
        return;
      }
      
      // 驗證使用者標註權限
      try {
        const result = await checkAnnotationPermission(searchQuery.trim());
        if (!result.success || !result.data.can_annotate) {
          return;
        }
        displayName = result.data.user_info.user_fullname || result.data.user_info.user_account;
        targetId = result.data.user_info.user_account;
      } catch (error) {
        return;
      }
    } else {
      if (!selectedPet) {
        return;
      }
      if (isLoadingPets) {
        return;
      }
      const pet = userPets.find(p => String(p.pet_id) === String(selectedPet));
      if (!pet) {
        console.error('找不到寵物 (更新):', selectedPet, 'userPets:', userPets.map(p => ({ pet_id: p.pet_id, name: p.pet_name, type: typeof p.pet_id })));
        return;
      }
      displayName = pet.pet_name;
      targetId = pet.pet_id;
    }

    const updatedAnnotations = annotations.map(annotation =>
      annotation.id === editingAnnotation.id
        ? { ...annotation, display_name: displayName, target_id: targetId, target_type: annotationType }
        : annotation
    );

    setAnnotations(updatedAnnotations);
    saveAnnotations(updatedAnnotations);
    
    setEditingAnnotation(null);
    setSearchQuery('');
    setAnnotationType('user');
    setSelectedPet('');
  };

  // 刪除標註
  const handleDeleteAnnotation = () => {
    const updatedAnnotations = annotations.filter(
      annotation => annotation.id !== editingAnnotation.id
    );
    
    setAnnotations(updatedAnnotations);
    saveAnnotations(updatedAnnotations);
    
    setEditingAnnotation(null);
    setSearchQuery('');
  };

  // 取消編輯
  const handleCancelEdit = () => {
    setNewAnnotation(null);
    setEditingAnnotation(null);
    setSearchQuery('');
    setAnnotationType('user');
    setSelectedPet('');
  };

  // 切換標註顯示
  const toggleAnnotations = () => {
    setShowAnnotations(!showAnnotations);
    // 如果關閉標註模式，也關閉編輯狀態
    if (showAnnotations) {
      handleCancelEdit();
      setShowAnnotationDots(false);
    }
  };

  // 切換標註點顯示
  const toggleAnnotationDots = () => {
    setShowAnnotationDots(!showAnnotationDots);
  };

  // 處理保存並關閉
  const handleSaveAndClose = () => {
    // 傳回完整的圖片物件，包含更新後的 annotations
    const updatedImage = {
      ...image,
      annotations: annotations
    };
    onSave && onSave(updatedImage);
    onClose();
  };

  // 處理關閉
  const handleClose = () => {
    setShowAnnotations(false);
    handleCancelEdit();
    onClose();
  };

  if (!isOpen || !image) return null;

  // Get the image source
  const imageSrc = image.dataUrl || image.preview || image.url || image.firebase_url;
  
  if (!imageSrc) {
    console.error('No valid image source found in ImageEditor');
    return null;
  }

  return (
    <div className={styles.modalOverlay}>
      <div ref={modalRef} className={styles.modalContainer}>
        <div className={styles.modalHeader}>
          <h2>編輯圖片</h2>
        </div>

        <div className={styles.modalBody}>
          {/* 圖片區域 */}
          <div className={styles.imageContainer}>
            <img
              ref={imageRef}
              src={imageSrc}
              alt="編輯圖片"
              className={styles.editImage}
              onClick={handleImageClick}
              onError={(e) => {
                console.error('Failed to load image in ImageEditor:', {
                  attemptedSrc: e.target.src,
                  imageObject: image
                });
                // Set a fallback image
                e.target.src = '/assets/icon/DefaultAvatar.jpg';
              }}
              onLoad={() => {
                console.log('Image loaded successfully in ImageEditor with src:', imageSrc);
              }}
            />

            {/* 標註圖示 - 左下角 */}
            {annotations.length > 0 && (
              <div 
                className={styles.annotationIcon}
                onClick={toggleAnnotationDots}
                title={`${annotations.length} 個標註`}
              >
                <img 
                  src="/assets/icon/PostAnnotation.png" 
                  alt="標註" 
                  className={styles.annotationIconImage}
                  onError={(e) => {
                    console.error('Failed to load annotation icon:', e.target.src);
                    e.target.style.display = 'none';
                    e.target.parentElement.innerHTML = '@';
                    e.target.parentElement.style.fontSize = '14px';
                    e.target.parentElement.style.fontWeight = 'bold';
                    e.target.parentElement.style.color = '#F08651';
                  }}
                  onLoad={() => console.log('Annotation icon loaded successfully')}
                />
              </div>
            )}

            {/* 標註點 */}
            {showAnnotationDots && annotations.map((annotation) => (
              <Annotation
                key={annotation.id}
                annotation={annotation}
                x={annotation.x_position}
                y={annotation.y_position}
                isVisible={true}
                onClick={(e) => {
                  e.stopPropagation();
                  if (showAnnotations) {
                    setEditingAnnotation(annotation);
                    setAnnotationType(annotation.target_type || 'user');
                    if (annotation.target_type === 'pet') {
                      // 確保 target_id 是字串格式
                      setSelectedPet(String(annotation.target_id));
                      setSearchQuery('');
                    } else {
                      setSearchQuery(annotation.display_name || '');
                      setSelectedPet('');
                    }
                  }
                }}
              />
            ))}

            {/* 新標註預覽 */}
            {newAnnotation && (
              <div
                className={styles.annotationPoint}
                style={{
                  left: `${newAnnotation.x_position}%`,
                  top: `${newAnnotation.y_position}%`
                }}
              >
                <div className={`${styles.annotationDot} ${styles.newDot}`}></div>
              </div>
            )}
          </div>

          {/* 工具列 - 移動到圖片下方 */}
          <div className={styles.buttonBar}>
            <div className={styles.leftButtons}>
              <button 
                className={`${styles.toolButton} ${showAnnotations ? styles.active : ''}`}
                onClick={toggleAnnotations}
              >
                標註
              </button>
              <button className={styles.toolButton}>
                貼圖
              </button>
            </div>
            <div className={styles.rightButtons}>
              <button 
                className={styles.cancelButton}
                onClick={handleClose}
              >
                取消
              </button>
              <button 
                className={styles.saveButton}
                onClick={handleSaveAndClose}
              >
                完成
              </button>
            </div>
          </div>

          {/* 編輯面板 */}
          {(newAnnotation || editingAnnotation) && (
            <div className={styles.editPanel}>
              <div className={styles.inputRow}>
                <div className={styles.typeSelector}>
                  <label>標註類型</label>
                  <select
                    value={annotationType}
                    onChange={(e) => {
                      setAnnotationType(e.target.value);
                      setSearchQuery('');
                      setSelectedPet('');
                    }}
                    className={styles.typeSelect}
                  >
                    <option value="user">其他使用者</option>
                    <option value="pet">寵物</option>
                  </select>
                </div>
                
                <div className={styles.inputGroup}>
                  <label>標註內容</label>
                  {annotationType === 'user' ? (
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="輸入使用者名稱"
                      className={styles.searchInput}
                    />
                  ) : (
                    <select
                      value={selectedPet}
                      onChange={(e) => setSelectedPet(e.target.value)}
                      className={styles.searchInput}
                      disabled={isLoadingPets}
                    >
                      <option value="">{isLoadingPets ? '載入中...' : '選擇寵物'}</option>
                      {userPets.map((pet, index) => (
                        <option key={`pet-${pet.pet_id || index}`} value={pet.pet_id}>
                          {pet.pet_name} ({pet.pet_type === 'dog' ? '狗' : '貓'})
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
              
              <div className={styles.editActions}>
                <button 
                  className={styles.editCancelButton}
                  onClick={handleCancelEdit}
                >
                  取消
                </button>
                
                {editingAnnotation ? (
                  <>
                    <button 
                      className={styles.deleteButton}
                      onClick={handleDeleteAnnotation}
                    >
                      刪除
                    </button>
                    <button 
                      className={styles.confirmButton}
                      onClick={handleUpdateAnnotation}
                    >
                      更新
                    </button>
                  </>
                ) : (
                  <button 
                    className={styles.confirmButton}
                    onClick={handleAddAnnotation}
                  >
                    新增
                  </button>
                )}
              </div>
            </div>
          )}

          {/* 提示文字 */}
          {showAnnotations && !newAnnotation && !editingAnnotation && (
            <div className={styles.hintText}>
              點擊圖片任意位置新增標註，點擊現有標註進行編輯
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImageEditor; 