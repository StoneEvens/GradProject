import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';
import HomePage from './pages/HomePage';
import RegisterPage from './pages/RegisterPage';
import LoginPage from './pages/LoginPage';
import MainPage from './pages/MainPage';
import { isAuthenticated } from './services/authService';

const App = () => {
  const [isUserAuthenticated, setIsUserAuthenticated] = useState(false);

  useEffect(() => {
    // 檢查認證狀態
    const checkAuth = () => {
      const authStatus = isAuthenticated();
      setIsUserAuthenticated(authStatus);
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
        {/* 日常紀錄頁面 */}
        <Route 
          path="/daily-record" 
          element={isUserAuthenticated ? <MainPage /> : <Navigate to="/login" />} 
        />
        {/* 症狀紀錄頁面 */}
        <Route 
          path="/symptom-record" 
          element={isUserAuthenticated ? <MainPage /> : <Navigate to="/login" />} 
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