// tokenTest.js - 用於驗證 token 刷新功能的測試檔案

import { authAxios, getAccessToken, getRefreshToken, isAuthenticated } from './authService';

// 檢查 Token 是否有效的函數
export const checkToken = () => {
  const accessToken = getAccessToken();
  const refreshToken = getRefreshToken();
  const isAuth = isAuthenticated();
  
  console.log('Access Token:', accessToken ? '存在' : '不存在');
  console.log('Refresh Token:', refreshToken ? '存在' : '不存在');
  console.log('用戶是否已認證:', isAuth ? '是' : '否');
  
  return { accessToken, refreshToken, isAuth };
};

// 測試 API 請求，會自動處理 token 過期
export const testApiRequest = async () => {
  try {
    console.log('發送測試請求...');
    const response = await authAxios.get('/accounts/plans/today/');
    console.log('API 請求成功:', response.data);
    return response.data;
  } catch (error) {
    console.error('API 請求失敗:', error.message);
    if (error.response) {
      console.error('錯誤狀態碼:', error.response.status);
      console.error('錯誤詳情:', error.response.data);
    }
    throw error;
  }
};

// 手動刷新 token
export const manualRefreshToken = async () => {
  try {
    console.log('手動刷新 token...');
    const refreshToken = getRefreshToken();
    
    if (!refreshToken) {
      console.error('無法刷新 token: 沒有找到 refresh token');
      return null;
    }
    
    const response = await authAxios.post('/accounts/token/refresh/', {
      refresh: refreshToken
    });
    
    console.log('Token 刷新成功!');
    return response.data;
  } catch (error) {
    console.error('Token 刷新失敗:', error.message);
    throw error;
  }
};

// 使用說明
export const showUsage = () => {
  console.log(`
====== Token 測試工具使用說明 ======

1. 檢查 Token 狀態:
   tokenTest.checkToken()

2. 測試 API 請求 (自動處理過期):
   tokenTest.testApiRequest()
   
3. 手動刷新 Token:
   tokenTest.manualRefreshToken()

注意: 這個工具只用於開發和測試，不應該在生產環境中使用。
===================================
  `);
}; 