import React from 'react';
import '../styles/SearchBar.css';

function SearchBar({ onSearch, placeholder = "搜尋..." }) {
  const handleInputChange = (e) => {
    if (onSearch) {
      onSearch(e.target.value);
    }
  };

  return (
    <div className="search-bar-container">
      <input
        type="text"
        className="search-input"
        placeholder={placeholder}
        onChange={handleInputChange}
      />
      <img
        src="/assets/icon/Community_Search.png"
        alt="搜尋"
        className="search-icon"
      />
    </div>
  );
}

export default SearchBar;