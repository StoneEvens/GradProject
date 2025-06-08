import React, { useState, useEffect } from 'react';
import { isAuthenticated, getAccessToken, refreshAccessToken } from '../services/authService';
import { useNavigate } from 'react-router-dom';

const TokenTestPage = () => {
  const [accessToken, setAccessToken] = useState('');
  const [tokenExpiry, setTokenExpiry] = useState('');
  const [refreshStatus, setRefreshStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // 解析 token 以獲取過期時間
  const parseToken = (token) => {
    try {
      if (!token) return { exp: null };
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      return JSON.parse(jsonPayload);
    } catch (error) {
      console.error('解析 token 失敗:', error);
      return { exp: null };
    }
  };

  // 更新 token 資訊
  const updateTokenInfo = () => {
    const token = getAccessToken();
    setAccessToken(token || '無 token');
    
    if (token) {
      const decodedToken = parseToken(token);
      if (decodedToken.exp) {
        const expiryDate = new Date(decodedToken.exp * 1000);
        setTokenExpiry(`${expiryDate.toLocaleDateString()} ${expiryDate.toLocaleTimeString()}`);
      } else {
        setTokenExpiry('無法解析過期時間');
      }
    } else {
      setTokenExpiry('無 token');
    }
  };

  // 刷新 token
  const handleRefreshToken = async () => {
    setLoading(true);
    setRefreshStatus('正在刷新...');
    
    try {
      await refreshAccessToken();
      setRefreshStatus('刷新成功');
      updateTokenInfo();
    } catch (error) {
      console.error('刷新失敗:', error);
      setRefreshStatus(`刷新失敗: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // 返回主頁
  const handleBackToMain = () => {
    e.preventDefault();
    navigate('/main');
  };

  // 初始化和更新時獲取 token 資訊
  useEffect(() => {
    if (!isAuthenticated()) {
      navigate('/login');
      return;
    }
    
    updateTokenInfo();
    
    // 監聽認證變更事件
    const handleAuthChange = () => {
      updateTokenInfo();
    };
    
    window.addEventListener('auth-change', handleAuthChange);
    return () => {
      window.removeEventListener('auth-change', handleAuthChange);
    };
  }, [navigate]);

  return (
    <div style={{ padding: '20px', maxWidth: '500px', margin: '0 auto' }}>
      <h2 style={{ marginBottom: '20px' }}>Token 測試頁面</h2>
      
      <div style={{ marginBottom: '20px', padding: '15px', border: '1px solid #ddd', borderRadius: '5px' }}>
        <h3>當前 Access Token:</h3>
        <div style={{ wordBreak: 'break-all', backgroundColor: '#f5f5f5', padding: '10px', borderRadius: '3px' }}>
          {accessToken}
        </div>
      </div>
      
      <div style={{ marginBottom: '20px' }}>
        <h3>Token 過期時間:</h3>
        <p>{tokenExpiry}</p>
      </div>
      
      <div style={{ marginBottom: '20px' }}>
        <button 
          onClick={handleRefreshToken} 
          disabled={loading}
          style={{
            padding: '10px 15px',
            backgroundColor: '#4CAF50',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.7 : 1
          }}
        >
          手動刷新 Token
        </button>
        <div style={{ marginTop: '10px' }}>
          <p>{refreshStatus}</p>
        </div>
      </div>
      
      <button 
        onClick={handleBackToMain}
        style={{
          padding: '10px 15px',
          backgroundColor: '#2196F3',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer'
        }}
      >
        返回主頁
      </button>
    </div>
  );
};

export default TokenTestPage; 