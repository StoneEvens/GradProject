import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import styles from '../styles/RecommendedUsersPreview.module.css';
import { getUserFollowStatus, followUser, getUserFollowStatusBatch } from '../services/socialService';
import { getUserProfile, getUserSummary } from '../services/userService';
import ConfirmFollowModal from './ConfirmFollowModal';

const RecommendedUsersPreview = ({ users, onUserClick }) => {
  const navigate = useNavigate();
  const { t: tMain } = useTranslation('main');
  const { t: tPosts } = useTranslation('posts');
  const [followStates, setFollowStates] = useState({});
  const [currentUser, setCurrentUser] = useState(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [enrichedUsers, setEnrichedUsers] = useState([]);

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

  // Enrich users (fetch user_account/user_fullname if missing) then load follow states
  useEffect(() => {
    const enrich = async () => {
      if (!users || users.length === 0) {
        setEnrichedUsers([]);
        return;
      }
      const results = await Promise.all(users.map(async (u) => {
        // Already has needed fields
        const baseId = u.id !== undefined && u.id !== null ? u.id : (u.user_id !== undefined ? u.user_id : undefined);
        // If already enriched (has user_account + user_fullname + id), just return normalized copy
        if (u.user_account && u.user_fullname && baseId !== undefined) {
          return { ...u, id: baseId };
        }
        try {
          // Try summary endpoint (supports id or account). Use id first.
          const identifier = baseId !== undefined ? baseId : (u.user_account || u.username || u.display_name);
          const summary = identifier !== undefined ? await getUserSummary(identifier) : null;
          if (summary && (summary.user_account || summary.username)) {
            return {
              ...u,
              id: summary.id !== undefined ? summary.id : baseId,
              user_account: summary.user_account || summary.username || u.user_account,
              user_fullname: summary.user_fullname || summary.display_name || u.user_fullname || u.display_name || u.name || u.username
            };
          }
        } catch (e) {
          // Silent enrichment failure; keep original
        }
        // Fallback without reliable account: mark nonFollowable to avoid 500 errors
        const fallbackAccount = u.user_account || u.username;
        const reliableAccount = (fallbackAccount && typeof fallbackAccount === 'string' && !fallbackAccount.includes(' ')) ? fallbackAccount : null;
        return {
          ...u,
          id: baseId,
          user_account: reliableAccount,
          user_fullname: u.user_fullname || u.display_name || u.name || u.username || (reliableAccount ? reliableAccount : `User ${baseId}`),
          nonFollowable: !reliableAccount
        };
      }));
      setEnrichedUsers(results);
      loadFollowStates(results);
    };
    enrich();
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
        const targetId = user.user_id ?? user.id;
        if (targetId !== undefined && targetId !== null) {
          navigate(`/user/${targetId}`);
        } else {
          // Fallback to previous username-based route if id missing
          navigate(`/user/${user.user_account}`);
        }
      }
    }
  };

  // 處理追蹤按鈕點擊
  const handleFollowButtonClick = (e, user) => {
    e.stopPropagation();

    const userFollowState = followStates[user.id];

    const userAccount = user.user_account || user.username;
    if (!userAccount) {
      console.warn('跳過追蹤：缺少可用的 user_account', user);
      return;
    }
    if (userFollowState && (userFollowState.is_following || userFollowState.is_requested)) {
      handleFollowToggle(userAccount, user.id);
    } else {
      // 私人帳戶可加入確認流程（若需要可擴展）
      handleFollowToggle(userAccount, user.id);
    }
  };

  // 確認追蹤
  const handleConfirmFollow = () => {
    if (selectedUser) {
      setShowConfirmModal(false);
      const userAccount = selectedUser.user_account || selectedUser.username;
      handleFollowToggle(userAccount, selectedUser.id);
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
      let result = await followUser(userAccount);

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

  if (!enrichedUsers || enrichedUsers.length === 0) {
    return null;
  }

  return (
    <>
      <div className={styles.container}>
        <div className={styles.header}>
          <span className={styles.title}>{tMain('chatWindow.recommendedUsers.title')}</span>
        </div>
        <div className={styles.userList}>
          {enrichedUsers.map(user => {
            const userFollowState = followStates[user.id];
            const username = user.user_account || user.account || user.username || user.display_name || `user_${user.id}`;
            const displayName = user.user_fullname || user.display_name || user.name || username;
            const disableFollow = user.nonFollowable === true;

            return (
              <div
                key={user.id}
                className={styles.userItem}
                onClick={() => handleUserClick(user)}
              >
                <img
                  src={user.headshot_url || '/assets/icon/DefaultAvatar.jpg'}
                  alt={displayName}
                  className={styles.userAvatar}
                  onError={handleImageError}
                />
                <div className={styles.userInfo}>
                  <div className={styles.username}>{username}</div>
                  <div className={styles.displayName}>{displayName}</div>
                </div>
                <button
                  className={getFollowButtonClass(userFollowState) + (disableFollow ? ' ' + styles.disabled : '')}
                  disabled={disableFollow}
                  title={disableFollow ? '此推薦缺少有效帳號，暫時無法追蹤' : ''}
                  onClick={(e) => handleFollowButtonClick(e, { ...user, user_account: username, user_fullname: displayName })}
                >
                  {disableFollow ? '無法追蹤' : getFollowButtonText(user, userFollowState)}
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