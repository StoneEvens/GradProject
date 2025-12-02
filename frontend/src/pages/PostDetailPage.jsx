import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import TopNavbar from '../components/TopNavbar';
import BottomNavbar from '../components/BottomNavigationBar';
import Post from '../components/Post';
import PostComments from '../components/PostComments';
import Notification from '../components/Notification';
import { NotificationProvider } from '../context/NotificationContext';
import { getPost } from '../services/socialService';
import { getUserProfile } from '../services/userService';
import styles from '../styles/PostDetailPage.module.css';

const PostDetailPage = () => {
  const { t } = useTranslation('posts');
  const { postId } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [post, setPost] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const [notification, setNotification] = useState('');
  const [showComments, setShowComments] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    loadData();
  }, [postId]);

  const loadData = async () => {
    try {
      setLoading(true);
      setLoadError(false);

      const minLoadTime = 250;
      const startTime = Date.now();

      // 並行載入貼文資料和用戶資料
      const [postResult, userProfile] = await Promise.all([
        getPost(postId),
        getUserProfile()
      ]);

      if (postResult.success && postResult.data) {
        setPost(postResult.data);
        setCurrentUser(userProfile);
      } else {
        console.error('獲取貼文失敗:', postResult.error);
        setLoadError(true);
      }

      // 確保最小載入時間
      const elapsed = Date.now() - startTime;
      if (elapsed < minLoadTime) {
        await new Promise(resolve => setTimeout(resolve, minLoadTime - elapsed));
      }

    } catch (error) {
      console.error('載入資料失敗:', error);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    navigate(-1);
  };

  // 顯示通知
  const showNotification = (msg) => {
    setNotification(msg);
  };

  // 隱藏通知
  const hideNotification = () => {
    setNotification('');
  };

  // 處理留言點擊
  const handleComment = (postId) => {
    if (post) {
      setShowComments(true);
    }
  };

  // 處理留言彈窗關閉
  const handleCommentsClose = () => {
    setShowComments(false);
  };

  // 處理貼文刪除
  const handlePostDelete = (deletedPostId) => {
    showNotification(t('post.deleteSuccess') || '貼文已刪除');
    setTimeout(() => {
      navigate(-1);
    }, 1500);
  };

  // 處理用戶點擊
  const handleUserClick = (userInfo) => {
    if (userInfo?.user_account) {
      navigate(`/user/${userInfo.user_account}`);
    }
  };

  // 處理 hashtag 點擊
  const handleHashtagClick = (tag) => {
    navigate(`/social?q=${encodeURIComponent('#' + tag)}`);
  };

  // 錯誤頁面
  if (!loading && loadError) {
    return (
      <NotificationProvider>
        <div className={styles.container}>
          <TopNavbar />
          <div className={styles.content}>
            <div className={styles.errorContainer}>
              <div className={styles.errorMessage}>
                <h3>{t('post.errorTitle') || '無法載入貼文'}</h3>
                <p>{t('post.errorDescription') || '貼文可能已被刪除或不存在'}</p>
                <div className={styles.errorButtons}>
                  <button
                    className={styles.retryButton}
                    onClick={() => {
                      setLoadError(false);
                      loadData();
                    }}
                  >
                    {t('post.retry') || '重試'}
                  </button>
                  <button
                    className={styles.backButton}
                    onClick={() => navigate(-1)}
                  >
                    {t('post.goBack') || '返回'}
                  </button>
                </div>
              </div>
            </div>
          </div>
          <BottomNavbar />
        </div>
      </NotificationProvider>
    );
  }

  return (
    <NotificationProvider>
      <div className={styles.container}>
        <TopNavbar />

        <div className={styles.content}>
          {/* 載入中 */}
          {loading && (
            <div className={styles.loadingContainer}>
              {t('common.loading') || '載入中...'}
            </div>
          )}

          {/* 主要內容 */}
          {!loading && post && (
            <>
              {/* 標題區域 */}
              <div className={styles.header}>
                <div className={styles.titleSection}>
                  <button className={styles.backButton} onClick={handleBack}>
                    ❮
                  </button>
                  <span className={styles.title}>
                    {t('post.detailTitle') || '貼文詳情'}
                  </span>
                </div>
              </div>

              <div className={styles.divider}></div>

              {/* 貼文內容 */}
              <div className={styles.postWrapper}>
                <Post
                  postData={post}
                  onComment={handleComment}
                  onDelete={handlePostDelete}
                  onUserClick={handleUserClick}
                  onHashtagClick={handleHashtagClick}
                  isInteractive={true}
                  showFullDescription={true}
                />
              </div>
            </>
          )}
        </div>

        <BottomNavbar />

        {/* 通知組件 */}
        {notification && (
          <Notification message={notification} onClose={hideNotification} />
        )}

        {/* 留言彈窗 */}
        {showComments && post && currentUser && (
          <PostComments
            postID={post.id}
            user={currentUser}
            handleClose={handleCommentsClose}
          />
        )}
      </div>
    </NotificationProvider>
  );
};

export default PostDetailPage;
