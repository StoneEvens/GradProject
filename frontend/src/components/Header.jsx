import React from 'react'
import '../styles/Header.css'
import SearchBar from './SearchBar'
import notificationIcon from '../../public/assets/icon/HeaderButton_Notification.png'
import homePageIcon from '../../public/assets/icon/HeaderButton_HomePage.png'
import { useNavigate } from 'react-router-dom';

function Header({ showSearchBar }) {
  const navigate = useNavigate();
  return (
    <form className="header">
      <div className="header-buttons">
        <button className="header-icon" onClick={() => navigate('/home')}>
          <img src={homePageIcon} alt="首頁" />
        </button>
        {showSearchBar && (
          <div className="header-search">
            <SearchBar />
          </div>
        )}
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