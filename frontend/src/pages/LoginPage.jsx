import React, { useState } from 'react';
import styles from '../styles/LoginPage.module.css';
import { Canvas } from '@react-three/fiber';
import { useGLTF, OrbitControls, Environment } from '@react-three/drei';
import LoginPageAnimation from '../components/LoginPageAnimation';
import Notification from '../components/Notification';
import { NotificationProvider } from '../context/NotificationContext';
import { Link, useNavigate } from 'react-router-dom';
import { login } from '../services/authService';

const LoginPage = () => {
  const [formData, setFormData] = useState({
    accountName: '',
    password: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [notification, setNotification] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };

  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validateAccountName = (accountName) => {
    // 只允許英文、數字和標點符號
    const accountNameRegex = /^[a-zA-Z0-9\s!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]*$/;
    return accountNameRegex.test(accountName);
  };

  const validateForm = () => {
    if (formData.accountName.trim() === '') {
      showNotification('請輸入電子信箱');
      return false;
    }

    if (!validateAccountName(formData.accountName)) {
      showNotification('帳號只能包含英文、數字和標點符號');
      return false;
    }

    if (!validateEmail(formData.accountName)) {
      showNotification('請輸入有效的電子信箱格式');
      return false;
    }

    if (formData.password.trim() === '') {
      showNotification('請輸入密碼');
      return false;
    }

    return true;
  };

  const showNotification = (message) => {
    setNotification(message);
  };

  const hideNotification = () => {
    setNotification('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    try {
      const response = await login({
        email: formData.accountName,
        password: formData.password
      });
      
      // 觸發認證狀態更新
      window.dispatchEvent(new Event('auth-change'));

      // 顯示成功訊息
      showNotification('登入成功！');

      // 延遲導航，讓用戶看到成功訊息
      setTimeout(() => {
        navigate('/main');  // 導航到主頁面
      }, 1500);

    } catch (error) {
      let errorMessage = '登入失敗，請稍後再試';
      
      if (error.response) {
        // 檢查是否有 non_field_errors
        if (error.response.data?.non_field_errors) {
          errorMessage = error.response.data.non_field_errors[0];
        }
        // 檢查是否有 data.errors.non_field_errors
        else if (error.response.data?.data?.errors?.non_field_errors) {
          errorMessage = error.response.data.data.errors.non_field_errors[0];
        }
        // 檢查是否有一般的 message
        else if (error.response.data?.message) {
          errorMessage = error.response.data.message;
        }
        // 如果都沒有，根據狀態碼給出適當的訊息
        else {
          switch (error.response.status) {
            case 401:
              errorMessage = '帳號或密碼錯誤';
              break;
            case 400:
              errorMessage = '請檢查輸入資料是否正確';
              break;
            case 404:
              errorMessage = '找不到該帳號';
              break;
            default:
              errorMessage = '登入失敗，請稍後再試';
          }
        }
      }
      
      showNotification(errorMessage);
      console.error('登入錯誤：', error.response?.data);
    } finally {
      setIsLoading(false);
    }
  };

  const { scene: fenceScene } = useGLTF('/assets/models/Fence.glb');
  const { scene: fenceScene2 } = useGLTF('/assets/models/Fence2.glb');
  const { scene: fenceScene3 } = useGLTF('/assets/models/Fence3.glb');
  const { scene: dogbowl } = useGLTF('/assets/models/Dog bowl.glb');
  const { scene: steak } = useGLTF('/assets/models/Steak.glb');

  return (
    <NotificationProvider>
      <div className={styles.loginPage}>
        {notification && (
          <Notification
            message={notification}
            onClose={hideNotification}
          />
        )}
        <div className={styles.canvasArea}>
          <Canvas className={styles.animationContainer} camera={{ position: [0, 0, 1], fov: 45 }}>
            <Environment preset="apartment" intensity={0.0015} />
            <ambientLight intensity={0.6} />
            <directionalLight position={[5, 5, 5]} intensity={1} />
            <LoginPageAnimation />
            <OrbitControls enableZoom={false} enablePan={false} enableRotate={false} />
            <primitive object={fenceScene} position={[0, -0.15, 0.2]} scale={0.5}/>
            <primitive object={fenceScene2} position={[0.42, -0.15, 0.2]} scale={0.5}/>
            <primitive object={fenceScene3} position={[-0.42, -0.15, 0.2]} scale={0.5}/>
            <primitive object={dogbowl} position={[0.12, -0.15, 0.28]} scale={0.18}/>
            <primitive object={steak} position={[0.12, -0.15, 0.28]} rotation={[0, -Math.PI / 2, 0]} scale={0.13}/>
          </Canvas>
        </div>
        <div className={styles.formArea}>
          <form className={styles.loginForm} onSubmit={handleSubmit} noValidate>
            <input
              type="email"
              name="accountName"
              value={formData.accountName}
              onChange={handleInputChange}
              placeholder="請輸入註冊信箱"
              className={styles.input}
              disabled={isLoading}
            />
            <div className={styles.passwordContainer}>
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                placeholder="請輸入密碼"
                className={styles.input}
                disabled={isLoading}
              />
              <button 
                type="button"
                className={styles.passwordToggle}
                onClick={() => setShowPassword(!showPassword)}
                disabled={isLoading}
              >
                <img 
                  src={showPassword ? "/assets/icon/LoginButton_HidePassword.png" : "/assets/icon/LoginButton_ShowPassword.png"} 
                  alt={showPassword ? "隱藏密碼" : "顯示密碼"}
                />
              </button>
            </div>
            <button type="submit" className={styles.loginButton} disabled={isLoading}>
              {isLoading ? '登入中...' : '登入'}
            </button>
          </form>
          <div className={styles.forgotPassword}>
            忘記密碼?
          </div>
        </div>
      </div>
    </NotificationProvider>
  );
};

export default LoginPage; 