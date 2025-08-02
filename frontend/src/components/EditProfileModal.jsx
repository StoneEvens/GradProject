import React, { useState, useRef } from 'react';
import styles from '../styles/EditProfileModal.module.css';
import { checkUserAccount } from '../services/userService';
import Notification from './Notification';

const EditProfileModal = ({ user, isOpen, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    user_account: user?.user_account || '',
    user_fullname: user?.user_fullname || '',
    user_intro: user?.user_intro || ''
  });

  // 當用戶資料變更時更新表單資料
  React.useEffect(() => {
    if (user) {
      setFormData({
        user_account: user.user_account || '',
        user_fullname: user.user_fullname || '',
        user_intro: user.user_intro || ''
      });
      setPreviewUrl(user.headshot_url || '/assets/icon/DefaultAvatar.jpg');
    }
  }, [user]);
  
  const [selectedImage, setSelectedImage] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(user?.headshot_url || '/assets/icon/DefaultAvatar.jpg');
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState('');
  const fileInputRef = useRef(null);

  // 處理表單輸入變化
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // 處理頭像選擇
  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedImage(file);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    }
  };

  // 點擊頭像觸發檔案選擇
  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  // 顯示通知
  const showNotification = (message) => {
    setNotification(message);
  };

  // 隱藏通知
  const hideNotification = () => {
    setNotification('');
  };

  // 驗證表單
  const validateForm = async () => {
    // 檢查必填欄位
    if (!formData.user_account.trim()) {
      showNotification('請輸入帳號名稱');
      return false;
    }

    if (!formData.user_fullname.trim()) {
      showNotification('請輸入真實姓名');
      return false;
    }

    // 如果帳號有變更，檢查是否與其他用戶重複
    if (formData.user_account !== user?.user_account) {
      try {
        const accountExists = await checkUserAccount(formData.user_account);
        if (accountExists) {
          showNotification('此帳號已被使用，請嘗試其他帳號');
          return false;
        }
      } catch (error) {
        console.error('帳號檢查失敗:', error);
        showNotification('帳號檢查失敗，請稍後再試');
        return false;
      }
    }

    return true;
  };

  // 處理儲存
  const handleSave = async () => {
    // 先驗證表單
    const isValid = await validateForm();
    if (!isValid) {
      return;
    }

    setLoading(true);
    try {
      const updateData = {
        ...formData,
        image: selectedImage
      };
      await onSave(updateData);
      onClose();
    } catch (error) {
      console.error('儲存個人資料失敗:', error);
      showNotification('儲存個人資料失敗，請稍後再試');
    } finally {
      setLoading(false);
    }
  };

  // 處理取消
  const handleCancel = () => {
    // 重置表單
    setFormData({
      user_account: user?.user_account || '',
      user_fullname: user?.user_fullname || '',
      user_intro: user?.user_intro || ''
    });
    setSelectedImage(null);
    setPreviewUrl(user?.headshot_url || '/assets/icon/DefaultAvatar.jpg');
    setNotification('');
    onClose();
  };

  // 處理點擊遮罩關閉 modal
  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget && !loading) {
      handleCancel();
    }
  };

  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay} onClick={handleOverlayClick}>
      {notification && (
        <Notification
          message={notification}
          onClose={hideNotification}
        />
      )}
      <div className={styles.modalContainer}>
        <div className={styles.modalHeader}>
          <h2>編輯個人資料</h2>
        </div>
        
        <div className={styles.modalBody}>
          {/* 頭像區塊 */}
          <div className={styles.avatarSection}>
            <div className={styles.avatarContainer} onClick={handleAvatarClick}>
              <img 
                src={previewUrl} 
                alt="頭像預覽" 
                className={styles.avatarPreview}
              />
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageSelect}
              className={styles.hiddenInput}
            />
          </div>

          {/* 表單區塊 */}
          <div className={styles.formSection}>
            <div className={styles.inputGroup}>
              <label htmlFor="user_account">帳號 *</label>
              <input
                type="text"
                id="user_account"
                name="user_account"
                value={formData.user_account}
                onChange={handleInputChange}
                className={styles.formInput}
                maxLength="60"
                disabled={loading}
              />
            </div>

            <div className={styles.inputGroup}>
              <label htmlFor="user_fullname">真實姓名 *</label>
              <input
                type="text"
                id="user_fullname"
                name="user_fullname"
                value={formData.user_fullname}
                onChange={handleInputChange}
                className={styles.formInput}
                maxLength="60"
                disabled={loading}
              />
            </div>

            <div className={styles.inputGroup}>
              <label htmlFor="user_intro">使用者簡介</label>
              <textarea
                id="user_intro"
                name="user_intro"
                value={formData.user_intro}
                onChange={handleInputChange}
                className={styles.formTextarea}
                rows={4}
                disabled={loading}
              />
            </div>
          </div>
        </div>

        <div className={styles.modalFooter}>
          <button 
            className={styles.cancelButton} 
            onClick={handleCancel}
            disabled={loading}
          >
            取消
          </button>
          <button 
            className={styles.saveButton} 
            onClick={handleSave}
            disabled={loading}
          >
            {loading ? '儲存中...' : '確認'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditProfileModal; 