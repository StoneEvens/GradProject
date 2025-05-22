import axios from 'axios';

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
    const token = localStorage.getItem('accessToken');
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
        // 嘗試使用 refresh token 獲取新的 access token
        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) {
          throw new Error('No refresh token available');
        }

        const response = await axios.post(
          `${import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'}/accounts/token/refresh/`,
          {
            refresh: refreshToken
          }
        );

        // 更新 localStorage 中的 token
        localStorage.setItem('accessToken', response.data.access);

        // 更新原始請求的 Authorization header
        originalRequest.headers.Authorization = `Bearer ${response.data.access}`;

        // 重試原始請求
        return instance(originalRequest);
      } catch (refreshError) {
        // 如果刷新 token 失敗，清除所有認證信息並重定向到登入頁面
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('userData');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default instance; 