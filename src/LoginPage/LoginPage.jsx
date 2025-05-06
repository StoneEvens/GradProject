import React, { useState } from 'react'
import '../LoginPage/LoginPage.css'
import '../components/Header.css'
import '../components/BottomNavigationBar.css'
import { useNavigate } from 'react-router-dom'


export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [maskedPassword, setMaskedPassword] = useState('')
  const [timeoutId, setTimeoutId] = useState(null)
  const [emailError, setEmailError] = useState(false)
  const [passwordError, setPasswordError] = useState(false)
  const navigate = useNavigate()

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

    if (!isEmailEmpty && !isPasswordEmpty) {
      console.log('Login success')
    }
  }

  const handleEmailFocus = () => setEmailError(false)
  const handlePasswordFocus = () => setPasswordError(false)
  const displayedPassword = showPassword ? password : maskedPassword

  return (
    <form className="login-container">
      <div className="login-box">
        <h1 className="login-title">寵物健康管理系統</h1>

        <div className="input-group">
          <label className="input-label">Email</label>
          <input
            type="text"
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
              type="text"
              inputMode="latin"
              value={displayedPassword}
              onChange={handlePasswordChange}
              onFocus={handlePasswordFocus}
              className={`input-field password-field ${passwordError ? 'error' : ''}`}
            />
            <img
              src={
                showPassword
                  ? 'src/assets/icon/LoginButton_HidePassword.png'
                  : 'src/assets/icon/LoginButton_ShowPassword.png'
              }
              alt="Toggle Password"
              className="toggle-password-btn"
              onClick={() => setShowPassword(!showPassword)}
            />
          </div>
          {passwordError && <p className="error-msg">請填入密碼</p>}
        </div>

        <button className="login-button" onClick={handleLogin}>
          登入
        </button>

        <hr className="divider" />
        <p className="register-prompt">還沒有帳號？</p>
        <button className="register-button" onClick={() => navigate('/register')}>
          註冊
        </button>
      </div>
    </form>
  )
}
