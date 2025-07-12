import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from '../styles/UserProfilePage.module.css';
import TopNavbar from '../components/TopNavbar';
import BottomNavbar from '../components/BottomNavigationbar';
import Notification from '../components/Notification';
import EditProfileModal from '../components/EditProfileModal';
import { NotificationProvider } from '../context/NotificationContext';
import { getUserProfile, getUserPostsPreview, getUserArchives, getUserSummary, updateUserProfile } from '../services/userService';

const UserProfilePage = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('community');
  const [notification, setNotification] = useState('');
  const [user, setUser] = useState(null);
  const [userSummary, setUserSummary] = useState(null);
  const [postsPreview, setPostsPreview] = useState([]);
  const [archives, setArchives] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const userData = await getUserProfile();
        setUser(userData);
        
        // 取得用戶摘要資訊
        let summary = null;
        try {
          summary = await getUserSummary(userData.id);
          setUserSummary(summary);
        } catch (summaryErr) {
          console.warn('取得用戶摘要失敗:', summaryErr);
          setUserSummary(null);
        }
        
        // 分別處理貼文預覽與病程紀錄，避免其中一個失敗影響整體
        let posts = [];
        let archs = [];
        
        try {
          posts = await getUserPostsPreview(userData.id);
          // 確保回傳的是陣列
          if (!Array.isArray(posts)) {
            posts = [];
          }
        } catch (postsErr) {
          console.warn('取得貼文預覽失敗:', postsErr);
          posts = [];
        }
        
        try {
          archs = await getUserArchives(userData.id);
          // 確保回傳的是陣列
          if (!Array.isArray(archs)) {
            archs = [];
          }
        } catch (archsErr) {
          console.warn('取得病程紀錄失敗:', archsErr);
          archs = [];
        }
        
        setPostsPreview(posts);
        setArchives(archs);
      } catch (err) {
        console.error('載入個人資料失敗:', err);
        setNotification('載入個人資料失敗，請稍後再試');
        // 設定預設值避免錯誤
        setPostsPreview([]);
        setArchives([]);
        setUserSummary(null);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

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

  // 開啟編輯Modal
  const handleEditProfile = () => {
    setIsEditModalOpen(true);
  };

  // 關閉編輯Modal
  const handleCloseEditModal = () => {
    setIsEditModalOpen(false);
  };

  // 儲存個人資料
  const handleSaveProfile = async (updateData) => {
    try {
      const updatedUser = await updateUserProfile(updateData);
      
      // 如果更新了頭像，在URL後面加上時間戳避免快取問題
      if (updatedUser.headshot_url && updateData.image) {
        updatedUser.headshot_url = `${updatedUser.headshot_url}?t=${Date.now()}`;
      }
      
      setUser(updatedUser);
      showNotification('個人資料更新成功！');
      setIsEditModalOpen(false);
    } catch (error) {
      console.error('更新個人資料失敗:', error);
      showNotification('個人資料更新失敗，請稍後再試');
      throw error; // 讓Modal知道操作失敗
    }
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
                  <img src={user.headshot_url || '/assets/icon/DefaultAvatar.jpg'} alt="頭像" className={styles.avatar} />
                  <button className={styles.editButton} onClick={handleEditProfile}>編輯個人資料</button>
                </div>
                <div className={styles.profileInfo}>
                  <div className={styles.nickname}>{user.user_account}</div>
                  <div className={styles.realname}>{user.user_fullname}</div>
                  {userSummary && (
                    <div className={styles.followStats}>
                      <span 
                        className={styles.followStatItem}
                        onClick={() => navigate(`/user/${user.user_account}/follow/followers`)}
                      >
                        粉絲: {userSummary.followers_count}
                      </span>
                      <span 
                        className={styles.followStatItem}
                        onClick={() => navigate(`/user/${user.user_account}/follow/following`)}
                      >
                        追蹤中: {userSummary.following_count}
                      </span>
                    </div>
                  )}
                  <div className={styles.desc}>{user.user_intro || '這個人很低調，什麼都沒寫。'}</div>
                </div>
              </div>

              {/* 分頁切換 */}
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
                <div className={styles.photoGrid}>
                  {postsPreview.length === 0 ? (
                    <div style={{gridColumn: '1/4', textAlign: 'center', color: '#aaa'}}>尚未發布任何日常貼文</div>
                  ) : postsPreview.map((post, idx) => (
                    <div key={post.id} className={styles.photoCell}>
                      {post.first_image_url ? (
                        <img src={post.first_image_url} alt={`post-${idx}`} className={styles.catPhoto} />
                      ) : (
                        <div style={{color:'#bbb',fontSize:'0.9rem',textAlign:'center',padding:'8px'}}>無圖片</div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className={styles.photoGrid}>
                  {archives.length === 0 ? (
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
        
        {/* 編輯個人資料 Modal */}
        <EditProfileModal 
          user={user}
          isOpen={isEditModalOpen}
          onClose={handleCloseEditModal}
          onSave={handleSaveProfile}
        />
      </div>
    </NotificationProvider>
  );
};

export default UserProfilePage; 