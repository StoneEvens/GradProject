import React from 'react'
import './Header.css'

function Header() {
  return (
    <div className="header">
      <div className="inner-container">
        <img
          src="https://w7.pngwing.com/pngs/178/595/png-transparent-user-profile-computer-icons-login-user-avatars-thumbnail.png"
          alt="頭像"
          className="avatar"
        />
        <div className="notification">🔔</div>
      </div>
    </div>
  )
}

export default Header
