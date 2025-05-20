import React, { useState } from 'react'
import './LoginPage.css'
import hideIcon from '../icons/LoginButton_HidePassword.png';
import showIcon from '../icons/LoginButton_ShowPassword.png';

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [maskedPassword, setMaskedPassword] = useState('')
  const [timeoutId, setTimeoutId] = useState(null)
  const [emailError, setEmailError] = useState(false)
  const [passwordError, setPasswordError] = useState(false)

  const handlePasswordChange = (e) => {
    const input = e.target.value
    setPassword(input)

    if (timeoutId) clearTimeout(timeoutId)
    const id = setTimeout(() => {
      setMaskedPassword('*'.repeat(input.length))
    }, 1000)

    setMaskedPassword(input)
    setTimeoutId(id)
  }

  const handleLogin = () => {
    const isEmailEmpty = email.trim() === ''
    const isPasswordEmpty = password.trim() === ''

    setEmailError(isEmailEmpty)
    setPasswordError(isPasswordEmpty)

    if (isEmailEmpty && isPasswordEmpty) {
      e.preventDefault()
    }
  }

  const handleEmailFocus = () => setEmailError(false)
  const handlePasswordFocus = () => setPasswordError(false)
  const displayedPassword = showPassword ? password : maskedPassword

  return (
    <form
      className="login-container"
      action="/login/"          // Django’s LoginView will handle this POST.
      method="POST"
      onSubmit={handleLogin}
    >
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
            name="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onFocus={handleEmailFocus}
            className={`input-field ${emailError ? 'error' : ''}`}
          />
          {emailError && <p className="error-msg">請填入Email</p>}
        </div>

        <div className="input-group">
          <label className="input-label">密碼</label>
          <div className="input-wrapper">
            <input
              type={showPassword ? "text" : "password"}
              name="password"
              value={displayedPassword}
              onChange={handlePasswordChange}
              onFocus={handlePasswordFocus}
              className={`input-field password-field ${passwordError ? 'error' : ''}`}
            />
            <img
              src={showPassword ? hideIcon : showIcon}
              alt="Toggle Password"
              className="toggle-password-btn"
              onClick={() => setShowPassword(!showPassword)}
            />
          </div>
          {passwordError && <p className="error-msg">請填入密碼</p>}
        </div>

        <button className="login-button">
          登入
        </button>

        <hr className="divider" />
        <p className="register-prompt">還沒有帳號？</p>
        <button className="register-button" type="button" onClick={() => (window.location.href = '/register')}>
          註冊
        </button>
      </div>
    </form>
  )
}
