import React, { useState } from 'react';
import styles from '../styles/LoginPage.module.css';
import Notification from '../components/Notification';
import { NotificationProvider } from '../context/NotificationContext';
import { useNavigate } from 'react-router-dom';
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

      window.dispatchEvent(new Event('auth-change'));
      showNotification('登入成功！');

      setTimeout(() => {
        navigate('/main');
      }, 1500);

    } catch (error) {
      let errorMessage = '登入失敗，請稍後再試';

      if (error.response) {
        if (error.response.data?.non_field_errors) {
          errorMessage = error.response.data.non_field_errors[0];
        }
        else if (error.response.data?.data?.errors?.non_field_errors) {
          errorMessage = error.response.data.data.errors.non_field_errors[0];
        }
        else if (error.response.data?.message) {
          errorMessage = error.response.data.message;
        }
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

  return (
    <NotificationProvider>
      <div className={styles.container}>
        {notification && (
          <Notification
            message={notification}
            onClose={hideNotification}
          />
        )}
        <div className={styles.formWrapper}>
          <form onSubmit={handleSubmit} noValidate>
            <div className={styles.accountInput}>
              <input
                type="email"
                name="accountName"
                value={formData.accountName}
                onChange={handleInputChange}
                placeholder="請輸入註冊信箱"
                className={styles.input}
                disabled={isLoading}
              />
            </div>
            <div className={styles.passwordInputWrapper}>
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
            <button
              type="submit"
              className={styles.loginButton}
              disabled={isLoading}
              aria-label={isLoading ? '登入中...' : '登入'}
            >
              {isLoading ? '登入中...' : '登入'}
            </button>
          </form>
        </div>
      </div>
    </NotificationProvider>
  );
};

export default LoginPage;