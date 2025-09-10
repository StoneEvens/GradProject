import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import TopNavbar from '../components/TopNavbar';
import BottomNavbar from '../components/BottomNavigationbar';
import SocialSearchResults from '../components/SocialSearchResults';
import PostList from '../components/PostList';
import ArchiveList from '../components/ArchiveList';
import { getUserProfile } from '../services/userService';
import { getPosts } from '../services/socialService';
import { getPublicDiseaseArchivesPreview } from '../services/petService';
import styles from '../styles/SocialPage.module.css';

const SocialPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [activeTab, setActiveTab] = useState('daily'); // 新增 tab 狀態
  
  // 貼文相關狀態
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);

  // 論壇相關狀態
  const [archives, setArchives] = useState([]);
  const [archivesLoading, setArchivesLoading] = useState(false);
  const [archivesError, setArchivesError] = useState(null);
  const [archivesHasMore, setArchivesHasMore] = useState(true);
  const [archivesPage, setArchivesPage] = useState(0);

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

  // 載入貼文
  const loadPosts = async (pageNum = 0, isLoadMore = false) => {
    try {
      if (!isLoadMore) {
        setLoading(true);
        setError(null);
      }
      
      const result = await getPosts({
        offset: pageNum * 10,
        limit: 10
      });
      
      if (result.success) {
        const newPosts = result.data.posts || [];
        
        if (isLoadMore) {
          setPosts(prevPosts => [...prevPosts, ...newPosts]);
        } else {
          setPosts(newPosts);
        }
        
        setHasMore(result.data.has_more || false);
        setPage(pageNum);
      } else {
        throw new Error(result.error || '載入貼文失敗');
      }
    } catch (error) {
      console.error('載入貼文失敗:', error);
      if (!isLoadMore) {
        setError(error.message);
        setPosts([]);
      }
    } finally {
      if (!isLoadMore) {
        setLoading(false);
      }
    }
  };

  // 載入疾病檔案
  const loadArchives = async (pageNum = 0, isLoadMore = false) => {
    try {
      if (!isLoadMore) {
        setArchivesLoading(true);
        setArchivesError(null);
      }
      
      const result = await getPublicDiseaseArchivesPreview({
        offset: pageNum * 10,
        limit: 10
      });
      
      if (result.success) {
        const newArchives = result.data.archives || [];
        
        if (isLoadMore) {
          setArchives(prevArchives => [...prevArchives, ...newArchives]);
        } else {
          setArchives(newArchives);
        }
        
        setArchivesHasMore(result.data.has_more || false);
        setArchivesPage(pageNum);
      } else {
        throw new Error(result.error || '載入疾病檔案失敗');
      }
    } catch (error) {
      console.error('載入疾病檔案失敗:', error);
      if (!isLoadMore) {
        setArchivesError(error.message);
        setArchives([]);
      }
    } finally {
      if (!isLoadMore) {
        setArchivesLoading(false);
      }
    }
  };

  // 初始載入資料
  useEffect(() => {
    if (!showSearchResults) {
      if (activeTab === 'daily') {
        loadPosts(0, false);
      } else if (activeTab === 'forum') {
        loadArchives(0, false);
      }
    }
  }, [showSearchResults, activeTab]);

  // 監聽貼文更新
  useEffect(() => {
    if (location.state?.postUpdated) {
      console.log('檢測到貼文更新，重新載入貼文列表');
      // 清除更新標記並重新載入
      window.history.replaceState({}, document.title);
      if (!showSearchResults) {
        loadPosts(0, false);
      }
    }
  }, [location.state, showSearchResults]);

  // 從URL參數和location state初始化搜尋狀態和標籤
  useEffect(() => {
    const queryFromUrl = searchParams.get('q') || searchParams.get('query') || '';
    const queryFromState = location.state?.searchQuery || '';
    const tabFromUrl = searchParams.get('tab') || 'daily';
    
    const finalQuery = queryFromState || queryFromUrl;
    
    // 設定初始標籤
    setActiveTab(tabFromUrl);
    
    if (finalQuery) {
      setSearchQuery(finalQuery);
      setShowSearchResults(true);
      // 如果來自state，更新URL參數
      if (queryFromState) {
        setSearchParams({ q: finalQuery, tab: tabFromUrl });
      }
    } else {
      setSearchQuery('');
      setShowSearchResults(false);
    }
  }, [searchParams, location.state]);



  const handleSearchSubmit = (query) => {
    const trimmedQuery = query.trim();
    setSearchQuery(trimmedQuery);
    
    if (trimmedQuery.length > 0) {
      // 更新URL參數
      setSearchParams({ q: trimmedQuery });
      setShowSearchResults(true);
    } else {
      // 清空搜尋時回到社群首頁
      setSearchParams({});
      setShowSearchResults(false);
    }
  };

  const handleSearchChange = (query) => {
    setSearchQuery(query);
    // 如果搜尋框被清空，導向社群首頁
    if (query.trim().length === 0) {
      setSearchParams({});
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

  // 處理載入更多貼文
  const handleLoadMore = async () => {
    if (hasMore && !loading) {
      await loadPosts(page + 1, true);
    }
  };

  // 處理載入更多疾病檔案
  const handleLoadMoreArchives = async () => {
    if (archivesHasMore && !archivesLoading) {
      await loadArchives(archivesPage + 1, true);
    }
  };

  // 處理按讚 - 可選的回調，用於統計或其他需求
  const handleLike = (postId, isLiked) => {
    console.log('SocialPage 收到按讚更新通知:', { postId, isLiked });
    // Post 組件已經處理了所有邏輯，這裡只做記錄或其他非關鍵操作
    // 不需要更新 posts 狀態，因為 Post 組件會自己管理狀態
  };

  // 處理刪除貼文
  const handleDelete = (postId) => {
    console.log('SocialPage 收到貼文刪除通知:', { postId });
    // 從貼文列表中移除已刪除的貼文
    setPosts(prevPosts => prevPosts.filter(post => post.id !== postId));
  };

  // 處理留言
  const handleComment = (postId, increment = 0) => {
    console.log('留言操作:', { postId, increment });
    
    // 如果有 increment 參數，更新貼文的留言數
    if (increment !== 0) {
      setPosts(prevPosts => 
        prevPosts.map(post => {
          const currentPostId = post.id || post.post_id;
          if (currentPostId === postId) {
            return {
              ...post,
              interaction_stats: {
                ...post.interaction_stats,
                comments: (post.interaction_stats?.comments || 0) + increment
              }
            };
          }
          return post;
        })
      );
    }
    
    // 如果沒有 increment（即點擊留言按鈕），導航到貼文詳情頁面
    if (increment === 0) {
      navigate(`/post/${postId}`);
    }
  };

  // 處理標籤點擊
  const handleHashtagClick = (tagText) => {
    console.log('SocialPage handleHashtagClick - 點擊標籤:', tagText);
    
    // 設置搜尋查詢為標籤
    const hashtagQuery = `#${tagText}`;
    console.log('SocialPage handleHashtagClick - 設置搜尋查詢:', hashtagQuery);
    
    setSearchQuery(hashtagQuery);
    setShowSearchResults(true);
    
    // 更新 URL 參數
    setSearchParams({ q: hashtagQuery });
    console.log('SocialPage handleHashtagClick - 更新URL參數完成');
  };

  // 處理收藏 - 可選的回調，用於統計或其他需求
  const handleSave = (postId, isSaved) => {
    console.log('SocialPage 收到收藏更新通知:', { postId, isSaved });
    // Post 組件已經處理了所有邏輯，這裡只做記錄或其他非關鍵操作
    // 不需要更新 posts 狀態，因為 Post 組件會自己管理狀態
  };

  // 處理貼文中的用戶點擊
  const handlePostUserClick = (userInfo) => {
    // userInfo 可能來自貼文的 user_info 欄位
    const user = {
      id: userInfo.id,
      user_account: userInfo.user_account || userInfo.username,
      user_fullname: userInfo.user_fullname,
      headshot_url: userInfo.headshot_url
    };
    handleUserClick(user);
  };

  // 處理疾病檔案按讚（暫未實作）
  const handleArchiveLike = (archiveId, isLiked) => {
    console.log('疾病檔案按讚功能暫未實作');
    // 功能暫未實作
  };

  // 處理疾病檔案留言
  const handleArchiveComment = (archiveId, increment = 0) => {
    console.log('SocialPage 收到疾病檔案留言通知:', { archiveId, increment });
    
    if (increment !== 0) {
      // 更新 archives 狀態中對應檔案的留言數
      setArchives(prevArchives => 
        prevArchives.map(archive => {
          if (archive.id === archiveId) {
            const oldCount = archive.interaction_stats?.comments || 0;
            const newCount = oldCount + increment;
            console.log('SocialPage 更新檔案留言數:', { 
              archiveId, 
              oldCount, 
              increment, 
              newCount 
            });
            return {
              ...archive,
              interaction_stats: {
                ...archive.interaction_stats,
                comments: newCount
              }
            };
          }
          return archive;
        })
      );
    }
  };

  // 處理疾病檔案收藏（暫未實作）
  const handleArchiveSave = (archiveId, isSaved) => {
    console.log('疾病檔案收藏功能暫未實作');
    // 功能暫未實作
  };

  // 處理疾病檔案菜單
  const handleArchiveMenu = (archiveId) => {
    console.log('SocialPage 收到疾病檔案菜單點擊:', { archiveId });
    // TODO: 實作菜單功能
  };

  // 處理疾病檔案刪除或轉為私人
  const handleArchiveDelete = (archiveId) => {
    console.log('SocialPage 收到檔案刪除或轉為私人通知:', { archiveId });
    
    // 從 archives 狀態中移除被刪除或轉為私人的檔案
    setArchives(prevArchives => 
      prevArchives.filter(archive => archive.id !== archiveId)
    );
  };

  return (
    <div className={styles.container}>
      <TopNavbar 
        onSearchSubmit={handleSearchSubmit}
        onSearchChange={handleSearchChange}
        initialSearchValue={searchQuery}
      />
      
      {/* 分頁切換 */}
      {!showSearchResults && (
        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${activeTab === 'daily' ? styles.active : ''}`}
            onClick={() => {
              setActiveTab('daily');
              setSearchParams({ tab: 'daily' });
            }}
          >
            日常貼文
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'forum' ? styles.active : ''}`}
            onClick={() => {
              setActiveTab('forum');
              setSearchParams({ tab: 'forum' });
            }}
          >
            寵物論壇
          </button>
        </div>
      )}
      
      <div className={styles.content}>
        {showSearchResults ? (
          <SocialSearchResults 
            searchQuery={searchQuery}
            onUserClick={handleUserClick}
          />
        ) : (
          <div className={styles.postsSection}>
            {activeTab === 'daily' ? (
              <PostList
                posts={posts}
                loading={loading}
                error={error}
                hasMore={hasMore}
                onLoadMore={handleLoadMore}
                onLike={handleLike}
                onComment={handleComment}
                onSave={handleSave}
                onDelete={handleDelete}
                onUserClick={handlePostUserClick}
                onHashtagClick={handleHashtagClick}
                emptyMessage="目前沒有貼文，快來發布第一篇吧！"
                className={styles.postList}
              />
            ) : (
              <ArchiveList
                archives={archives}
                loading={archivesLoading}
                error={archivesError}
                hasMore={archivesHasMore}
                onLoadMore={handleLoadMoreArchives}
                onLike={handleArchiveLike}
                onComment={handleArchiveComment}
                onSave={handleArchiveSave}
                onUserClick={handleUserClick}
                onMenuClick={handleArchiveMenu}
                onArchiveDelete={handleArchiveDelete}
                emptyMessage="目前沒有疾病檔案，快來分享第一篇吧！"
                className={styles.archiveList}
              />
            )}
          </div>
        )}
      </div>
      <BottomNavbar />
    </div>
  );
};

export default SocialPage; 