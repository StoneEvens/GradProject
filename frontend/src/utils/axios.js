import axios from 'axios';
import { getAccessToken, getRefreshToken, saveTokens, refreshAccessToken as refreshToken } from '../services/authService';

// 創建 axios 實例
const instance = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1',
  timeout: 15000, // 請求超時時間
  headers: {
    'Content-Type': 'application/json',
  },
});

// 請求攔截器
instance.interceptors.request.use(
  (config) => {
    const token = getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 響應攔截器
instance.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    // 如果是 401 錯誤（未授權）且不是重新整理 token 的請求
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        // 使用 authService 中的方法刷新 token
        const newToken = await refreshToken();
        
        // 更新原始請求的 Authorization header
        originalRequest.headers.Authorization = `Bearer ${newToken}`;

        // 重試原始請求
        return instance(originalRequest);
      } catch (refreshError) {
        // 如果刷新 token 失敗，由 authService 處理登出邏輯
        // authService 中會觸發 auth-logout 事件
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default instance; 