import React, { useState } from 'react';
import './LoginPage.css';
import hideIcon from '../icons/LoginButton_HidePassword.png';
import showIcon from '../icons/LoginButton_ShowPassword.png';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [emailError, setEmailError] = useState(false);
  const [passwordError, setPasswordError] = useState(false);

  const handleSubmit = (e) => {
    // Validate input fields.
    const isEmailEmpty = email.trim() === '';
    const isPasswordEmpty = password.trim() === '';

    setEmailError(isEmailEmpty);
    setPasswordError(isPasswordEmpty);

    // Prevent submission if there are errors.
    if (isEmailEmpty || isPasswordEmpty) {
      e.preventDefault();
    }
    // If valid, the form submission is handed off to Django.
  };

  return (
    <form
      className="login-container"
      action="/login/"          // Django’s LoginView will handle this POST.
      method="POST"
      onSubmit={handleSubmit}
    >
      {/* CSRF protection – the CSRF token is injected by the Django template */}
      <input
        type="hidden"
        name="csrfmiddlewaretoken"
        value={window.CSRF_TOKEN}
      />

      <div className="login-box">
        <h1 className="login-title">寵物健康管理系統</h1>

        <div className="input-group">
          <label className="input-label">Email</label>
          <input
            type="text"
            name="username" // Django uses “username”. If you use email as username, simply treat email as the username.
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onFocus={() => setEmailError(false)}
            className={`input-field ${emailError ? 'error' : ''}`}
          />
          {emailError && <p className="error-msg">請填入Email</p>}
        </div>

        <div className="input-group">
          <label className="input-label">密碼</label>
          <div className="input-wrapper">
            <input
              type={showPassword ? "text" : "password"} // Toggle showing/hiding password.
              name="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onFocus={() => setPasswordError(false)}
              className={`input-field password-field ${passwordError ? 'error' : ''}`}
            />
            <img
              src={showPassword ? hideIcon : showIcon}
              alt="Toggle Password Visibility"
              className="toggle-password-btn"
              onClick={() => setShowPassword(!showPassword)}
            />
          </div>
          {passwordError && <p className="error-msg">請填入密碼</p>}
        </div>

        {/* This submit button will trigger the form submission to the Django LoginView */}
        <button type="submit" className="login-button">
          登入
        </button>

        <hr className="divider" />
        <p className="register-prompt">還沒有帳號？</p>
        <button
          type="button"
          className="register-button"
          onClick={() => (window.location.href = '/register')}
        >
          註冊
        </button>
      </div>
    </form>
  );
}