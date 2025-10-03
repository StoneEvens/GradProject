import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import styles from '../styles/RecommendedUsersPreview.module.css';
import { getUserFollowStatus, followUser, getUserFollowStatusBatch } from '../services/socialService';
import { getUserProfile } from '../services/userService';
import ConfirmFollowModal from './ConfirmFollowModal';

const RecommendedUsersPreview = ({ users, onUserClick }) => {
  const navigate = useNavigate();
  const { t: tMain } = useTranslation('main');
  const { t: tPosts } = useTranslation('posts');
  const [followStates, setFollowStates] = useState({});
  const [currentUser, setCurrentUser] = useState(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);

  // 獲取當前用戶資訊
  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const user = await getUserProfile();
        setCurrentUser(user);
      } catch (error) {
        console.error('獲取當前用戶失敗:', error);
      }
    };
    fetchCurrentUser();
  }, []);

  // 載入追蹤狀態
  useEffect(() => {
    if (users && users.length > 0) {
      loadFollowStates(users);
    }
  }, [users]);

  const loadFollowStates = async (usersList) => {
    if (!usersList || usersList.length === 0) return;

    try {
      // 使用批量獲取API
      const userIds = usersList.map(user => user.id);
      const followStatus = await getUserFollowStatusBatch(userIds);
      setFollowStates(followStatus);
    } catch (error) {
      console.error('載入追蹤狀態失敗:', error);
      // Fallback到逐個獲取
      const states = {};
      for (const user of usersList) {
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

  // 處理用戶點擊
  const handleUserClick = (user) => {
    if (onUserClick) {
      onUserClick(user);
    } else {
      // 通知全局啟動浮動模式
      window.dispatchEvent(new CustomEvent('forceFloatingMode'));

      // 判斷是否為當前用戶
      const isCurrentUser = currentUser && (
        user.id === currentUser.id ||
        user.user_account === currentUser.user_account
      );

      if (isCurrentUser) {
        navigate('/user-profile');
      } else {
        navigate(`/user/${user.user_account}`);
      }
    }
  };

  // 處理追蹤按鈕點擊
  const handleFollowButtonClick = (e, user) => {
    e.stopPropagation();

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
      return user.account_privacy === 'private' ? tPosts('socialSearchResults.buttons.requestFollow') : tPosts('socialSearchResults.buttons.follow');
    }

    if (userFollowState.is_following) {
      return tPosts('socialSearchResults.buttons.following');
    }

    if (userFollowState.is_requested) {
      return tPosts('socialSearchResults.buttons.requested');
    }

    return user.account_privacy === 'private' ? tPosts('socialSearchResults.buttons.requestFollow') : tPosts('socialSearchResults.buttons.follow');
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

  // 處理頭像載入失敗
  const handleImageError = (e) => {
    e.target.src = '/assets/icon/DefaultAvatar.jpg';
  };

  if (!users || users.length === 0) {
    return null;
  }

  return (
    <>
      <div className={styles.container}>
        <div className={styles.header}>
          <span className={styles.title}>{tMain('chatWindow.recommendedUsers.title')}</span>
        </div>
        <div className={styles.userList}>
          {users.map(user => {
            const userFollowState = followStates[user.id];

            return (
              <div
                key={user.id}
                className={styles.userItem}
                onClick={() => handleUserClick(user)}
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
                <button
                  className={getFollowButtonClass(userFollowState)}
                  onClick={(e) => handleFollowButtonClick(e, user)}
                >
                  {getFollowButtonText(user, userFollowState)}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* 確認追蹤私人帳戶的 Modal */}
      {showConfirmModal && selectedUser && (
        <ConfirmFollowModal
          userName={selectedUser.user_account}
          onConfirm={handleConfirmFollow}
          onCancel={handleCancelFollow}
        />
      )}
    </>
  );
};

export default RecommendedUsersPreview;