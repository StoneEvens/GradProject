import React from 'react';
import './SearchBar.css';
import searchIcon from '../assets/icon/Community_Search.png';

function SearchBar() {
  return (
    <div className="search-bar-container">
      <input
        type="text"
        className="search-input"
        placeholder="搜尋..."
      />
      <img
        src={searchIcon}
        alt="搜尋"
        className="search-icon"
      />
    </div>
  );
}

export default SearchBar;
