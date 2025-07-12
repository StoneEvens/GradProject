import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import TopNavbar from '../components/TopNavbar';
import BottomNavbar from '../components/BottomNavigationbar';
import SocialSearchResults from '../components/SocialSearchResults';
import { getUserProfile } from '../services/userService';
import styles from '../styles/SocialPage.module.css';

const SocialPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  // 獲取當前用戶資訊
  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const user = await getUserProfile();
        setCurrentUser(user);
      } catch (error) {
        console.error('獲取當前用戶資訊失敗:', error);
      }
    };
    fetchCurrentUser();
  }, []);

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
    console.log('SocialPage handleUserClick - 點擊用戶:', user);
    console.log('SocialPage handleUserClick - 當前用戶:', currentUser);
    
    // 判斷是否為當前用戶
    const isCurrentUser = currentUser && (
      user.id === currentUser.id || 
      user.user_account === currentUser.user_account
    );
    
    if (isCurrentUser) {
      // 如果是當前用戶，導向自己的個人資料頁面
      console.log('SocialPage - 導航到自己的個人資料頁面');
      navigate('/user-profile');
    } else {
      // 預設行為：跳轉到其他用戶個人資料頁面
      console.log('SocialPage - 導航到其他用戶個人資料頁面:', `/user/${user.user_account}`);
      navigate(`/user/${user.user_account}`);
    }
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