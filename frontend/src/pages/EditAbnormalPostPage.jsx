import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import TopNavbar from '../components/TopNavbar';
import BottomNavbar from '../components/BottomNavigationbar';
import Notification from '../components/Notification';
import ConfirmNotification from '../components/ConfirmNotification';
import { NotificationProvider } from '../context/NotificationContext';
import { getUserPets, getSymptoms, getAbnormalPostDetail, updateAbnormalPost } from '../services/petService';
import { useSymptomTranslation } from '../hooks/useSymptomTranslation';
import styles from '../styles/CreateAbnormalPostPage.module.css';

const EditAbnormalPostPage = () => {
  const { t } = useTranslation('posts');
  const { translateSymptomList, translateSingleSymptom, reverseTranslateSymptoms } = useSymptomTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { petId, postId } = useParams();
  const fileInputRef = useRef(null);
  
  // State management
  const [allPets, setAllPets] = useState([]);
  const [selectedPet, setSelectedPet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(null);
  const [isEmergency, setIsEmergency] = useState(false);
  const [selectedSymptoms, setSelectedSymptoms] = useState([]);
  const [selectedSymptomOption, setSelectedSymptomOption] = useState('');
  const [availableSymptoms, setAvailableSymptoms] = useState([]);
  const [bodyStats, setBodyStats] = useState({
    weight: '',
    waterIntake: '',
    temperature: ''
  });
  const [selectedImages, setSelectedImages] = useState([]);
  const [description, setDescription] = useState('');
  const [notification, setNotification] = useState('');
  const [showConfirmNotification, setShowConfirmNotification] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState('');
  const [confirmAction, setConfirmAction] = useState(null);
  const [cancelAction, setCancelAction] = useState(null);
  const [hasChanges, setHasChanges] = useState(false);
  
  // Track change state (reference EditPostPage)
  const [pendingChanges, setPendingChanges] = useState({
    deletedImageIds: [] // Original image IDs to delete
  });
  const [originalData, setOriginalData] = useState(null);
  
  // Refs
  const symptomContainerRef = useRef(null);
  const imagePreviewContainerRef = useRef(null);
  const isInitialLoad = useRef(true);
  const hiddenDateInputRef = useRef(null);

  // Load abnormal post data
  useEffect(() => {
    loadAbnormalPostData();
  }, [petId, postId]);

  // Get pet data
  useEffect(() => {
    const fetchPets = async () => {
      try {
        const pets = await getUserPets();
        
        if (pets && pets.length > 0) {
          const formattedPets = pets.map(pet => ({
            id: pet.pet_id,
            pet_name: pet.pet_name,
            avatarUrl: pet.headshot_url,
            age: pet.age,
            breed: pet.breed
          }));
          
          setAllPets(formattedPets);
          
          // After pet list is loaded, set originally selected pet
          const originalPet = formattedPets.find(p => p.id === parseInt(petId));
          if (originalPet) {
            setSelectedPet(originalPet);
          }
        }
      } catch (error) {
        console.error('Failed to get pet data:', error);
        showNotification(t('createAbnormalPost.messages.petDataLoadFailed'));
      }
    };

    fetchPets();
  }, []);

  // Get symptom list
  useEffect(() => {
    const fetchSymptoms = async () => {
      try {
        const symptoms = await getSymptoms();
        const symptomNames = symptoms.map(symptom =>
          typeof symptom === 'string' ? symptom : symptom.symptom_name
        ).filter(name => typeof name === 'string');

        // Translate symptom names to current interface language
        const translatedSymptomNames = translateSymptomList(symptomNames);
        setAvailableSymptoms(translatedSymptomNames);
      } catch (error) {
        console.error('Failed to get symptom list:', error);
        // If API fails, use default symptom list
        setAvailableSymptoms(t('createAbnormalPost.defaultSymptoms', { returnObjects: true }));
      }
    };

    fetchSymptoms();
  }, [translateSymptomList, t]);

  // Handle mouse wheel horizontal scrolling - symptom container
  React.useEffect(() => {
    const container = symptomContainerRef.current;
    if (!container || selectedSymptoms.length === 0) return;

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
  });

  // Handle mouse wheel horizontal scrolling - image container
  React.useEffect(() => {
    const container = imagePreviewContainerRef.current;
    if (!container || selectedImages.length === 0) return;

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
  });

  // Load abnormal post data
  const loadAbnormalPostData = async () => {
    try {
      setLoading(true);
      const postData = await getAbnormalPostDetail(petId, postId);
      
      if (postData) {
        // Set date
        if (postData.record_date) {
          setSelectedDate(new Date(postData.record_date));
        }
        
        // Set whether it's an emergency record
        setIsEmergency(postData.is_emergency || false);
        
        // Set symptoms
        if (postData.symptoms && Array.isArray(postData.symptoms)) {
          const formattedSymptoms = postData.symptoms.map((symptom, index) => ({
            id: Date.now() + index,
            text: symptom.symptom_name
          }));
          setSelectedSymptoms(formattedSymptoms);
        }
        
        // Set body stats
        setBodyStats({
          weight: postData.weight || '',
          waterIntake: postData.water_amount ? (postData.water_amount / 1000).toString() : '', // Convert from milliliters to liters
          temperature: postData.body_temperature || ''
        });
        
        // Set description
        setDescription(postData.content || '');
        
        // Save original data for comparison
        setOriginalData({
          petId: parseInt(petId),
          date: postData.record_date,
          isEmergency: postData.is_emergency || false,
          symptoms: postData.symptoms ? postData.symptoms.map(s => s.symptom_name) : [],
          bodyStats: {
            weight: postData.weight || '',
            waterIntake: postData.water_amount ? (postData.water_amount / 1000).toString() : '',
            temperature: postData.body_temperature || ''
          },
          description: postData.content || '',
          imageIds: postData.images ? postData.images.map(img => img.id) : []
        });
        
        // Set images - convert to preview format
        if (postData.images && Array.isArray(postData.images)) {
          const imagePromises = postData.images.map(async (image, index) => {
            try {
              const imageUrl = image.url || image.firebase_url;
              if (!imageUrl) return null;
              
              // Use existing URL as preview
              const imageData = {
                id: image.id, // 使用真實的資料庫 ID
                preview: imageUrl,
                dataUrl: imageUrl,
                file: null, // In edit mode, existing images don't have File objects
                isNew: false, // Mark as original image (reference EditPostPage)
                existingId: image.id // Maintain backward compatibility
              };
              console.log('Loading existing image:', { id: image.id, type: typeof image.id, imageData });
              return imageData;
            } catch (error) {
              console.error('Failed to process image:', error);
              return null;
            }
          });
          
          const images = await Promise.all(imagePromises);
          const validImages = images.filter(img => img !== null);
          setSelectedImages(validImages);
        }
      } else {
        showNotification(t('abnormalPostDetail.messages.postNotFound'));
        navigate(`/pet/${petId}/abnormal-posts`);
      }
    } catch (error) {
      console.error('Failed to load abnormal post:', error);
      showNotification(t('editAbnormalPost.messages.loadPostFailed'));
      navigate(`/pet/${petId}/abnormal-posts`);
    } finally {
      setLoading(false);
      // After initial load completes, start monitoring changes later
      setTimeout(() => {
        isInitialLoad.current = false;
      }, 1000);
    }
  };

  // Check if there are changes
  const checkForChanges = () => {
    if (!originalData || isInitialLoad.current) return false;
    
    const currentData = {
      petId: selectedPet ? selectedPet.id : null,
      date: selectedDate ? 
        `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}T12:00:00Z` 
        : null,
      isEmergency,
      symptoms: selectedSymptoms.map(s => s.text).sort(),
      bodyStats: {
        weight: bodyStats.weight,
        waterIntake: bodyStats.waterIntake,
        temperature: bodyStats.temperature
      },
      description,
      imageIds: selectedImages.filter(img => !img.isNew).map(img => img.id).sort()
    };
    
    const originalDate = originalData.date ? 
      `${new Date(originalData.date).getFullYear()}-${String(new Date(originalData.date).getMonth() + 1).padStart(2, '0')}-${String(new Date(originalData.date).getDate()).padStart(2, '0')}T12:00:00Z` 
      : null;
    
    const changed = 
      currentData.petId !== originalData.petId ||
      currentData.date !== originalDate ||
      currentData.isEmergency !== originalData.isEmergency ||
      JSON.stringify(currentData.symptoms.sort()) !== JSON.stringify(originalData.symptoms.sort()) ||
      currentData.bodyStats.weight !== originalData.bodyStats.weight ||
      currentData.bodyStats.waterIntake !== originalData.bodyStats.waterIntake ||
      currentData.bodyStats.temperature !== originalData.bodyStats.temperature ||
      currentData.description !== originalData.description ||
      JSON.stringify(currentData.imageIds.sort()) !== JSON.stringify(originalData.imageIds.sort()) ||
      selectedImages.some(img => img.isNew) || // Has new images
      pendingChanges.deletedImageIds.length > 0; // Has deleted images
    
    return changed;
  };
  
  // Monitor data changes
  useEffect(() => {
    const changed = checkForChanges();
    setHasChanges(changed);
  }, [selectedDate, isEmergency, selectedSymptoms, bodyStats, description, selectedImages, originalData, pendingChanges]);
  
  // Handle page leave confirmation (browser close/refresh)
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [hasChanges]);
  
  // Handle route navigation abandon confirmation - intercept browser back button
  useEffect(() => {
    let isConfirming = false;
    
    const handlePopState = (event) => {
      if (hasChanges && !isConfirming) {
        // Prevent default back behavior
        window.history.pushState(null, '', window.location.pathname + window.location.search);
        
        isConfirming = true;
        
        showConfirmDialog(
          t('editAbnormalPost.messages.confirmAbandonEdit'),
          () => {
            isConfirming = false;
            // Jump directly to target page
            navigate(`/pet/${petId}/abnormal-post/${postId}`, { replace: true });
          },
          () => {
            isConfirming = false;
            // Stay on current page
          }
        );
      }
    };
    
    if (hasChanges) {
      // Add a history state for interception
      window.history.pushState(null, '', window.location.pathname + window.location.search);
      window.addEventListener('popstate', handlePopState);
      
      return () => {
        window.removeEventListener('popstate', handlePopState);
      };
    }
  }, [hasChanges, navigate, petId, postId]);

  // Show notification
  const showNotification = (msg) => {
    setNotification(msg);
  };

  // Hide notification
  const hideNotification = () => {
    setNotification('');
  };

  // Show confirmation notification
  const showConfirmDialog = (message, onConfirm, onCancel = null) => {
    setConfirmMessage(message);
    setConfirmAction(() => onConfirm);
    setCancelAction(() => onCancel);
    setShowConfirmNotification(true);
  };

  // Handle confirmation notification confirm button
  const handleConfirmAction = () => {
    if (confirmAction) {
      confirmAction();
    }
    setShowConfirmNotification(false);
    setConfirmAction(null);
    setCancelAction(null);
  };

  // Handle confirmation notification cancel button
  const handleCancelAction = () => {
    if (cancelAction) {
      cancelAction();
    }
    setShowConfirmNotification(false);
    setConfirmAction(null);
    setCancelAction(null);
  };

  // Handle symptom addition
  const handleAddSymptom = () => {
    if (!selectedSymptomOption) {
      showNotification(t('createAbnormalPost.messages.selectSymptom'));
      return;
    }
    
    if (selectedSymptoms.some(symptom => symptom.text === selectedSymptomOption)) {
      showNotification(t('createAbnormalPost.messages.symptomExists'));
      return;
    }
    
    if (selectedSymptoms.length >= 10) {
      showNotification(t('createAbnormalPost.messages.maxSymptomsReached'));
      return;
    }
    
    const newSymptom = {
      id: Date.now() + Math.random(),
      text: selectedSymptomOption
    };
    
    setSelectedSymptoms(prev => [...prev, newSymptom]);
    setSelectedSymptomOption('');
  };

  // Remove symptom
  const handleRemoveSymptom = (symptomId) => {
    setSelectedSymptoms(prev => prev.filter(s => s.id !== symptomId));
  };

  // Handle pet selection
  const handlePetSelect = (pet) => {
    if (selectedPet?.id !== pet.id) {
      // If switching pet, confirm first
      showConfirmDialog(
        t('editAbnormalPost.messages.confirmSwitchPet'),
        () => {
          setSelectedPet(pet);
        },
        () => {
          // Cancel switch, keep original pet
        }
      );
    }
  };

  // 格式化日期為 input[type="date"] 格式
  const formatDateForInput = (date) => {
    if (!date) return '';
    return date.getFullYear() + '-' +
           String(date.getMonth() + 1).padStart(2, '0') + '-' +
           String(date.getDate()).padStart(2, '0');
  };

  // 處理日期變更
  const handleDateChange = (e) => {
    const dateValue = e.target.value; // YYYY-MM-DD format
    if (!dateValue) {
      setSelectedDate(null);
      return;
    }
    const date = new Date(dateValue);
    setSelectedDate(date);
  };

  // 處理日期輸入框點擊前的驗證
  const handleDateInputClick = (e) => {
    // 編輯模式下不需要特別驗證
    return true;
  };

  // 格式化日期顯示
  const formatDateDisplay = (date) => {
    if (!date) return t('common.selectDate');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${month}/${day}`;
  };

  // Handle body stats change
  const handleBodyStatChange = (stat, value) => {
    // Ensure value is not negative
    const numericValue = parseFloat(value);
    if (value !== '' && (isNaN(numericValue) || numericValue < 0)) {
      return; // Ignore invalid or negative input
    }
    
    setBodyStats(prev => ({
      ...prev,
      [stat]: value
    }));
  };

  // Handle image selection
  const handleImageSelect = (e) => {
    const files = Array.from(e.target.files);
    
    if (selectedImages.length + files.length > 10) {
      showNotification(t('createAbnormalPost.messages.maxImagesReached'));
      return;
    }

    // Check each file
    for (let file of files) {
      if (file.size > 5 * 1024 * 1024) {
        showNotification(t('createAbnormalPost.messages.imageTooLarge'));
        return;
      }
      
      if (!file.type.startsWith('image/')) {
        showNotification(t('createAbnormalPost.messages.invalidFileType'));
        return;
      }
    }

    // Create preview images
    const newImagePromises = files.map(file => {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          resolve({
            file,
            preview: e.target.result,
            dataUrl: e.target.result,
            id: Date.now() + Math.random(), // Temporary ID (reference EditPostPage)
            isNew: true // Mark as new image (reference EditPostPage)
          });
        };
        reader.onerror = () => {
          console.error('Failed to read image:', file.name);
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

  // Remove image (reference EditPostPage logic)
  const handleRemoveImage = (imageId) => {
    const imageToDelete = selectedImages.find(img => img.id === imageId);
    if (!imageToDelete) return;
    
    // Frontend immediately removes display
    const updatedImages = selectedImages.filter(img => img.id !== imageId);
    setSelectedImages(updatedImages);
    
    // Only original images are added to delete list
    if (!imageToDelete.isNew) {
      setPendingChanges(prev => ({
        ...prev,
        deletedImageIds: [...prev.deletedImageIds, imageToDelete.id]
      }));
    }
  };

  // Add image button click
  const handleAddImage = () => {
    if (selectedImages.length >= 10) {
      showNotification(t('createAbnormalPost.messages.maxImagesReached'));
      return;
    }
    fileInputRef.current?.click();
  };

  // Handle back button
  const handleBack = () => {
    if (hasChanges) {
      showConfirmDialog(
        t('editAbnormalPost.messages.confirmAbandonEdit'),
        () => {
          navigate(`/pet/${petId}/abnormal-post/${postId}`);
        }
      );
    } else {
      navigate(`/pet/${petId}/abnormal-post/${postId}`);
    }
  };

  // Handle update button
  const handleUpdate = () => {
    // Form validation
    if (!selectedPet) {
      showNotification(t('createAbnormalPost.messages.selectPet'));
      return;
    }
    if (!selectedDate) {
      showNotification(t('createAbnormalPost.messages.selectDate'));
      return;
    }
    if (selectedSymptoms.length === 0) {
      showNotification(t('createAbnormalPost.messages.selectAtLeastOneSymptom'));
      return;
    }
    
    // Update post
    handleUpdatePost();
  };

  // Update post
  const handleUpdatePost = async () => {
    try {
      setLoading(true);
      
      // Prepare post data
      const postData = {
        pet: {
          id: selectedPet.id
        },
        date: selectedDate ? 
          `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}T12:00:00Z` 
          : null,
        isEmergency,
        symptoms: reverseTranslateSymptoms(selectedSymptoms).map(symptom => ({
          text: typeof symptom === 'string' ? symptom : symptom.text
        })),
        bodyStats: {
          weight: bodyStats.weight,
          waterIntake: bodyStats.waterIntake,
          temperature: bodyStats.temperature
        },
        images: selectedImages.map(img => {
          if (!img.isNew) {
            // Existing image (reference EditPostPage)
            return {
              id: img.id,
              isExisting: true
            };
          } else {
            // New image (reference EditPostPage)
            return {
              dataUrl: img.dataUrl,
              name: img.file?.name || `image_${Date.now()}.jpg`,
              isExisting: false
            };
          }
        }),
        description
      };
      
      console.log('Prepared postData to send:', JSON.stringify(postData, null, 2));
      console.log('selectedImages details:', selectedImages.map(img => ({
        id: img.id,
        isNew: img.isNew,
        preview: img.preview?.substring(0, 50) + '...',
        hasFile: !!img.file
      })));
      
      // Call update API - use selected pet ID
      const result = await updateAbnormalPost(selectedPet.id, postId, postData);
      console.log('Successfully updated abnormal post:', result);
      
      // Clear change state after successful update (reference EditPostPage)
      setHasChanges(false);
      setPendingChanges({
        deletedImageIds: []
      });
      
      showNotification(t('editAbnormalPost.messages.updateSuccess'));
      
      // Decide navigation target based on whether pet was switched
      setTimeout(() => {
        // Prepare navigation state
        const navigationState = {
          fromEdit: true,
          fromDiseaseArchive: location.state?.fromDiseaseArchive,
          diseaseArchiveId: location.state?.diseaseArchiveId
        };
        
        if (selectedPet.id !== parseInt(petId)) {
          // Switched pet, navigate to the new pet's abnormal post detail page
          navigate(`/pet/${selectedPet.id}/abnormal-post/${postId}`, { 
            replace: true,
            state: navigationState
          });
        } else {
          // No pet switch, return to original detail page
          navigate(`/pet/${petId}/abnormal-post/${postId}`, { 
            replace: true,
            state: navigationState
          });
        }
      }, 1500);
      
    } catch (error) {
      console.error('Failed to update abnormal post:', error);
      
      // Handle different types of errors
      let errorMessage = t('editAbnormalPost.messages.updateFailed');
      
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.response?.status === 400) {
        errorMessage = t('editAbnormalPost.messages.invalidData');
      } else if (error.response?.status === 401) {
        errorMessage = t('editAbnormalPost.messages.pleaseLogin');
      } else if (error.response?.status === 404) {
        errorMessage = t('editAbnormalPost.messages.postNotFound');
      } else if (error.response?.status >= 500) {
        errorMessage = t('editAbnormalPost.messages.serverError');
      }
      
      showNotification(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Render page content
  const renderContent = () => (
    <>
      <div className={styles.titleSection}>
        <h2 className={styles.title}>{t('editAbnormalPost.title')}</h2>
      </div>
      <div className={styles.divider}></div>
      
      {/* Pet selection section */}
      <div className={styles.section}>
        <label className={styles.sectionLabel}>{t('createAbnormalPost.sections.selectPet')}:</label>
        <div className={styles.petSwitcher}>
          {allPets.map((pet) => (
            <div
              key={pet.id}
              className={`${styles.petItem} ${selectedPet?.id === pet.id ? styles.activePet : ''}`}
              onClick={() => handlePetSelect(pet)}
            >
              <img
                src={pet.avatarUrl || '/assets/icon/DefaultAvatar.jpg'}
                alt={pet.pet_name}
                className={styles.petAvatar}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Date selection */}
      <div className={styles.section}>
        <div className={styles.dateRow}>
          <div className={styles.dateSection}>
            <label className={styles.dateLabel}>{t('createAbnormalPost.dateSelection.date')}</label>
            <div className={styles.dateInputWrapper}>
              <input
                ref={hiddenDateInputRef}
                type="date"
                className={styles.dateInput}
                value={formatDateForInput(selectedDate)}
                onChange={handleDateChange}
                onClick={handleDateInputClick}
              />
              <span className={styles.datePlaceholder}>
                {selectedDate ? formatDateDisplay(selectedDate) : t('common.selectDate')}
              </span>
            </div>
          </div>
          <div className={styles.emergencyCheckbox}>
            <input 
              type="checkbox"
              checked={isEmergency}
              onChange={(e) => setIsEmergency(e.target.checked)}
              className={styles.checkbox}
              id="emergency"
            />
            <label htmlFor="emergency" className={styles.checkboxLabel}>
              {t('createAbnormalPost.dateSelection.emergency')}
            </label>
          </div>
        </div>
      </div>

      {/* Symptom selection */}
      <div className={styles.section}>
        <label className={styles.sectionLabel}>{t('createAbnormalPost.symptoms.title')}</label>
        <div className={styles.symptomSection}>
          {/* Selected symptoms display */}
          {selectedSymptoms.length > 0 && (
            <div className={styles.selectedSymptomsContainer}>
              {selectedSymptoms.map((symptom) => (
                <div key={symptom.id} className={styles.selectedSymptom}>
                  <span className={styles.symptomText}>{translateSingleSymptom(symptom.text)}</span>
                  <button 
                    className={styles.removeSymptomBtn}
                    onClick={() => handleRemoveSymptom(symptom.id)}
                  >
                    X
                  </button>
                </div>
              ))}
            </div>
          )}
          
          {/* Symptom selection input area */}
          <div className={styles.symptomInputSection}>
            <div className={styles.symptomSelectContainer}>
              <select
                value={selectedSymptomOption}
                onChange={(e) => setSelectedSymptomOption(e.target.value)}
                className={styles.symptomSelect}
              >
                <option value="">{t('createAbnormalPost.symptoms.selectSymptom')}</option>
                {availableSymptoms
                  .filter(symptom => {
                    const symptomText = typeof symptom === 'string' ? symptom : symptom.text || symptom;
                    return !selectedSymptoms.some(s => {
                      const selectedText = typeof s === 'string' ? s : s.text;
                      return selectedText === symptomText;
                    });
                  })
                  .map((symptom, index) => {
                    const symptomText = typeof symptom === 'string' ? symptom : symptom.text || symptom;
                    return (
                      <option key={index} value={symptomText}>{symptomText}</option>
                    );
                  })
                }
              </select>
            </div>
            <button
              className={styles.addSymptomBtn}
              onClick={handleAddSymptom}
            >
              {t('common.add')}
            </button>
          </div>
          
          <span className={styles.symptomCounter}>
            {t('createAbnormalPost.symptoms.counter', { count: selectedSymptoms.length })}
          </span>
        </div>
      </div>

      {/* Body statistics record */}
      <div className={styles.section}>
        <label className={styles.sectionLabel}>{t('createAbnormalPost.bodyStats.title')}:</label>
        <div className={styles.bodyStatsContainer}>
          <div className={styles.statRow}>
            <span className={styles.statLabel}>{t('createAbnormalPost.bodyStats.weight')}</span>
            <div className={styles.statInputWrapper}>
              <input 
                type="number"
                value={bodyStats.weight}
                onChange={(e) => handleBodyStatChange('weight', e.target.value)}
                className={styles.statInput}
                placeholder="0"
                min="0"
                step="0.1"
              />
              <span className={styles.statUnit}>{t('createAbnormalPost.bodyStats.units.kg')}</span>
            </div>
          </div>
          <div className={styles.statRow}>
            <span className={styles.statLabel}>{t('createAbnormalPost.bodyStats.waterIntake')}</span>
            <div className={styles.statInputWrapper}>
              <input 
                type="number"
                value={bodyStats.waterIntake}
                onChange={(e) => handleBodyStatChange('waterIntake', e.target.value)}
                className={styles.statInput}
                placeholder="0"
                min="0"
                step="0.01"
              />
              <span className={styles.statUnit}>{t('createAbnormalPost.bodyStats.units.liters')}</span>
            </div>
          </div>
          <div className={styles.statRow}>
            <span className={styles.statLabel}>{t('createAbnormalPost.bodyStats.temperature')}</span>
            <div className={styles.statInputWrapper}>
              <input 
                type="number"
                value={bodyStats.temperature}
                onChange={(e) => handleBodyStatChange('temperature', e.target.value)}
                className={styles.statInput}
                placeholder="0"
                min="0"
                step="0.1"
              />
              <span className={styles.statUnit}>{t('createAbnormalPost.bodyStats.units.celsius')}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Image upload area */}
      <div className={styles.section}>
        <label className={styles.sectionLabel}>{t('createAbnormalPost.imageUpload.title')}:</label>
        <div className={styles.imageSection}>
          {selectedImages.length === 0 ? (
            <div className={styles.noImageState}>
              <img 
                src="/assets/icon/RegisterPage_NotCheckIcon.png" 
                alt={t('createAbnormalPost.imageUpload.noImageSelected')} 
                className={styles.warningIcon}
              />
              <p className={styles.noImageText}>{t('createAbnormalPost.imageUpload.noImageSelected')}</p>
            </div>
          ) : (
            <div ref={imagePreviewContainerRef} className={styles.imagePreviewContainer}>
              {selectedImages.map((image) => (
                <div key={image.id} className={styles.imagePreview}>
                  <img src={image.preview} alt={t('createAbnormalPost.imageUpload.previewAlt')} />
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
              {t('createAbnormalPost.imageUpload.addImage')}
            </button>
            <span className={styles.imageCounter}>
              {t('createAbnormalPost.imageUpload.imageCounter', { count: selectedImages.length })}
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
      </div>

      {/* Text description area */}
      <div className={styles.section}>
        <label className={styles.sectionLabel}>{t('createAbnormalPost.description.title')}</label>
        <div className={styles.descriptionSection}>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t('createAbnormalPost.description.placeholder')}
            className={styles.descriptionInput}
            rows="6"
          />
        </div>
      </div>
    </>
  );

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
          {loading ? (
            <div className={styles.loadingContainer}>{t('common.loading')}</div>
          ) : (
            <>
              {renderContent()}
              
              {/* Action buttons */}
              <div className={styles.actionButtons}>
                <button 
                  className={styles.cancelButton}
                  onClick={handleBack}
                >
                  {t('common.cancel')}
                </button>
                <button 
                  className={styles.createButton}
                  onClick={handleUpdate}
                  disabled={loading}
                >
                  {loading ? t('editPost.ui.updating') : t('editPost.ui.updatePost')}
                </button>
              </div>
            </>
          )}
        </div>

        
        <BottomNavbar />
      </div>
    </NotificationProvider>
  );
};

export default EditAbnormalPostPage;