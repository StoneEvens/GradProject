import React from 'react'
import './Header.css'

import notificationIcon from '../assets/icon/HeaderButton_Notification.png'
import userProfileIcon from '../assets/icon/HeaderButton_UserProfile.png'

function Header() {
  return (
    <div className="header">
      <div className="header-buttons">
        <button className="header-icon">
          <img src={userProfileIcon} alt="用戶頭像" />
        </button>
        <button className="header-icon">
          <img src={notificationIcon} alt="通知" />
        </button>
      </div>
    </div>
  )
}

export default Header
