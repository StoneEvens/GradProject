import React, { useState, useRef, useEffect } from 'react'
import './BottomNavigationBar.css'

import calculatorIcon from '../assets/icon/BottomButton_Calculator.png'
import petIcon from '../assets/icon/BottomButton_PetPage.png'
import postIcon from '../assets/icon/BottomButton_CreatePost.png'
import forumIcon from '../assets/icon/BottomButton_Forum.png'
import settingIcon from '../assets/icon/BottomButton_Setting.png'
import { useNavigate } from 'react-router-dom';

function BottomNavigationBar() {
  const navigate = useNavigate();
  const [showDialog, setShowDialog] = useState(false);
  const dialogRef = useRef(null);

  // 點擊外部關閉對話框
  useEffect(() => {
    if (!showDialog) return;
    function handleClickOutside(e) {
      if (dialogRef.current && !dialogRef.current.contains(e.target)) {
        setShowDialog(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showDialog]);

  // 按鈕點擊後延遲0.1秒關閉
  const handleDialogButtonClick = (e) => {
    e.preventDefault();
    setTimeout(() => setShowDialog(false), 100);
  };

  // 防止表單提交
  const handleSubmit = (e) => {
    e.preventDefault();
  };

  // 處理導航按鈕點擊
  const handleNavButtonClick = (e, action) => {
    e.preventDefault();
    if (typeof action === 'function') {
      action();
    }
  };

  return (
    <form className="bottom-nav" onSubmit={handleSubmit}>
      {showDialog && (
        <div className="create-post-dialog" ref={dialogRef}>
          <div className="dialog-arrow"></div>
          <button type="button" className="dialog-tab" onClick={handleDialogButtonClick}>日常紀錄</button>
          <button type="button" className="dialog-tab" onClick={handleDialogButtonClick}>症狀紀錄</button>
        </div>
      )}
      <div className="nav-buttons-container">
        <button type="button" className="nav-icon" onClick={e => handleNavButtonClick(e)}>
          <img src={calculatorIcon} alt="Calculator" />
        </button>
        <button type="button" className="nav-icon" onClick={e => handleNavButtonClick(e)}>
          <img src={petIcon} alt="Pet" />
        </button>
        <button type="button" className="nav-icon" onClick={e => handleNavButtonClick(e, () => setShowDialog(v => !v))}>
          <img src={postIcon} alt="Add" />
        </button>
        <button type="button" className="nav-icon" onClick={e => handleNavButtonClick(e, () => navigate('/ProfilePage'))}>
          <img src={forumIcon} alt="Forum" />
        </button>
        <button type="button" className="nav-icon" onClick={e => handleNavButtonClick(e)}>
          <img src={settingIcon} alt="Settings" />
        </button>
      </div>
    </form>
  )
}

export default BottomNavigationBar
