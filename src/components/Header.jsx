import React from 'react'
import './Header.css'

import notificationIcon from '../assets/icon/HeaderButton_Notification.png'
import homePageIcon from '../assets/icon/HeaderButton_HomePage.png'
import userProfileIcon from '../assets/icon/HeaderButton_UserProfile.png'
import { useNavigate } from 'react-router-dom';

function Header() {
  const navigate = useNavigate();
  return (
    <div className="header">
      <div className="header-buttons">
        <button className="header-icon">
          <img src={userProfileIcon} alt="用戶頭像" />
        </button>
        <div className="header-right-group">
          <button className="header-icon">
            <img src={notificationIcon} alt="通知" />
          </button>
          <button className="header-icon" onClick={() => navigate('/Home')}>
            <img src={homePageIcon} alt="首頁" />
          </button>
        </div>
      </div>
    </div>
  )
}

export default Header
