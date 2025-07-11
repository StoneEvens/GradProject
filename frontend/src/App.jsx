import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';
import HomePage from './pages/HomePage';
import RegisterPage from './pages/RegisterPage';
import LoginPage from './pages/LoginPage';
import MainPage from './pages/MainPage';
import UserProfilePage from './pages/UserProfilePage';
import OtherUserProfilePage from './pages/OtherUserProfilePage';
import UserFollowConditionPage from './pages/UserFollowConditionPage';
import SocialPage from './pages/SocialPage';
import SettingsPage from './pages/SettingsPage';
import NotificationPage from './pages/NotificationPage';
import PetPage from './pages/PetPage';
import AddPetPage from './pages/AddPetPage';
import EditPetPage from './pages/EditPetPage';
import CreatePostPage from './pages/CreatePostPage';
import { isAuthenticated, refreshAccessToken } from './services/authService';

const App = () => {
  const [isUserAuthenticated, setIsUserAuthenticated] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  useEffect(() => {
    // 檢查認證狀態並嘗試刷新 Token
    const checkAuth = async () => {
      try {
        // 如果有 token 但即將過期，先嘗試刷新
        const token = localStorage.getItem('accessToken');
        if (token) {
          // 解碼 token 查看過期時間
          try {
            const payload = token.split('.')[1];
            const decodedPayload = JSON.parse(atob(payload));
            const currentTime = Math.floor(Date.now() / 1000);
            // 如果 token 將在 5 分鐘內過期，主動刷新
            if ((decodedPayload.exp - currentTime) < 300) {
              await refreshAccessToken();
            }
          } catch (error) {
            console.error('解析 token 失敗:', error);
          }
        }
        
        // 檢查認證狀態
        const authStatus = isAuthenticated();
        setIsUserAuthenticated(authStatus);
      } catch (error) {
        console.error('認證檢查失敗:', error);
        setIsUserAuthenticated(false);
      } finally {
        setIsAuthLoading(false);
      }
    };

    // 初始檢查
    checkAuth();

    // 添加自定義事件監聽器
    window.addEventListener('auth-change', checkAuth);
    
    // 監聽登出事件
    window.addEventListener('auth-logout', () => {
      setIsUserAuthenticated(false);
    });

    // 定期檢查 token 是否有效（每分鐘）
    const intervalId = setInterval(checkAuth, 60000);

    return () => {
      window.removeEventListener('auth-change', checkAuth);
      window.removeEventListener('auth-logout', () => {
        setIsUserAuthenticated(false);
      });
      clearInterval(intervalId);
    };
  }, []);

  // 認證檢查中顯示載入畫面
  if (isAuthLoading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        backgroundColor: '#FFF2D9',
        fontSize: '1.2rem',
        color: '#333'
      }}>
        載入中...
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        {/* 根路徑：已登入導向MainPage，未登入導向HomePage */}
        <Route 
          path="/" 
          element={isUserAuthenticated ? <MainPage /> : <HomePage />} 
        />
        {/* 登入頁面：已登入導向MainPage */}
        <Route 
          path="/login" 
          element={isUserAuthenticated ? <Navigate to="/main" /> : <LoginPage />} 
        />
        {/* 註冊頁面：已登入導向MainPage */}
        <Route 
          path="/register" 
          element={isUserAuthenticated ? <Navigate to="/main" /> : <RegisterPage />} 
        />
        {/* 主頁面：未登入導向HomePage */}
        <Route 
          path="/main" 
          element={isUserAuthenticated ? <MainPage /> : <Navigate to="/" />} 
        />
        {/* 用戶個人頁：未登入導向HomePage */}
        <Route 
          path="/user-profile" 
          element={isUserAuthenticated ? <UserProfilePage /> : <Navigate to="/" />} 
        />
        {/* 其他用戶個人頁：未登入導向HomePage */}
        <Route 
          path="/user/:userAccount" 
          element={isUserAuthenticated ? <OtherUserProfilePage /> : <Navigate to="/" />} 
        />
        {/* 用戶追蹤狀況頁面：未登入導向HomePage */}
        <Route 
          path="/user/:userAccount/follow/:type" 
          element={isUserAuthenticated ? <UserFollowConditionPage /> : <Navigate to="/" />} 
        />
        {/* 社群頁面：未登入導向HomePage */}
        <Route 
          path="/social" 
          element={isUserAuthenticated ? <SocialPage /> : <Navigate to="/" />} 
        />
        {/* 社群搜尋結果頁面：未登入導向HomePage */}
        <Route 
          path="/social/search" 
          element={isUserAuthenticated ? <SocialPage /> : <Navigate to="/" />} 
        />
        {/* 設定頁面：未登入導向HomePage */}
        <Route 
          path="/settings" 
          element={isUserAuthenticated ? <SettingsPage /> : <Navigate to="/" />} 
        />
        {/* 通知頁面：未登入導向HomePage */}
        <Route 
          path="/notifications" 
          element={isUserAuthenticated ? <NotificationPage /> : <Navigate to="/" />} 
        />
        {/* 寵物頁面：未登入導向HomePage */}
        <Route 
          path="/pet" 
          element={isUserAuthenticated ? <PetPage /> : <Navigate to="/" />} 
        />
        {/* 新增寵物頁面：未登入導向HomePage */}
        <Route 
          path="/pet/add" 
          element={isUserAuthenticated ? <AddPetPage /> : <Navigate to="/" />} 
        />
        {/* 編輯寵物頁面：未登入導向HomePage */}
        <Route 
          path="/pet/:petId/edit" 
          element={isUserAuthenticated ? <EditPetPage /> : <Navigate to="/" />} 
        />
        {/* 創建貼文頁面：未登入導向HomePage */}
        <Route 
          path="/create-post" 
          element={isUserAuthenticated ? <CreatePostPage /> : <Navigate to="/" />} 
        />
        {/* 未定義路徑：根據登入狀態重定向 */}
        <Route 
          path="*" 
          element={isUserAuthenticated ? <Navigate to="/main" /> : <Navigate to="/" />} 
        />
      </Routes>
    </BrowserRouter>
  );
};

export default App; 