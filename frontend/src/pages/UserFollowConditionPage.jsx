import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import styles from '../styles/UserFollowConditionPage.module.css';
import TopNavbar from '../components/TopNavbar';
import BottomNavbar from '../components/BottomNavigationbar';
import Notification from '../components/Notification';
import ConfirmFollowModal from '../components/ConfirmFollowModal';
import ConfirmRemoveFollowerModal from '../components/ConfirmRemoveFollowerModal';
import { NotificationProvider } from '../context/NotificationContext';
import { getFollowingList, getFollowersList, removeFollower } from '../services/socialService';
import { getUserFollowStatus, followUser, getUserFollowStatusBatch } from '../services/socialService';
import { getUserProfile } from '../services/userService';

const UserFollowConditionPage = () => {
  const { userAccount, type } = useParams(); // type 可以是 'followers' 或 'following'
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(type || 'followers');
  const [notification, setNotification] = useState('');
  const [followers, setFollowers] = useState([]);
  const [following, setFollowing] = useState([]);
  const [loading, setLoading] = useState(true);
  const [followStates, setFollowStates] = useState({});
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showRemoveFollowerModal, setShowRemoveFollowerModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [isViewingOwnProfile, setIsViewingOwnProfile] = useState(false);

  useEffect(() => {
    const initializeData = async () => {
      if (userAccount) {
        // 先獲取當前登入用戶的資料
        try {
          const userData = await getUserProfile();
          setCurrentUser(userData);
          setIsViewingOwnProfile(userData.user_account === userAccount);
        } catch (error) {
          console.error('獲取當前用戶資料失敗:', error);
        }
        
        await fetchData();
      }
    };
    
    initializeData();
  }, [userAccount]);

  // 載入數據
  const fetchData = async () => {
    setLoading(true);
    try {
      // 並行載入粉絲和追蹤列表
      const [followersResult, followingResult] = await Promise.all([
        getFollowersList(userAccount),
        getFollowingList(userAccount)
      ]);

      if (followersResult.success) {
        setFollowers(followersResult.data || []);
      }
      
      if (followingResult.success) {
        setFollowing(followingResult.data || []);
      }

      // 獲取所有用戶的追蹤狀態
      const allUsers = [
        ...(followersResult.data || []),
        ...(followingResult.data || [])
      ];
      
      if (allUsers.length > 0) {
        await loadFollowStates(allUsers);
      }
    } catch (error) {
      console.error('載入追蹤數據失敗:', error);
      setNotification('載入數據失敗，請稍後再試');
    } finally {
      setLoading(false);
    }
  };

  // 載入追蹤狀態
  const loadFollowStates = async (users) => {
    if (!users || users.length === 0) return;
    
    try {
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
    }
  };

  // 切換分頁
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    // 更新 URL
    navigate(`/user/${userAccount}/follow/${tab}`, { replace: true });
  };

  // 顯示通知
  const showNotification = (msg) => {
    setNotification(msg);
  };

  // 隱藏通知
  const hideNotification = () => {
    setNotification('');
  };

  // 處理按鈕點擊（追蹤按鈕或移除粉絲按鈕）
  const handleButtonClick = (user) => {
    // 如果是查看自己的粉絲列表，顯示移除粉絲功能
    if (isViewingOwnProfile && activeTab === 'followers') {
      setSelectedUser(user);
      setShowRemoveFollowerModal(true);
      return;
    }
    
    // 其他情況執行追蹤操作
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

  // 確認移除粉絲
  const handleConfirmRemoveFollower = () => {
    if (selectedUser) {
      setShowRemoveFollowerModal(false);
      handleRemoveFollower(selectedUser.user_account);
      setSelectedUser(null);
    }
  };

  // 取消移除粉絲
  const handleCancelRemoveFollower = () => {
    setShowRemoveFollowerModal(false);
    setSelectedUser(null);
  };

  // 處理追蹤切換
  const handleFollowToggle = async (userAccountOrId, userId) => {
    try {
      const result = await followUser(userAccountOrId);
      
      if (result.success) {
        // 更新追蹤狀態
        setFollowStates(prev => ({
          ...prev,
          [userId]: {
            is_following: result.data.is_following || false,
            is_requested: result.data.is_requested || false
          }
        }));
        
        // 立即重新載入數據以確保頁面資訊最新
        await fetchData();
      }
    } catch (error) {
      console.error('追蹤操作失敗:', error);
      showNotification('操作失敗，請稍後再試');
    }
  };

  // 處理移除粉絲
  const handleRemoveFollower = async (userAccount) => {
    try {
      const result = await removeFollower(userAccount);
      
      if (result.success) {
        showNotification(`已成功移除粉絲 @${userAccount}`);
        
        // 立即重新載入數據以確保頁面資訊最新
        await fetchData();
      } else {
        showNotification(result.error || '移除粉絲失敗');
      }
    } catch (error) {
      console.error('移除粉絲失敗:', error);
      showNotification('移除粉絲失敗，請稍後再試');
    }
  };

  // 根據用戶隱私設定和追蹤狀態獲取按鈕文字
  const getButtonText = (user, userFollowState) => {
    // 如果是查看自己的粉絲列表，顯示移除粉絲按鈕
    if (isViewingOwnProfile && activeTab === 'followers') {
      return '移除粉絲';
    }
    
    // 其他情況顯示追蹤相關按鈕
    if (!userFollowState) {
      return user.account_privacy === 'private' ? '要求追蹤' : '追蹤';
    }
    
    if (userFollowState.is_following) {
      return '追蹤中';
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
    navigate(`/user/${user.user_account}`);
  };

  // 處理圖片錯誤
  const handleImageError = (e) => {
    e.target.src = '/assets/icon/DefaultAvatar.jpg';
  };

  // 獲取當前顯示的用戶列表
  const getCurrentUserList = () => {
    return activeTab === 'followers' ? followers : following;
  };

  return (
    <NotificationProvider>
      <div className={styles.container}>
        <TopNavbar />
        {notification && (
          <Notification message={notification} onClose={hideNotification} />
        )}
        
        <main className={styles.content}>

          {/* 分頁切換 */}
          <div className={styles.tabContainer}>
            <button
              className={`${styles.tab} ${activeTab === 'followers' ? styles.activeTab : ''}`}
              onClick={() => handleTabChange('followers')}
            >
              {followers.length} 位粉絲
            </button>
            <button
              className={`${styles.tab} ${activeTab === 'following' ? styles.activeTab : ''}`}
              onClick={() => handleTabChange('following')}
            >
              {following.length} 人追蹤中
            </button>
          </div>

          <div className={styles.divider}></div>

          {/* 用戶列表 */}
          <div className={styles.resultsContainer}>
            {loading ? (
              <div className={styles.loading}>
                <p>載入中...</p>
              </div>
            ) : (
              <div className={styles.userList}>
                {getCurrentUserList().length === 0 ? (
                  <div className={styles.noResults}>
                    <p>{activeTab === 'followers' ? '還沒有粉絲' : '還沒有追蹤任何人'}</p>
                  </div>
                ) : (
                  getCurrentUserList().map((user) => {
                    const userFollowState = followStates[user.id];
                    const isCurrentUser = currentUser && (
                      currentUser.user_account === user.user_account ||
                      currentUser.id === user.id
                    );
                    
                    return (
                      <div key={user.id} className={styles.userItem}>
                        <img
                          src={user.headshot_url || '/assets/icon/DefaultAvatar.jpg'}
                          alt={user.user_account}
                          className={styles.userAvatar}
                          onClick={() => handleUserClick(user)}
                          onError={handleImageError}
                        />
                        <div className={styles.userInfo} onClick={() => handleUserClick(user)}>
                          <div className={styles.username}>{user.user_account}</div>
                          <div className={styles.displayName}>{user.user_fullname}</div>
                        </div>
                        {/* 如果是當前用戶自己，不顯示按鈕 */}
                        {!isCurrentUser && (
                          <button
                            className={getFollowButtonClass(userFollowState)}
                            onClick={() => handleButtonClick(user)}
                          >
                            {getButtonText(user, userFollowState)}
                          </button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </main>

        <BottomNavbar />
        
        {/* 確認追蹤Modal */}
        {showConfirmModal && selectedUser && (
          <ConfirmFollowModal
            user={selectedUser}
            onConfirm={handleConfirmFollow}
            onCancel={handleCancelFollow}
          />
        )}
        
        {/* 確認移除粉絲Modal */}
        {showRemoveFollowerModal && selectedUser && (
          <ConfirmRemoveFollowerModal
            isVisible={showRemoveFollowerModal}
            username={selectedUser.user_account}
            onConfirm={handleConfirmRemoveFollower}
            onClose={handleCancelRemoveFollower}
          />
        )}
      </div>
    </NotificationProvider>
  );
};

export default UserFollowConditionPage; 