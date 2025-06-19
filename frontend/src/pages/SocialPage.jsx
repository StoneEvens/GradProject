import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import TopNavbar from '../components/TopNavbar';
import BottomNavbar from '../components/BottomNavbar';
import SocialSearchResults from '../components/SocialSearchResults';
import styles from '../styles/SocialPage.module.css';

const SocialPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);

  // 從URL參數初始化搜尋狀態
  useEffect(() => {
    const queryFromUrl = searchParams.get('query') || '';
    if (queryFromUrl) {
      setSearchQuery(queryFromUrl);
      setShowSearchResults(true);
    } else {
      setSearchQuery('');
      setShowSearchResults(false);
    }
  }, [searchParams]);

  const handleSearchSubmit = (query) => {
    const trimmedQuery = query.trim();
    setSearchQuery(trimmedQuery);
    
    if (trimmedQuery.length > 0) {
      // 更新URL參數
      navigate(`/social/search?query=${encodeURIComponent(trimmedQuery)}`, { replace: false });
      setShowSearchResults(true);
    } else {
      // 清空搜尋時回到社群首頁
      navigate('/social', { replace: false });
      setShowSearchResults(false);
    }
  };

  const handleSearchChange = (query) => {
    setSearchQuery(query);
    // 如果搜尋框被清空，導向社群首頁
    if (query.trim().length === 0) {
      navigate('/social', { replace: false });
      setShowSearchResults(false);
    }
  };

  const handleUserClick = (user) => {
    // 處理用戶點擊事件（導向用戶資料頁面等）
    console.log('點擊用戶:', user);
    navigate(`/user/${user.user_account}`);
  };

  return (
    <div className={styles.container}>
      <TopNavbar 
        onSearchSubmit={handleSearchSubmit}
        onSearchChange={handleSearchChange}
        initialSearchValue={searchQuery}
      />
      <div className={styles.content}>
        {showSearchResults ? (
          <SocialSearchResults 
            searchQuery={searchQuery}
            onUserClick={handleUserClick}
          />
        ) : (
          <div className={styles.placeholder}>
            <h2>社群頁面</h2>
            <p>請使用上方搜尋框搜尋用戶</p>
            <p className={styles.hint}>輸入任何內容即可看到搜尋結果示例</p>
          </div>
        )}
      </div>
      <BottomNavbar />
    </div>
  );
};

export default SocialPage; 