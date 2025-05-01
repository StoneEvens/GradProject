import React from 'react'
import './Header.css'

import notificationIcon from '../assets/icon/HeaderButton_Notification.png'
import homePageIcon from '../assets/icon/HeaderButton_HomePage.png'
import { useNavigate } from 'react-router-dom';

function Header() {
  const navigate = useNavigate();
  return (
    <form className="header">
      <div className="header-buttons">
        <button className="header-icon" onClick={() => navigate('/Home')}>
          <img src={homePageIcon} alt="首頁" />
        </button>
        <div className="header-right-group">
          <button className="header-icon">
            <img src={notificationIcon} alt="通知" />
          </button>
        </div>
      </div>
    </form>
  )
}

export default Header
