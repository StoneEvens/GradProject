import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from '../styles/RecommendedUsersPreview.module.css';
import aiRecommendationService from '../services/aiRecommendationService';

const RecommendedUsersPreview = ({ onUserClick }) => {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // 獲取推薦用戶
  useEffect(() => {
    const fetchRecommendedUsers = async () => {
      setIsLoading(true);

      try {
        // 使用推薦服務獲取用戶
        const result = await aiRecommendationService.getRecommendedUsers({
          context: 'chat_recommendation',
          pet_type: 'cat',
          interest: 'ragdoll'
        });

        if (result.success) {
          setUsers(result.users);
        } else {
          console.error('獲取推薦用戶失敗:', result.error);
          setUsers([]);
        }
      } catch (error) {
        console.error('獲取推薦用戶過程中發生錯誤:', error);
        setUsers([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRecommendedUsers();
  }, []);

  // 處理用戶點擊
  const handleUserClick = (user) => {
    if (onUserClick) {
      onUserClick(user);
    } else {
      // 使用推薦服務處理用戶點擊
      aiRecommendationService.handleUserClick(user, navigate);
    }
  };

  // 處理頭像載入失敗
  const handleImageError = (e) => {
    e.target.src = '/assets/icon/DefaultAvatar.jpg';
  };

  if (isLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <span className={styles.title}>推薦用戶</span>
        </div>
        <div className={styles.loading}>
          <p>載入中...</p>
        </div>
      </div>
    );
  }

  if (users.length === 0) {
    return null;
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.title}>推薦用戶</span>
      </div>
      <div className={styles.userList}>
        {users.map(user => (
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
              className={styles.followButton}
              onClick={(e) => {
                e.stopPropagation();
                // TODO: 實現追蹤功能
                console.log('Follow user:', user.user_account);
              }}
            >
              追蹤
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default RecommendedUsersPreview;