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
  const handleDialogButtonClick = () => {
    setTimeout(() => setShowDialog(false), 100);
  };

  return (
    <form className="bottom-nav">
      {showDialog && (
        <div className="create-post-dialog" ref={dialogRef}>
          <div className="dialog-arrow"></div>
          <button className="dialog-tab" onClick={handleDialogButtonClick}>日常紀錄</button>
          <button className="dialog-tab" onClick={handleDialogButtonClick}>症狀紀錄</button>
        </div>
      )}
      <div className="nav-buttons-container">
        <button className="nav-icon">
          <img src={calculatorIcon} alt="Calculator" />
        </button>
        <button className="nav-icon">
          <img src={petIcon} alt="Pet" />
        </button>
        <button className="nav-icon" onClick={() => setShowDialog(v => !v)}>
          <img src={postIcon} alt="Add" />
        </button>
        <button className="nav-icon" onClick={() => navigate('/ProfilePage')}>
          <img src={forumIcon} alt="Forum" />
        </button>
        <button className="nav-icon">
          <img src={settingIcon} alt="Settings" />
        </button>
      </div>
    </form>
  )
}

export default BottomNavigationBar
