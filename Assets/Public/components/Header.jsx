import React from 'react'
import './Header.css'
import SearchBar from './SearchBar'
import notificationIcon from '../icons/HeaderButton_Notification.png'
import homePageIcon from '../icons/HeaderButton_HomePage.png'

function Header({ showSearchBar }) {
  return (
    <div className="header">
      <div className="header-buttons">
        <button className="header-icon" type="button" onClick={() => window.location.href = '/home'}>
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
    </div>
  )
}

export default Header
