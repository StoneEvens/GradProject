import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import styles from '../styles/UserProfilePage.module.css';
import TopNavbar from '../components/TopNavbar';
import BottomNavbar from '../components/BottomNavigationbar';
import Notification from '../components/Notification';
import EditProfileModal from '../components/EditProfileModal';
import PostPreviewList from '../components/PostPreviewList';
import ArchiveList from '../components/ArchiveList';
import { NotificationProvider } from '../context/NotificationContext';
import { getUserProfile, getUserPostsPreview, getUserArchives, getUserSummary, updateUserProfile } from '../services/userService';

const UserProfilePage = () => {
  const { t } = useTranslation('profile');
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('community');
  const [notification, setNotification] = useState('');
  const [user, setUser] = useState(null);
  const [userSummary, setUserSummary] = useState(null);
  const [postsPreview, setPostsPreview] = useState([]);
  const [archives, setArchives] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  
  // 貼文分頁相關狀態
  const [postsLoading, setPostsLoading] = useState(false);
  const [postsError, setPostsError] = useState(null);
  const [postsHasMore, setPostsHasMore] = useState(true);
  const [postsPage, setPostsPage] = useState(0);

  // 從URL參數初始化標籤
  useEffect(() => {
    const tabFromUrl = searchParams.get('tab') || 'community';
    setActiveTab(tabFromUrl);
  }, [searchParams]);

  // 載入貼文預覽（支援分頁）
  const loadPostsPreview = async (userId, pageNum = 0, isLoadMore = false) => {
    try {
      if (!isLoadMore) {
        setPostsLoading(true);
        setPostsError(null);
      }
      
      const result = await getUserPostsPreview(userId, {
        offset: pageNum * 15,
        limit: 15
      });
      
      if (result.success) {
        const newPosts = result.data.posts || [];
        
        if (isLoadMore) {
          setPostsPreview(prevPosts => [...prevPosts, ...newPosts]);
        } else {
          setPostsPreview(newPosts);
        }
        
        setPostsHasMore(result.data.has_more || false);
        setPostsPage(pageNum);
      } else {
        throw new Error(result.error || '載入貼文預覽失敗');
      }
    } catch (error) {
      console.error('載入貼文預覽失敗:', error);
      if (!isLoadMore) {
        setPostsError(error.message);
        setPostsPreview([]);
      }
    } finally {
      if (!isLoadMore) {
        setPostsLoading(false);
      }
    }
  };

  // 載入更多貼文
  const handleLoadMorePosts = async () => {
    if (!user) return;
    return loadPostsPreview(user.id, postsPage + 1, true);
  };

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
        let archs = [];
        
        // 初始載入貼文預覽（分頁方式）
        await loadPostsPreview(userData.id, 0, false);
        
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
        
        setArchives(archs);
      } catch (err) {
        console.error('載入個人資料失敗:', err);
        setNotification(t('profilePage.messages.loadProfileFailed'));
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
    // 更新URL參數
    setSearchParams({ tab });
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
        
        // 觸發全局頭像更新事件
        window.dispatchEvent(new CustomEvent('avatar-updated', {
          detail: { headshot_url: updatedUser.headshot_url }
        }));
      }
      
      setUser(updatedUser);
      showNotification(t('profilePage.messages.profileUpdateSuccess'));
      setIsEditModalOpen(false);
    } catch (error) {
      console.error('更新個人資料失敗:', error);
      showNotification(t('profilePage.messages.profileUpdateFailed'));
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
            <div style={{textAlign: 'center', margin: '40px 0'}}>{t('common.loading')}</div>
          ) : user && (
            <>
              {/* 頭像與簡介區塊 */}
              <div className={styles.profileHeader}>
                <div className={styles.avatarSection}>
                  <img src={user.headshot_url || '/assets/icon/DefaultAvatar.jpg'} alt="頭像" className={styles.avatar} />
                  <button className={styles.editButton} onClick={handleEditProfile}>{t('profilePage.editButton')}</button>
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
                        {t('profilePage.followStats.followers')}: {userSummary.followers_count}
                      </span>
                      <span
                        className={styles.followStatItem}
                        onClick={() => navigate(`/user/${user.user_account}/follow/following`)}
                      >
                        {t('profilePage.followStats.following')}: {userSummary.following_count}
                      </span>
                    </div>
                  )}
                  <div className={styles.desc}>{user.user_intro || t('profilePage.defaultIntro')}</div>
                </div>
              </div>

              {/* 分頁切換 */}
              <div className={styles.tabs}>
                <button
                  className={`${styles.tab} ${activeTab === 'community' ? styles.active : ''}`}
                  onClick={() => handleTabChange('community')}
                >
                  {t('profilePage.tabs.community')}
                </button>
                <button
                  className={`${styles.tab} ${activeTab === 'forum' ? styles.active : ''}`}
                  onClick={() => handleTabChange('forum')}
                >
                  {t('profilePage.tabs.forum')}
                </button>
              </div>

              {/* tab 內容區塊 */}
              {activeTab === 'community' ? (
                <PostPreviewList
                  posts={postsPreview}
                  loading={postsLoading}
                  error={postsError}
                  emptyMessage={t('profilePage.emptyMessages.noPosts')}
                  userId={user.id}
                  hasMore={postsHasMore}
                  onLoadMore={handleLoadMorePosts}
                  enableProgressiveLoading={true}
                />
              ) : (
                <ArchiveList
                  fetchUserArchives={true}
                  userId={user?.id} // 傳遞當前用戶的ID
                  emptyMessage={t('profilePage.emptyMessages.noArchives')}
                  onLike={(archiveId, isLiked) => console.log('疾病檔案按讚功能暫未實作')}
                  onComment={(archiveId) => console.log('Archive comment:', archiveId)}
                  onSave={(archiveId, isSaved) => console.log('疾病檔案收藏功能暫未實作')}
                  onMenuClick={(archiveId) => console.log('Archive menu:', archiveId)}
                />
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