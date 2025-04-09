import React from 'react'
import './BottomNavigationBar.css'

import calculatorIcon from '../assets/icon/BottomButton_Calculator.png'
import petIcon from '../assets/icon/BottomButton_PetPage.png'
import postIcon from '../assets/icon/BottomButton_CreatePost.png'
import forumIcon from '../assets/icon/BottomButton_Forum.png'
import settingIcon from '../assets/icon/BottomButton_Setting.png'

function BottomNavigationBar() {
  return (
    <div className="bottom-nav">
      <div className="nav-buttons-container">
        <button className="nav-icon">
          <img src={calculatorIcon} alt="Calculator" />
        </button>
        <button className="nav-icon">
          <img src={petIcon} alt="Pet" />
        </button>
        <button className="nav-icon">
          <img src={postIcon} alt="Add" />
        </button>
        <button className="nav-icon">
          <img src={forumIcon} alt="Forum" />
        </button>
        <button className="nav-icon">
          <img src={settingIcon} alt="Settings" />
        </button>
      </div>
    </div>
  )
}

export default BottomNavigationBar
