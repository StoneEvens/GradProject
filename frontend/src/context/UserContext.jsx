import React, { createContext, useContext, useState, useEffect } from 'react';
import { getUserProfile } from '../services/userService';

const UserContext = createContext();

export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};

export const UserProvider = ({ children }) => {
  const [userHeadshot, setUserHeadshot] = useState('/assets/icon/DefaultAvatar.jpg');
  const [userData, setUserData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [imageLoading, setImageLoading] = useState(false);
  const [fetchingData, setFetchingData] = useState(false);

  const updateUserHeadshot = (newHeadshot) => {
    if (newHeadshot && newHeadshot !== userHeadshot) {
      // 預加載新圖片以避免閃爍
      setImageLoading(true);
      const img = new Image();
      img.onload = () => {
        setUserHeadshot(newHeadshot);
        setImageLoading(false);
        if (userData) {
          setUserData(prev => ({
            ...prev,
            headshot_url: newHeadshot
          }));
        }
      };
      img.onerror = () => {
        setImageLoading(false);
        // 如果新圖片加載失敗，保持當前頭像
        console.error('頭像加載失敗:', newHeadshot);
      };
      img.src = newHeadshot;
    }
  };

  const fetchUserData = async () => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      setUserHeadshot('/assets/icon/DefaultAvatar.jpg');
      setUserData(null);
      return;
    }

    // 防重複請求
    if (fetchingData) {
      return;
    }

    setIsLoading(true);
    setFetchingData(true);
    try {
      const data = await getUserProfile();
      setUserData(data);
      if (data.headshot_url) {
        updateUserHeadshot(data.headshot_url);
      } else {
        setUserHeadshot('/assets/icon/DefaultAvatar.jpg');
      }
    } catch (error) {
      console.error('獲取用戶資料失敗:', error);
      // 如果API失敗，保持當前頭像
    } finally {
      setIsLoading(false);
      setFetchingData(false);
    }
  };

  const clearUserData = () => {
    setUserHeadshot('/assets/icon/DefaultAvatar.jpg');
    setUserData(null);
  };

  useEffect(() => {
    fetchUserData();

    // 監聽認證狀態變化
    const handleAuthChange = () => {
      const newToken = localStorage.getItem('accessToken');
      if (newToken) {
        fetchUserData();
      } else {
        clearUserData();
      }
    };

    // 監聽頭像更新事件
    const handleAvatarUpdate = (event) => {
      if (event.detail && event.detail.headshot_url) {
        updateUserHeadshot(event.detail.headshot_url);
      } else {
        // 如果沒有提供新頭像URL，重新獲取用戶資料
        fetchUserData();
      }
    };

    window.addEventListener('auth-change', handleAuthChange);
    window.addEventListener('avatar-updated', handleAvatarUpdate);
    
    return () => {
      window.removeEventListener('auth-change', handleAuthChange);
      window.removeEventListener('avatar-updated', handleAvatarUpdate);
    };
  }, []);

  const value = {
    userHeadshot,
    userData,
    isLoading,
    imageLoading,
    updateUserHeadshot,
    fetchUserData,
    clearUserData
  };

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  );
};

export default UserContext;