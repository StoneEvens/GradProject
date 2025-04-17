import React, { useState, useEffect } from 'react'
import "../components/Auth/RegisterPage.css"

import checkIcon from '../assets/icon/RegisterPage_CheckIcon.png'
import notCheckIcon from '../assets/icon/RegisterPage_NotCheckIcon.png'
import showIcon from '../assets/icon/LoginButton_ShowPassword.png'
import hideIcon from '../assets/icon/LoginButton_HidePassword.png'

export default function RegisterPage() {
  const [name, setName] = useState('')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [maskedPassword, setMaskedPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [timeoutId, setTimeoutId] = useState(null)

  // 密碼條件檢查
  const [isLengthValid, setIsLengthValid] = useState(false)
  const [hasUppercase, setHasUppercase] = useState(false)
  const [hasSymbol, setHasSymbol] = useState(false)

  const handlePasswordChange = (e) => {
    const inputType = e.nativeEvent.inputType
    const isDelete = inputType === 'deleteContentBackward'
  
    if (showPassword) {
      // 顯示狀態：正常輸入
      setPassword(e.target.value)
      setMaskedPassword(e.target.value)
    } else {
      if (isDelete) {
        // 刪除一個字元
        setPassword((prev) => {
          const updated = prev.slice(0, -1)
          setMaskedPassword('*'.repeat(updated.length))
          return updated
        })
      } else {
        const newChar = e.target.value[e.target.value.length - 1]
        setPassword((prev) => {
          const updated = prev + newChar
          setMaskedPassword('*'.repeat(prev.length) + newChar)
  
          // 1 秒後遮罩該字元
          if (timeoutId) clearTimeout(timeoutId)
          const timeout = setTimeout(() => {
            setMaskedPassword('*'.repeat(updated.length))
          }, 1000)
          setTimeoutId(timeout)
  
          return updated
        })
      }
    }
  }  
  
  
  // 放在 function RegisterPage() 內任何 useState 後面
  useEffect(() => {
    setIsLengthValid(password.length >= 8)
    setHasUppercase(/[A-Z]/.test(password))
    setHasSymbol(/[^A-Za-z0-9]/.test(password))
  }, [password])
  

  const displayedPassword = showPassword ? password : maskedPassword

  return (
    <div className="register-container">
      <div className="register-box">
        <h1 className="register-title">寵物健康管理系統</h1>

        <div className="input-group">
          <label className="input-label">姓名</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input-field"
          />
          <p className="input-hint">請輸入真實姓名</p>
        </div>

        <div className="input-group">
          <label className="input-label">帳號</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="input-field"
          />
          <p className="input-hint">限英文、數字或標點符號</p>
        </div>

        <div className="input-group">
          <label className="input-label">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input-field"
          />
        </div>

        <div className="input-group password-with-check">
          <label className="input-label">創建密碼</label>
          <div className="input-wrapper">
            <input
              type="text"
              inputMode="latin"
              value={showPassword ? password : maskedPassword}
              onChange={handlePasswordChange}
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

        <button className="register-button">註冊</button>
      </div>
    </div>
  )
}
