import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import styles from '../styles/UserProfilePage.module.css';
import TopNavbar from '../components/TopNavbar';
import BottomNavbar from '../components/BottomNavigationbar';
import Notification from '../components/Notification';
import ConfirmFollowModal from '../components/ConfirmFollowModal';
import PostPreviewList from '../components/PostPreviewList';
import { NotificationProvider } from '../context/NotificationContext';
import { getOtherUserProfile, getUserPostsPreview, getUserArchives, getUserSummary } from '../services/userService';
import { getUserFollowStatus, followUser } from '../services/socialService';

const OtherUserProfilePage = () => {
  const { userAccount } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('community');
  const [notification, setNotification] = useState('');
  const [user, setUser] = useState(null);
  const [userSummary, setUserSummary] = useState(null);
  const [postsPreview, setPostsPreview] = useState([]);
  const [archives, setArchives] = useState([]);
  const [loading, setLoading] = useState(true);
  const [followState, setFollowState] = useState({
    is_following: false,
    is_requested: false
  });
  const [canViewContent, setCanViewContent] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  useEffect(() => {
    if (userAccount) {
      fetchData();
    }
  }, [userAccount]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 獲取用戶基本資料
      const userData = await getOtherUserProfile(userAccount);
      setUser(userData);
      
      // 獲取追蹤狀態
      const followStatus = await getUserFollowStatus(userAccount);
      setFollowState({
        is_following: followStatus.is_following || false,
        is_requested: followStatus.is_requested || false
      });
      
      // 判斷是否可以查看內容
      const canView = userData.account_privacy === 'public' || followStatus.is_following;
      setCanViewContent(canView);
      
      // 始終載入用戶摘要（追蹤數據）
      await loadUserSummary(userAccount);
      
      if (canView) {
        // 可以查看內容時才載入貼文和檔案
        await Promise.all([
          loadUserPosts(userAccount),
          loadUserArchives(userAccount)
        ]);
      }
    } catch (err) {
      console.error('載入用戶資料失敗:', err);
      setNotification('載入用戶資料失敗，請稍後再試');
      // 如果是因為用戶不存在，返回上一頁
      if (err.response?.status === 404) {
        setTimeout(() => navigate(-1), 2000);
      }
    } finally {
      setLoading(false);
    }
  };

  const loadUserSummary = async (userAccountOrId) => {
    try {
      const summary = await getUserSummary(userAccountOrId);
      setUserSummary(summary);
    } catch (summaryErr) {
      console.warn('取得用戶摘要失敗:', summaryErr);
      setUserSummary(null);
    }
  };

  const loadUserPosts = async (userAccountOrId) => {
    try {
      const posts = await getUserPostsPreview(userAccountOrId);
      setPostsPreview(Array.isArray(posts) ? posts : []);
    } catch (postsErr) {
      console.warn('取得貼文預覽失敗:', postsErr);
      setPostsPreview([]);
    }
  };

  const loadUserArchives = async (userAccountOrId) => {
    try {
      const archs = await getUserArchives(userAccountOrId);
      setArchives(Array.isArray(archs) ? archs : []);
    } catch (archsErr) {
      console.warn('取得病程紀錄失敗:', archsErr);
      setArchives([]);
    }
  };

  // 切換分頁
  const handleTabChange = (tab) => {
    setActiveTab(tab);
  };

  // 顯示通知
  const showNotification = (msg) => {
    setNotification(msg);
  };

  // 隱藏通知
  const hideNotification = () => {
    setNotification('');
  };

  // 處理追蹤按鈕點擊
  const handleFollowButtonClick = () => {
    if (!user) return;
    
    // 如果是已追蹤或已請求狀態，直接執行操作（取消追蹤）
    if (followState.is_following || followState.is_requested) {
      handleFollowToggle();
    } else {
      // 新追蹤操作：只有私人帳戶才顯示確認Modal
      if (user.account_privacy === 'private') {
        setShowConfirmModal(true);
      } else {
        // 公開帳戶直接執行追蹤
        handleFollowToggle();
      }
    }
  };

  // 確認追蹤
  const handleConfirmFollow = () => {
    setShowConfirmModal(false);
    handleFollowToggle();
  };

  // 取消確認
  const handleCancelFollow = () => {
    setShowConfirmModal(false);
  };

  // 處理追蹤切換
  const handleFollowToggle = async () => {
    try {
      const result = await followUser(userAccount);
      
      if (result.success) {
        const newFollowState = {
          is_following: result.data.is_following || false,
          is_requested: result.data.is_requested || false
        };
        setFollowState(newFollowState);
        
        // 如果成功追蹤了私人帳戶，需要重新載入內容
        if (user?.account_privacy === 'private' && newFollowState.is_following) {
          setCanViewContent(true);
          await Promise.all([
            loadUserPosts(userAccount),
            loadUserArchives(userAccount)
          ]);
        }
        
        // 追蹤和取消追蹤操作不需要顯示通知
      }
    } catch (error) {
      console.error('追蹤操作失敗:', error);
      showNotification('操作失敗，請稍後再試');
    }
  };

  // 根據用戶隱私設定和追蹤狀態獲取按鈕文字
  const getFollowButtonText = () => {
    if (!user) return '追蹤';
    
    if (followState.is_following) {
      return '追蹤中';
    }
    
    if (followState.is_requested) {
      return '已要求';
    }
    
    return user.account_privacy === 'private' ? '要求追蹤' : '追蹤';
  };

  // 根據追蹤狀態獲取按鈕樣式
  const getFollowButtonClass = () => {
    if (followState.is_following) {
      return `${styles.followButton} ${styles.following}`;
    }
    
    if (followState.is_requested) {
      return `${styles.followButton} ${styles.requested}`;
    }
    
    return styles.followButton;
  };

  // 處理追蹤統計點擊
  const handleFollowStatClick = (type) => {
    // 如果是私人帳戶且未追蹤，則不允許查看
    if (user.account_privacy === 'private' && !followState.is_following) {
      return;
    }
    navigate(`/user/${user.user_account}/follow/${type}`);
  };

  return (
    <NotificationProvider>
      <div className={styles.container}>
        <TopNavbar />
        {notification && (
          <Notification message={notification} onClose={hideNotification} />
        )}
        <main className={styles.content}>
          {loading ? (
            <div style={{textAlign: 'center', margin: '40px 0'}}>載入中...</div>
          ) : user && (
            <>
              {/* 頭像與簡介區塊 */}
              <div className={styles.profileHeader}>
                <div className={styles.avatarSection}>
                  <img 
                    src={user.headshot_url || '/assets/icon/DefaultAvatar.jpg'} 
                    alt="頭像" 
                    className={styles.avatar} 
                  />
                  <button 
                    className={getFollowButtonClass()} 
                    onClick={handleFollowButtonClick}
                  >
                    {getFollowButtonText()}
                  </button>
                </div>
                <div className={styles.profileInfo}>
                  <div className={styles.nickname}>{user.user_account}</div>
                  <div className={styles.realname}>{user.user_fullname}</div>
                  {userSummary && (
                    <div className={styles.followStats}>
                      <span 
                        className={`${styles.followStatItem} ${user.account_privacy === 'private' && !followState.is_following ? styles.disabled : ''}`}
                        onClick={() => handleFollowStatClick('followers')}
                      >
                        粉絲: {userSummary.followers_count}
                      </span>
                      <span 
                        className={`${styles.followStatItem} ${user.account_privacy === 'private' && !followState.is_following ? styles.disabled : ''}`}
                        onClick={() => handleFollowStatClick('following')}
                      >
                        追蹤中: {userSummary.following_count}
                      </span>
                    </div>
                  )}
                  <div className={styles.desc}>{user.user_intro || '這個人很低調，什麼都沒寫。'}</div>
                </div>
              </div>

              {/* 分頁切換 - 始終顯示 */}
              <div className={styles.tabs}>
                <button
                  className={`${styles.tab} ${activeTab === 'community' ? styles.active : ''}`}
                  onClick={() => handleTabChange('community')}
                >
                  社群
                </button>
                <button
                  className={`${styles.tab} ${activeTab === 'forum' ? styles.active : ''}`}
                  onClick={() => handleTabChange('forum')}
                >
                  論壇
                </button>
              </div>

              {/* tab 內容區塊 */}
              {activeTab === 'community' ? (
                user.account_privacy === 'private' && !canViewContent ? (
                  <div className={styles.photoGrid}>
                    <div style={{gridColumn: '1/4', textAlign: 'center', color: '#666', padding: '40px 20px'}}>
                      <div style={{fontSize: '1.1rem', marginBottom: '8px'}}>此帳號為私人帳號</div>
                      <div style={{fontSize: '0.9rem', color: '#999'}}>追蹤以查看他的貼文</div>
                    </div>
                  </div>
                ) : (
                  <PostPreviewList
                    posts={postsPreview}
                    loading={loading}
                    error={null}
                    emptyMessage="尚未發布任何日常貼文"
                    userId={user?.id}
                    userAccount={user?.user_account}
                  />
                )
              ) : (
                <div className={styles.photoGrid}>
                  {user.account_privacy === 'private' && !canViewContent ? (
                    <div style={{gridColumn: '1/4', textAlign: 'center', color: '#666', padding: '40px 20px'}}>
                      <div style={{fontSize: '1.1rem', marginBottom: '8px'}}>此帳號為私人帳號</div>
                      <div style={{fontSize: '0.9rem', color: '#999'}}>追蹤以查看他的論壇</div>
                    </div>
                  ) : archives.length === 0 ? (
                    <div style={{gridColumn: '1/4', textAlign: 'center', color: '#aaa'}}>尚未發布任何病程紀錄</div>
                  ) : archives.map((archive, idx) => (
                    <div key={archive.id} className={styles.photoCell}>
                      <div style={{color:'#333',fontSize:'0.95rem',textAlign:'center',padding:'8px',wordBreak:'break-all'}}>{archive.archive_title}</div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </main>
        <BottomNavbar />
        
        {/* 確認追蹤Modal */}
        <ConfirmFollowModal
          isVisible={showConfirmModal}
          onClose={handleCancelFollow}
          onConfirm={handleConfirmFollow}
          username={user?.user_account || ''}
          isPrivateAccount={user?.account_privacy === 'private'}
        />
      </div>
    </NotificationProvider>
  );
};

export default OtherUserProfilePage; 