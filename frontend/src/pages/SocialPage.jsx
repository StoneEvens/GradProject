import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import TopNavbar from '../components/TopNavbar';
import BottomNavbar from '../components/BottomNavigationbar';
import SocialSearchResults from '../components/SocialSearchResults';
import PostList from '../components/PostList';
import { getUserProfile } from '../services/userService';
import { getPosts } from '../services/socialService';
import styles from '../styles/SocialPage.module.css';

const SocialPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  
  // 貼文相關狀態
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);

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

  // 初始載入貼文
  useEffect(() => {
    if (!showSearchResults) {
      loadPosts(0, false);
    }
  }, [showSearchResults]);

  // 從URL參數和location state初始化搜尋狀態
  useEffect(() => {
    const queryFromUrl = searchParams.get('q') || searchParams.get('query') || '';
    const queryFromState = location.state?.searchQuery || '';
    
    const finalQuery = queryFromState || queryFromUrl;
    
    if (finalQuery) {
      setSearchQuery(finalQuery);
      setShowSearchResults(true);
      // 如果來自state，更新URL參數
      if (queryFromState) {
        setSearchParams({ q: finalQuery });
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

  // 處理按讚
  const handleLike = async (postId, isLiked) => {
    try {
      console.log('按讚操作:', { postId, isLiked });
      
      // 更新本地狀態
      setPosts(prevPosts => 
        prevPosts.map(post => 
          post.id === postId 
            ? { 
                ...post, 
                is_liked: isLiked,
                like_count: isLiked ? (post.like_count || 0) + 1 : Math.max(0, (post.like_count || 0) - 1)
              }
            : post
        )
      );

      // TODO: 調用後端 API 進行按讚操作
      // await socialService.likePost(postId, isLiked);
      
    } catch (error) {
      console.error('按讚失敗:', error);
      throw error; // 重新拋出錯誤讓 PostList 處理
    }
  };

  // 處理留言
  const handleComment = (postId) => {
    console.log('留言操作:', { postId });
    // 導航到貼文詳情頁面
    navigate(`/post/${postId}`);
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

  // 處理收藏
  const handleSave = async (postId, isSaved) => {
    try {
      console.log('收藏操作:', { postId, isSaved });
      
      // 更新本地狀態
      setPosts(prevPosts => 
        prevPosts.map(post => 
          post.id === postId 
            ? { ...post, is_saved: isSaved }
            : post
        )
      );

      // TODO: 調用後端 API 進行收藏操作
      // await socialService.savePost(postId, isSaved);
      
    } catch (error) {
      console.error('收藏失敗:', error);
      throw error; // 重新拋出錯誤讓 PostList 處理
    }
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

  return (
    <div className={styles.container}>
      <TopNavbar 
        onSearchSubmit={handleSearchSubmit}
        onSearchChange={handleSearchChange}
        initialSearchValue={searchQuery}
      />
      <div className={styles.content}>
        {showSearchResults ? (
          <SocialSearchResults 
            searchQuery={searchQuery}
            onUserClick={handleUserClick}
          />
        ) : (
          <div className={styles.postsSection}>
            <PostList
              posts={posts}
              loading={loading}
              error={error}
              hasMore={hasMore}
              onLoadMore={handleLoadMore}
              onLike={handleLike}
              onComment={handleComment}
              onSave={handleSave}
              onUserClick={handlePostUserClick}
              onHashtagClick={handleHashtagClick}
              emptyMessage="目前沒有貼文，快來發布第一篇吧！"
              className={styles.postList}
            />
          </div>
        )}
      </div>
      <BottomNavbar />
    </div>
  );
};

export default SocialPage; 