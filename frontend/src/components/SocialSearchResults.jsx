import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from '../styles/SocialSearchResults.module.css';
import ConfirmFollowModal from './ConfirmFollowModal';
import { searchUsers, getUserFollowStatus, followUser, getUserFollowStatusBatch } from '../services/socialService';
import { getUserProfile } from '../services/userService';

const SocialSearchResults = ({ searchQuery, onUserClick }) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('accounts');
  const [users, setUsers] = useState([]);
  const [posts, setPosts] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [followStates, setFollowStates] = useState({});
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
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

  // 搜尋用戶數據
  useEffect(() => {
    if (searchQuery && searchQuery.trim().length >= 2) {
      performSearch(searchQuery);
    } else {
      setUsers([]);
      setPosts([]);
      setError(null);
    }
  }, [searchQuery]);

  // 執行搜尋
  const performSearch = async (query) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await searchUsers(query);
      
      if (result.success) {
        setUsers(result.data.users || []);
        setPosts(result.data.posts || []);
        
        // 獲取所有用戶的追蹤狀態
        if (result.data.users && result.data.users.length > 0) {
          await loadFollowStates(result.data.users);
        }
      } else {
        setError(result.error || '搜尋失敗');
        setUsers([]);
        setPosts([]);
      }
    } catch (error) {
      console.error('搜尋錯誤:', error);
      setError('搜尋時發生錯誤');
      setUsers([]);
      setPosts([]);
    } finally {
      setIsLoading(false);
    }
  };

  // 載入追蹤狀態
  const loadFollowStates = async (users) => {
    if (!users || users.length === 0) return;
    
    try {
      setIsLoading(true);
      
      // 使用批量獲取API
      const userIds = users.map(user => user.id);
      const followStatus = await getUserFollowStatusBatch(userIds);
      
      setFollowStates(followStatus);
    } catch (error) {
      console.error('載入追蹤狀態失敗:', error);
      // 如果批量獲取失敗，fallback到逐個獲取
      const states = {};
      for (const user of users) {
        try {
          const statusInfo = await getUserFollowStatus(user.id);
          states[user.id] = {
            is_following: statusInfo.is_following || false,
            is_requested: statusInfo.is_requested || false
          };
        } catch (singleError) {
          console.error(`獲取用戶 ${user.id} 追蹤狀態失敗:`, singleError);
          states[user.id] = {
            is_following: false,
            is_requested: false
          };
        }
      }
      setFollowStates(states);
    } finally {
      setIsLoading(false);
    }
  };

  const tabs = [
    { id: 'accounts', label: '帳號' },
    { id: 'posts', label: '貼文' },
    { id: 'tags', label: '標籤' },
    { id: 'forums', label: '論壇' }
  ];

  // 處理追蹤按鈕點擊
  const handleFollowButtonClick = (user) => {
    const userFollowState = followStates[user.id];
    
    // 如果是已追蹤或已請求狀態，直接執行操作（取消追蹤）
    if (userFollowState && (userFollowState.is_following || userFollowState.is_requested)) {
      handleFollowToggle(user.user_account, user.id);
    } else {
      // 新追蹤操作：只有私人帳戶才顯示確認Modal
      if (user.account_privacy === 'private') {
        setSelectedUser(user);
        setShowConfirmModal(true);
      } else {
        // 公開帳戶直接執行追蹤
        handleFollowToggle(user.user_account, user.id);
      }
    }
  };

  // 確認追蹤
  const handleConfirmFollow = () => {
    if (selectedUser) {
      setShowConfirmModal(false);
      handleFollowToggle(selectedUser.user_account, selectedUser.id);
      setSelectedUser(null);
    }
  };

  // 取消確認
  const handleCancelFollow = () => {
    setShowConfirmModal(false);
    setSelectedUser(null);
  };

  // 處理追蹤切換
  const handleFollowToggle = async (userAccount, userId) => {
    try {
      const result = await followUser(userAccount);
      
      if (result.success) {
        // 更新追蹤狀態
        setFollowStates(prev => ({
          ...prev,
          [userId]: {
            is_following: result.data.is_following || false,
            is_requested: result.data.is_requested || false
          }
        }));
      }
    } catch (error) {
      console.error('追蹤操作失敗:', error);
    }
  };

  // 根據用戶隱私設定和追蹤狀態獲取按鈕文字
  const getFollowButtonText = (user, userFollowState) => {
    if (!userFollowState) {
      return user.account_privacy === 'private' ? '要求追蹤' : '追蹤';
    }
    
    if (userFollowState.is_following) {
      return user.account_privacy === 'private' ? '追蹤中' : '追蹤中';
    }
    
    if (userFollowState.is_requested) {
      return '已要求';
    }
    
    return user.account_privacy === 'private' ? '要求追蹤' : '追蹤';
  };

  // 根據追蹤狀態獲取按鈕樣式
  const getFollowButtonClass = (userFollowState) => {
    if (!userFollowState) {
      return styles.followButton;
    }
    
    if (userFollowState.is_following) {
      return `${styles.followButton} ${styles.following}`;
    }
    
    if (userFollowState.is_requested) {
      return `${styles.followButton} ${styles.requested}`;
    }
    
    return styles.followButton;
  };

  // 處理用戶點擊
  const handleUserClick = (user) => {
    if (onUserClick) {
      onUserClick(user);
    } else {
      // 判斷是否為當前用戶 - 同時比較 ID 和 user_account
      const isCurrentUser = currentUser && (
        user.id === currentUser.id || 
        user.user_account === currentUser.user_account
      );
      
      if (isCurrentUser) {
        // 如果是當前用戶，導向自己的個人資料頁面
        navigate('/user-profile');
      } else {
        // 預設行為：跳轉到其他用戶個人資料頁面
        navigate(`/user/${user.user_account}`);
      }
    }
  };

  // 處理頭像載入失敗
  const handleImageError = (e) => {
    e.target.src = '/assets/icon/DefaultAvatar.jpg';
  };

  return (
    <div className={styles.container}>
      {/* 標籤切換 */}
      <div className={styles.tabContainer}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`${styles.tab} ${activeTab === tab.id ? styles.activeTab : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 搜尋結果內容 */}
      <div className={styles.resultsContainer}>
        {isLoading && (
          <div className={styles.loading}>
            <p>搜尋中...</p>
          </div>
        )}

        {error && (
          <div className={styles.error}>
            <p>錯誤: {error}</p>
          </div>
        )}

        {!isLoading && !error && activeTab === 'accounts' && (
          <div className={styles.userList}>
            {users.length > 0 ? (
              users.map(user => {
                const userFollowState = followStates[user.id];
                const isCurrentUser = currentUser && (
                  user.id === currentUser.id || 
                  user.user_account === currentUser.user_account
                );
                
                return (
                  <div 
                    key={user.id} 
                    className={styles.userItem}
                    onClick={() => handleUserClick(user)}
                    style={{cursor: 'pointer'}}
                  >
                    <img 
                      src={user.headshot_url || '/assets/icon/DefaultAvatar.jpg'} 
                      alt={user.user_fullname || user.user_account}
                      className={styles.userAvatar}
                      onError={handleImageError}
                    />
                    <div className={styles.userInfo}>
                      <div className={styles.username}>{user.user_account}</div>
                      <div className={styles.displayName}>{user.user_fullname}</div>
                    </div>
                    {!isCurrentUser && (
                      <button
                        className={getFollowButtonClass(userFollowState)}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleFollowButtonClick(user);
                        }}
                      >
                        {getFollowButtonText(user, userFollowState)}
                      </button>
                    )}
                  </div>
                );
              })
            ) : (
              <div className={styles.noResults}>
                <p>找不到符合的用戶</p>
              </div>
            )}
          </div>
        )}

        {!isLoading && !error && activeTab === 'posts' && (
          <div className={styles.postList}>
            {posts.length > 0 ? (
              posts.map(post => (
                <div key={post.id} className={styles.postItem}>
                  <div className={styles.postHeader}>
                    <img 
                      src={post.user?.headshot_url || '/assets/icon/DefaultAvatar.jpg'} 
                      alt={post.user?.user_fullname}
                      className={styles.postUserAvatar}
                      onError={handleImageError}
                    />
                    <div className={styles.postUserInfo}>
                      <div className={styles.postUsername}>{post.user?.user_account}</div>
                      <div className={styles.postDate}>
                        {new Date(post.created_at).toLocaleDateString('zh-TW')}
                      </div>
                    </div>
                  </div>
                  <div className={styles.postContent}>{post.content}</div>
                  {post.first_image_url && (
                    <img 
                      src={post.first_image_url} 
                      alt="貼文圖片"
                      className={styles.postImage}
                      onError={(e) => {
                        e.target.style.display = 'none';
                      }}
                    />
                  )}
                </div>
              ))
            ) : (
              <div className={styles.noResults}>
                <p>找不到符合的貼文</p>
              </div>
            )}
          </div>
        )}

        {!isLoading && !error && (activeTab === 'tags' || activeTab === 'forums') && (
          <div className={styles.comingSoon}>
            <p>此功能正在開發中...</p>
          </div>
        )}
      </div>
      
      {/* 確認追蹤Modal */}
      <ConfirmFollowModal
        isVisible={showConfirmModal}
        onClose={handleCancelFollow}
        onConfirm={handleConfirmFollow}
        username={selectedUser?.user_account || ''}
        isPrivateAccount={selectedUser?.account_privacy === 'private'}
      />
    </div>
  );
};

export default SocialSearchResults; 