import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams, useNavigate, useLocation, useParams } from 'react-router-dom';
import TopNavbar from '../components/TopNavbar';
import BottomNavbar from '../components/BottomNavigationbar';
import SocialSearchResults from '../components/SocialSearchResults';
import PostList from '../components/PostList';
import ArchiveList from '../components/ArchiveList';
import { getUserProfile } from '../services/userService';
import { getPosts, getPost } from '../services/socialService';
import { getPublicDiseaseArchivesPreview } from '../services/petService';
import styles from '../styles/SocialPage.module.css';

const SocialPage = () => {
  const { t } = useTranslation('posts');
  const { postId } = useParams();
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
        console.error(t('socialPage.messages.fetchUserFailed'), error);
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
        const allPosts = result.data.posts || [];

        console.log('🔍 API 返回貼文數據:', allPosts.length, '筆');

        // 過濾掉疾病檔案，只保留一般貼文
        // 簡單方法：一般貼文一定會有照片
        const newPosts = allPosts.filter(post => {
          // 檢查是否有圖片
          const hasImages = post.images && Array.isArray(post.images) && post.images.length > 0;

          // 簡化調試輸出
          if (!hasImages) {
            console.log(`🚫 過濾掉沒有圖片的項目 (ID: ${post.id || post.post_id})`);
          }

          // 只保留有圖片的貼文
          return hasImages;
        });

        console.log('📊 載入貼文過濾結果:', {
          總數: allPosts.length,
          過濾後: newPosts.length,
          過濾掉的: allPosts.length - newPosts.length,
          過濾後的貼文IDs: newPosts.map(p => p.id || p.post_id)
        });

        if (isLoadMore) {
          setPosts(prevPosts => [...prevPosts, ...newPosts]);
        } else {
          setPosts(newPosts);
        }
        
        setHasMore(result.data.has_more || false);
        setPage(pageNum);
      } else {
        throw new Error(result.error || t('socialPage.messages.loadPostsFailed'));
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
        throw new Error(result.error || t('socialPage.messages.loadArchivesFailed'));
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

  // 初始載入資料與代理注入處理
  useEffect(() => {
    // 若 URL 包含特定貼文 ID，載入該貼文並置頂
    if (!showSearchResults && postId) {
      (async () => {
        try {
          setLoading(true);
          setActiveTab('daily');

          // 載入特定貼文
          const targetPostResult = await getPost(postId);
          if (targetPostResult.success && targetPostResult.data) {
            const targetPost = targetPostResult.data;

            // 載入其他貼文補充列表
            try {
              const result = await getPosts({ offset: 0, limit: 10 });
              if (result.success) {
                const allPosts = result.data.posts || [];
                const newPosts = allPosts.filter(post => {
                  const hasImages = post.images && Array.isArray(post.images) && post.images.length > 0;
                  if (!hasImages) {
                    console.log(`🚫 過濾掉沒有圖片的項目 (ID: ${post.id || post.post_id})`);
                  }
                  return hasImages;
                });

                // 去除重複（如果載入的貼文中包含目標貼文）
                const deduped = newPosts.filter(p => (p.id || p.post_id) !== (targetPost.id || targetPost.post_id));
                // 將目標貼文放在第一位
                setPosts([targetPost, ...deduped]);
                setHasMore(result.data.has_more || false);
                setPage(0);
              } else {
                // 如果載入其他貼文失敗，只顯示目標貼文
                setPosts([targetPost]);
                setHasMore(false);
                setPage(0);
              }
            } catch (e) {
              // 如果載入其他貼文失敗，只顯示目標貼文
              setPosts([targetPost]);
              setHasMore(false);
              setPage(0);
            }
          } else {
            // 如果載入目標貼文失敗，顯示錯誤
            setError(t('socialPage.errors.postNotFound'));
            setPosts([]);
          }
        } catch (err) {
          console.error('載入特定貼文失敗:', err);
          setError(t('socialPage.errors.loadFailed'));
          setPosts([]);
        } finally {
          setLoading(false);
        }
      })();
      return; // 已處理特定貼文，不再執行下方一般載入
    }

    // 若來自代理注入貼文，優先處理注入流程
    const injected = location.state?.injectedPost;
    if (!showSearchResults && injected) {
      (async () => {
        try {
          setLoading(true);
          setActiveTab('daily');

          // 如果注入貼文缺少圖片，嘗試用後端資料補全（最佳化體驗，非必需）
          let primaryPost = injected;
          if (!primaryPost.images || primaryPost.images.length === 0) {
            try {
              const single = await getPost(injected.id);
              if (single.success && single.data) {
                primaryPost = single.data;
              }
            } catch (e) {
              // 靜默失敗，保留注入資料
            }
          }

          // 載入常規貼文併入列表，避免重複
          try {
            const result = await getPosts({ offset: 0, limit: 10 });
            if (result.success) {
              const allPosts = result.data.posts || [];
              const newPosts = allPosts.filter(post => {
                const hasImages = post.images && Array.isArray(post.images) && post.images.length > 0;
                if (!hasImages) {
                  console.log(`🚫 過濾掉沒有圖片的項目 (ID: ${post.id || post.post_id})`);
                }
                return hasImages;
              });

              const deduped = newPosts.filter(p => (p.id || p.post_id) !== primaryPost.id);
              setPosts([primaryPost, ...deduped]);
              setHasMore(result.data.has_more || false);
              setPage(0);
            } else {
              setPosts([primaryPost]);
              setHasMore(false);
              setPage(0);
            }
          } catch (e) {
            setPosts([primaryPost]);
            setHasMore(false);
            setPage(0);
          }
        } finally {
          setLoading(false);
          // 清除一次性狀態，避免返回時重複注入
          try {
            window.history.replaceState({}, document.title);
          } catch (e) {
            // no-op
          }
        }
      })();
      return; // 已處理注入，不再執行下方一般載入
    }

    if (!showSearchResults) {
      if (activeTab === 'daily') {
        loadPosts(0, false);
      } else if (activeTab === 'forum') {
        loadArchives(0, false);
      }
    }
  }, [showSearchResults, activeTab, location.state, postId]);

  // 監聽貼文更新
  useEffect(() => {
    if (location.state?.postUpdated) {
      console.log(t('socialPage.messages.postUpdatedDetected'));
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
    
    // 設定初始標籤；若 URL 有 postId，強制 daily
    setActiveTab(postId ? 'daily' : tabFromUrl);
    
    if (finalQuery) {
      setSearchQuery(finalQuery);
      setShowSearchResults(true);
      // 如果來自state，更新URL參數
      if (queryFromState) {
        setSearchParams({ q: finalQuery, tab: tabFromUrl });
      }
    } else {
      setSearchQuery('');
      // 若有 postId，仍維持非搜尋模式
      setShowSearchResults(false);
    }
  }, [searchParams, location.state, postId]);



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
      // 最小化（但不隱藏）AI 浮動頭像
      try {
        window.dispatchEvent(new CustomEvent('forceFloatingMode'));
      } catch (e) {}
      // 不再導航到貼文詳情頁（該路由已移除），由 PostList 內部開啟留言面板
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
{t('socialPage.tabs.daily')}
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'forum' ? styles.active : ''}`}
            onClick={() => {
              setActiveTab('forum');
              setSearchParams({ tab: 'forum' });
            }}
          >
{t('socialPage.tabs.forum')}
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
                emptyMessage={t('socialPage.messages.noPosts')}
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
                emptyMessage={t('socialPage.messages.noArchives')}
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