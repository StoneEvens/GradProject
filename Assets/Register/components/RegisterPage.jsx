import React, { useState, useEffect } from 'react';
import "./RegisterPage.css";

import checkIcon from '../icons/RegisterPage_CheckIcon.png';
import notCheckIcon from '../icons/RegisterPage_NotCheckIcon.png';
import showIcon from '../icons/LoginButton_ShowPassword.png';
import hideIcon from '../icons/LoginButton_HidePassword.png';

export default function RegisterPage() {
  // Only include the fields required by your form.
  const [username, setUsername] = useState('');
  const [password1, setPassword1] = useState('');
  const [password2, setPassword2] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Password criteria state
  const [isLengthValid, setIsLengthValid] = useState(false);
  const [hasUppercase, setHasUppercase] = useState(false);
  const [hasSymbol, setHasSymbol] = useState(false);

  // When password1 changes, update criteria
  useEffect(() => {
    setIsLengthValid(password1.length >= 8);
    setHasUppercase(/[A-Z]/.test(password1));
    setHasSymbol(/[^A-Za-z0-9]/.test(password1));
  }, [password1]);

  // Basic client-side validation.
  const handleSubmit = (e) => {
    if (!username || !password1 || !password2) {
      e.preventDefault();
      alert("請填寫所有欄位");
    } else if (password1 !== password2) {
      e.preventDefault();
      alert("兩次密碼輸入不一致");
    } else if (!isLengthValid || !hasUppercase || !hasSymbol) {
      e.preventDefault();
      alert("密碼條件未達標，請確認密碼至少 8 字元、含 1 個大寫英文及 1 個標點符號");
    }
    // If validation passes, let the browser submit the form.
  };

  return (
    <form 
      className="register-container"
      action="/register/"   // Django's registration view
      method="POST"
      onSubmit={handleSubmit}
    >
      {/* CSRF protection: ensure this token is set in your Django template */}
      <input
        type="hidden"
        name="csrfmiddlewaretoken"
        value={window.CSRF_TOKEN}
      />

      <div className="register-box">
        <h1 className="register-title">寵物健康管理系統</h1>

        <div className="input-group">
          <label className="input-label">帳號</label>
          <input
            type="text"
            name="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="input-field"
          />
          <p className="input-hint">限英文、數字或標點符號</p>
        </div>

        <div className="input-group password-with-check">
          <label className="input-label">創建密碼</label>
          <div className="input-wrapper">
            <input
              type={showPassword ? "text" : "password"} // browser masks input if type="password"
              name="password1"
              value={password1}
              onChange={(e) => setPassword1(e.target.value)}
              className="input-field password-field"
            />
            <img
              src={showPassword ? hideIcon : showIcon}
              alt="Toggle Password"
              className="toggle-password-btn"
              onClick={() => setShowPassword(!showPassword)}
            />
          </div>

          <div className="password-check">
            <div className="check-item">
              <img src={isLengthValid ? checkIcon : notCheckIcon} alt="check" />
              <span>8 字元以上</span>
            </div>
            <div className="check-item">
              <img src={hasUppercase ? checkIcon : notCheckIcon} alt="check" />
              <span>1 個大寫英文</span>
            </div>
            <div className="check-item">
              <img src={hasSymbol ? checkIcon : notCheckIcon} alt="check" />
              <span>1 個標點符號</span>
            </div>
          </div>
        </div>

        <div className="input-group">
          <label className="input-label">確認密碼</label>
          <div className="input-wrapper">
            <input
              type={showPassword ? "text" : "password"}
              name="password2"
              value={password2}
              onChange={(e) => setPassword2(e.target.value)}
              className="input-field password-field"
            />
          </div>
        </div>

        <button type="submit" className="register-button">
          註冊
        </button>
      </div>
    </form>
  );
}