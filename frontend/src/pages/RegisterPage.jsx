import React, { useState } from 'react';
import styles from '../styles/RegisterPage.module.css';
import { Canvas } from '@react-three/fiber';
import { useGLTF, OrbitControls, Environment } from '@react-three/drei';
import RegisterPageAnimation from '../components/RegisterPageAnimation';
import Notification from '../components/Notification';
import { NotificationProvider } from '../context/NotificationContext';
import { useNavigate } from 'react-router-dom';
import api from '../utils/axios';

const RegisterPage = () => {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    accountName: '',
    userName: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
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

  const validateStep = async () => {
    switch (step) {
      case 1:
        if (formData.accountName.trim() === '') {
          showNotification('請輸入帳號名稱');
          return false;
        }
        if (formData.userName.trim() === '') {
          showNotification('請輸入使用者姓名');
          return false;
        }
        
        // 檢查帳號是否已存在
        try {
          setIsLoading(true);
          const response = await api.post('/accounts/check/account/', {
            user_account: formData.accountName
          });
          
          if (response.data.data.exists) {
            showNotification('此帳號已被使用，請嘗試其他帳號');
            setIsLoading(false);
            return false;
          }
          setIsLoading(false);
          return true;
        } catch (error) {
          setIsLoading(false);
          showNotification('帳號檢查失敗，請稍後再試');
          return false;
        }
        
      case 2:
        if (formData.email.trim() === '') {
          showNotification('請輸入電子信箱');
          return false;
        }
        if (!validateEmail(formData.email)) {
          showNotification('請輸入有效的電子信箱格式');
          return false;
        }
        
        // 檢查電子郵件是否已被使用
        try {
          setIsLoading(true);
          const response = await api.post('/accounts/check/email/', {
            email: formData.email
          });
          
          if (response.data.data.exists) {
            showNotification('此電子郵件已被使用，請使用其他電子郵件');
            setIsLoading(false);
            return false;
          }
          setIsLoading(false);
          return true;
        } catch (error) {
          setIsLoading(false);
          showNotification('電子郵件檢查失敗，請稍後再試');
          return false;
        }
        
      case 3:
        if (formData.password.trim() === '') {
          showNotification('請輸入密碼');
          return false;
        }
        if (!checkPasswordLength(formData.password)) {
          showNotification('密碼必須至少包含8個字元');
          return false;
        }
        if (!checkPasswordUpperCase(formData.password)) {
          showNotification('密碼必須包含至少一個大寫英文字母');
          return false;
        }
        if (formData.confirmPassword.trim() === '') {
          showNotification('請確認密碼');
          return false;
        }
        if (formData.password !== formData.confirmPassword) {
          showNotification('密碼不一致，請重新輸入');
          return false;
        }
        
        // 檢查密碼是否已被使用
        try {
          setIsLoading(true);
          const response = await api.post('/accounts/check/password/', {
            password: formData.password
          });
          
          if (response.data.data.exists) {
            showNotification('此密碼已被使用，請設定其他密碼');
            setIsLoading(false);
            return false;
          }
          setIsLoading(false);
          return true;
        } catch (error) {
          setIsLoading(false);
          showNotification('密碼檢查失敗，請稍後再試');
          return false;
        }
        
      default:
        return false;
    }
  };

  const showNotification = (message) => {
    setNotification(message);
  };

  const hideNotification = () => {
    setNotification('');
  };

  const nextStep = async () => {
    const isValid = await validateStep();
    if (isValid) {
      setStep(step + 1);
    }
  };

  const prevStep = () => {
    setStep(step - 1);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const isValid = await validateStep();
    if (!isValid) {
      return;
    }

    try {
      setIsLoading(true);
      const response = await api.post('/accounts/register/', {
        user_account: formData.accountName,
        user_fullname: formData.userName,
        email: formData.email,
        password: formData.password
      });

      // 儲存 token 到 localStorage
      localStorage.setItem('accessToken', response.data.tokens.access);
      localStorage.setItem('refreshToken', response.data.tokens.refresh);
      
      // 儲存用戶資訊
      localStorage.setItem('userData', JSON.stringify(response.data.data));

      // 觸發認證狀態更新
      window.dispatchEvent(new Event('auth-change'));

      // 顯示成功訊息
      showNotification('註冊成功！');
      setIsLoading(false);

      // 延遲導航，讓用戶看到成功訊息
      setTimeout(() => {
        navigate('/main');  // 導航到主頁面
      }, 1500);

    } catch (error) {
      setIsLoading(false);
      let errorMessage = '註冊失敗，請稍後再試';
      
      if (error.response) {
        switch (error.response.status) {
          case 400:
            errorMessage = error.response.data.message || '請檢查輸入資料是否正確';
            break;
          default:
            errorMessage = '註冊失敗，請稍後再試';
        }
      }
      
      showNotification(errorMessage);
    }
  };

  const checkPasswordLength = (password) => {
    return password.length >= 8;
  };

  const checkPasswordUpperCase = (password) => {
    return /[A-Z]/.test(password);
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <div className={styles.formStep}>
            <input
              type="text"
              name="accountName"
              value={formData.accountName}
              onChange={handleInputChange}
              placeholder="請輸入您想使用的帳號名稱"
              className={styles.input}
              maxLength="60"
              disabled={isLoading}
            />
            <div className={styles.hint}>英文,數字或標點符號 (最多60字元)</div>
            <input
              type="text"
              name="userName"
              value={formData.userName}
              onChange={handleInputChange}
              placeholder="請輸入您的使用者姓名"
              className={styles.input}
              maxLength="60"
              disabled={isLoading}
            />
            <button 
              onClick={nextStep} 
              className={styles.singleButton}
              disabled={isLoading}
            >
              {isLoading ? '檢查中...' : '下一步'}
            </button>
          </div>
        );
      case 2:
        return (
          <div className={styles.formStep}>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              placeholder="請輸入您的電子信箱"
              className={styles.input}
              disabled={isLoading}
            />
            <div className={styles.hint}>example@mail.com</div>
            <div className={styles.buttonGroup}>
              <button 
                onClick={prevStep} 
                className={styles.backButton}
                disabled={isLoading}
              >
                上一步
              </button>
              <button 
                onClick={nextStep} 
                className={styles.nextButton}
                disabled={isLoading}
              >
                {isLoading ? '檢查中...' : '下一步'}
              </button>
            </div>
          </div>
        );
      case 3:
        return (
          <div className={styles.formStep}>
            <div className={styles.passwordContainer}>
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                placeholder="請輸入您的密碼"
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
            <div className={styles.passwordHintContainer}>
              <div className={styles.passwordHint}>
                <img 
                  src={checkPasswordLength(formData.password) ? "/assets/icon/RegisterPage_CheckIcon.png" : "/assets/icon/RegisterPage_NotCheckIcon.png"} 
                  alt="密碼長度檢查"
                />
                <span>8字元以上</span>
              </div>
              <div className={styles.passwordHint}>
                <img 
                  src={checkPasswordUpperCase(formData.password) ? "/assets/icon/RegisterPage_CheckIcon.png" : "/assets/icon/RegisterPage_NotCheckIcon.png"} 
                  alt="大寫字母檢查"
                />
                <span>一個大寫英文字母</span>
              </div>
            </div>
            <div className={styles.passwordContainer}>
              <input
                type={showConfirmPassword ? "text" : "password"}
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleInputChange}
                placeholder="請確認您的密碼"
                className={styles.input}
                disabled={isLoading}
              />
              <button 
                type="button"
                className={styles.passwordToggle}
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                disabled={isLoading}
              >
                <img 
                  src={showConfirmPassword ? "/assets/icon/LoginButton_HidePassword.png" : "/assets/icon/LoginButton_ShowPassword.png"} 
                  alt={showConfirmPassword ? "隱藏密碼" : "顯示密碼"}
                />
              </button>
            </div>
            <div className={styles.buttonGroup}>
              <button 
                onClick={prevStep} 
                className={styles.backButton}
                disabled={isLoading}
              >
                上一步
              </button>
              <button 
                onClick={handleSubmit} 
                className={styles.submitButton}
                disabled={isLoading}
              >
                {isLoading ? '處理中...' : '完成註冊'}
              </button>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  const { scene: fenceScene } = useGLTF('/assets/models/Fence.glb');
  const { scene: fenceScene2 } = useGLTF('/assets/models/Fence2.glb');
  const { scene: fenceScene3 } = useGLTF('/assets/models/Fence3.glb');

  return (
    <NotificationProvider>
      <div className={styles.registerPage}>
        {notification && (
          <Notification
            message={notification}
            onClose={hideNotification}
          />
        )}
        <div className={styles.canvasArea}>
          <Canvas className={styles.animationContainer} camera={{ position: [0, 0, 1], fov: 45 }}>
            {/* <Environment preset="apartment" intensity={0.0015} /> */}
            <ambientLight intensity={0.6} />
            <directionalLight position={[5, 5, 5]} intensity={1} />
            <RegisterPageAnimation />
            <OrbitControls enableZoom={false} enablePan={false} enableRotate={false} />
            <primitive object={fenceScene} position={[0, -0.15, 0.2]} scale={0.5}/>
            <primitive object={fenceScene2} position={[0.42, -0.15, 0.2]} scale={0.5}/>
            <primitive object={fenceScene3} position={[-0.42, -0.15, 0.2]} scale={0.5}/>
          </Canvas>
        </div>
        <div className={styles.formArea}>
          {renderStep()}
        </div>
      </div>
    </NotificationProvider>
  );
};

export default RegisterPage; 