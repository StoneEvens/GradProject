// src/pages/LoginPage.jsx
import React, { useState } from 'react'
import '../components/Auth/LoginPage.css'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [maskedPassword, setMaskedPassword] = useState('')
  const [timeoutId, setTimeoutId] = useState(null)

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

  const displayedPassword = showPassword ? password : maskedPassword

  return (
    <div className="login-container">
      <div className="login-box">
        <h1 className="login-title">寵物健康管理系統</h1>

        <div className="input-group">
          <label className="input-label">Email</label>
          <input
            type="text"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input-field"
          />
        </div>

        <div className="input-group password-group">
          <label className="input-label">密碼</label>
          <input
            type="text"
            value={displayedPassword}
            onChange={handlePasswordChange}
            className="input-field password-field"
          />
          <img
            src={
              showPassword
                ? '/assets/LoginButton_HidePassword.png'
                : '/assets/LoginButton_ShowPassword.png'
            }
            alt="Toggle Password"
            className="toggle-password-btn"
            onClick={() => setShowPassword(!showPassword)}
          />
        </div>

        <button className="login-button">登入</button>

        <hr className="divider" />

        <p className="register-prompt">還沒有帳號？</p>
        <button className="register-button">註冊</button>
      </div>
    </div>
  )
}
