import axios from 'axios';

// 使用硬編碼的默認 API URL
const API_URL = 'http://localhost:8000/api/v1';

// 檢查 token 是否過期
const isTokenExpired = (token) => {
  if (!token) return true;
  
  try {
    // JWT token 的格式為: header.payload.signature
    // 我們需要解碼 payload 部分
    const payload = token.split('.')[1];
    const decodedPayload = JSON.parse(atob(payload));
    
    // 獲取當前時間和 token 的過期時間（以秒為單位）
    const currentTime = Math.floor(Date.now() / 1000);
    return decodedPayload.exp < currentTime;
  } catch (error) {
    console.error('解析 token 失敗:', error);
    return true;
  }
};

// 獲取 Access Token
export const getAccessToken = () => {
  return localStorage.getItem('accessToken') || localStorage.getItem('token');
};

// 獲取 Refresh Token
export const getRefreshToken = () => {
  return localStorage.getItem('refreshToken') || localStorage.getItem('refresh_token');
};

// 保存 tokens
export const saveTokens = (accessToken, refreshToken) => {
  localStorage.setItem('accessToken', accessToken);
  if (refreshToken) {
    localStorage.setItem('refreshToken', refreshToken);
  }
};

// 清除 tokens
export const clearTokens = () => {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('token');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('userData');
};

// 使用 refresh token 獲取新的 access token
export const refreshAccessToken = async () => {
  try {
    const refreshToken = getRefreshToken();
    if (!refreshToken) {
      console.warn('沒有可用的刷新令牌');
      throw new Error('沒有可用的刷新令牌');
    }

    // 使用獨立的 axios 實例發送刷新請求，避免循環依賴
    const response = await axios.post(`${API_URL}/accounts/token/refresh/`, {
      refresh: refreshToken
    });

    // 嘗試從不同格式的回應中獲取 access token
    let newAccessToken = null;
    
    if (response.data.access) {
      newAccessToken = response.data.access;
    } else if (response.data.data && response.data.data.access) {
      newAccessToken = response.data.data.access;
    } else {
      console.error('刷新令牌響應格式錯誤:', response.data);
      throw new Error('刷新令牌響應格式錯誤');
    }
    
    // 保存新的 access token
    saveTokens(newAccessToken, null);
    
    // 觸發認證狀態更新事件
    window.dispatchEvent(new Event('auth-change'));
    
    return newAccessToken;
  } catch (error) {
    console.error('刷新令牌失敗:', error);
    
    // 對於 401 或 403 錯誤，意味著刷新令牌已失效，需要重新登入
    if (error.response && (error.response.status === 401 || error.response.status === 403)) {
      console.warn('刷新令牌已失效，需要重新登入');
      clearTokens();
      
      // 觸發登出事件，但不立即重定向（讓使用者可以保存目前工作）
      window.dispatchEvent(new CustomEvent('auth-logout', { 
        detail: { reason: 'token-refresh-failed' } 
      }));
    }
    
    throw error;
  }
};

// 創建一個 axios 實例，自動處理 token 刷新
export const authAxios = axios.create({
  baseURL: API_URL
});

// 請求攔截器
authAxios.interceptors.request.use(
  async (config) => {
    let token = getAccessToken();
    
    // 如果 token 過期，嘗試刷新
    if (token && isTokenExpired(token)) {
      try {
        token = await refreshAccessToken();
      } catch (error) {
        console.error('自動刷新 token 失敗:', error);
        // 如果刷新失敗，將由 refreshAccessToken 函數處理登出邏輯
        return Promise.reject(error);
      }
    }
    
    // 添加 token 到請求頭
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
authAxios.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    
    // 如果是 401 錯誤且未嘗試過刷新 token
    if (error.response && error.response.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        const token = await refreshAccessToken();
        // 更新原請求的 token
        originalRequest.headers.Authorization = `Bearer ${token}`;
        // 重新發送原請求
        return authAxios(originalRequest);
      } catch (refreshError) {
        console.error('在響應攔截器中刷新 token 失敗:', refreshError);
        // 如果刷新失敗，已在 refreshAccessToken 函數中處理登出邏輯
        return Promise.reject(refreshError);
      }
    }
    
    return Promise.reject(error);
  }
);

// 登入
export const login = async (credentials) => {
  try {
    const response = await axios.post(`${API_URL}/accounts/token/`, credentials);
    
    if (response.data.access && response.data.refresh) {
      saveTokens(response.data.access, response.data.refresh);
      return response.data;
    } else if (response.data.tokens) {
      // 處理自定義回應格式
      saveTokens(response.data.tokens.access, response.data.tokens.refresh);
      return response.data;
    } else {
      throw new Error('登入響應格式錯誤');
    }
  } catch (error) {
    console.error('登入失敗:', error);
    throw error;
  }
};

// 登出
export const logout = async () => {
  try {
    const refreshToken = getRefreshToken();
    if (refreshToken) {
      await authAxios.post(`${API_URL}/accounts/logout/`, {
        refresh: refreshToken
      });
    }
  } catch (error) {
    console.error('登出請求失敗:', error);
  } finally {
    clearTokens();
    window.location.href = '/login';
  }
};

// 檢查是否已登入
export const isAuthenticated = () => {
  const token = getAccessToken();
  return !!token && !isTokenExpired(token);
}; 