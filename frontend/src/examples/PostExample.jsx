import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import PostList from '../components/PostList';
import TopNavbar from '../components/TopNavbar';
import BottomNavbar from '../components/BottomNavigationbar';
import { NotificationProvider } from '../context/NotificationContext';

// 模擬貼文資料
const mockPosts = [
  {
    id: 1,
    user: {
      id: 1,
      user_account: 'pet_lover_123',
      username: '寵物愛好者',
      headshot_url: '/assets/icon/DefaultAvatar.jpg'
    },
    description: '今天帶我家的小貓咪去公園玩，牠看到其他小動物都很興奮！陽光很好，是個適合戶外活動的日子。',
    location: '台北市大安森林公園',
    created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2小時前
    images: [
      {
        id: 1,
        dataUrl: '/src/MockPicture/mockCat1.jpg',
        annotations: [
          {
            id: 1,
            x_position: 30,
            y_position: 40,
            display_name: '我的貓咪 - 小花',
            target_type: 'pet',
            target_id: 1
          }
        ]
      },
      {
        id: 2,
        dataUrl: '/src/MockPicture/mockCat2.jpg',
        annotations: []
      }
    ],
    hashtags: [
      { id: 1, text: '貓咪' },
      { id: 2, text: '公園' },
      { id: 3, text: '戶外活動' }
    ],
    like_count: 15,
    comment_count: 3,
    is_liked: false,
    is_saved: false
  },
  {
    id: 2,
    user: {
      id: 2,
      user_account: 'dog_parent',
      username: '狗狗爸爸',
      headshot_url: '/assets/icon/DefaultAvatar.jpg'
    },
    description: '我家的黃金獵犬最喜歡玩球了！每次看到球就會超級興奮，今天在家裡玩了一整個下午。',
    location: '新北市',
    created_at: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(), // 5小時前
    images: [
      {
        id: 3,
        dataUrl: '/src/MockPicture/mockDog1.jpg',
        annotations: [
          {
            id: 2,
            x_position: 50,
            y_position: 60,
            display_name: '黃金獵犬 - 小金',
            target_type: 'pet',
            target_id: 2
          }
        ]
      }
    ],
    hashtags: [
      { id: 4, text: '狗狗' },
      { id: 5, text: '玩球' },
      { id: 6, text: '黃金獵犬' }
    ],
    like_count: 22,
    comment_count: 7,
    is_liked: true,
    is_saved: true
  },
  {
    id: 3,
    user: {
      id: 3,
      user_account: 'animal_lover',
      username: '動物愛好者',
      headshot_url: '/assets/icon/DefaultAvatar.jpg'
    },
    description: '分享一些寵物飼料的小知識，選擇適合的飼料對寵物健康很重要！',
    location: '台中市',
    created_at: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(), // 12小時前
    images: [
      {
        id: 4,
        dataUrl: '/src/MockPicture/mockFeed1.png',
        annotations: []
      }
    ],
    hashtags: [
      { id: 7, text: '寵物飼料' },
      { id: 8, text: '營養知識' },
      { id: 9, text: '健康' }
    ],
    like_count: 8,
    comment_count: 2,
    is_liked: false,
    is_saved: false
  }
];

const PostExample = () => {
  const navigate = useNavigate();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hasMore, setHasMore] = useState(true);

  // 模擬載入貼文資料
  useEffect(() => {
    const loadPosts = async () => {
      try {
        setLoading(true);
        // 模擬 API 請求延遲
        await new Promise(resolve => setTimeout(resolve, 1000));
        setPosts(mockPosts);
        setHasMore(false); // 模擬沒有更多資料
      } catch (err) {
        setError('載入貼文失敗');
      } finally {
        setLoading(false);
      }
    };

    loadPosts();
  }, []);

  // 處理按讚 - 範例頁面的通知回調
  const handleLike = (postId, isLiked) => {
    console.log('PostExample 收到按讚通知:', { postId, isLiked });
    // Post 組件已經處理了所有邏輯
    // 這裡只是示範如何接收通知
  };

  // 處理留言
  const handleComment = (postId) => {
    console.log('留言操作:', { postId });
    // 導航到貼文詳情頁面
    navigate(`/post/${postId}`);
  };

  // 處理收藏 - 範例頁面的通知回調
  const handleSave = (postId, isSaved) => {
    console.log('PostExample 收到收藏通知:', { postId, isSaved });
    // Post 組件已經處理了所有邏輯
    // 這裡只是示範如何接收通知
  };

  // 處理用戶點擊
  const handleUserClick = (user) => {
    console.log('點擊用戶:', user);
    navigate(`/user/${user.user_account}`);
  };

  // 處理載入更多
  const handleLoadMore = async () => {
    console.log('載入更多貼文');
    
    // 模擬載入更多資料
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 這裡可以載入更多貼文
    // const morePosts = await socialService.getPosts({ offset: posts.length });
    // setPosts(prevPosts => [...prevPosts, ...morePosts]);
    
    return Promise.resolve();
  };

  return (
    <NotificationProvider>
      <div style={{ 
        minHeight: '100vh', 
        backgroundColor: '#FFF2D9',
        display: 'flex',
        flexDirection: 'column'
      }}>
        <TopNavbar />
        
        <div style={{ 
          flex: 1,
          paddingTop: '80px',
          paddingBottom: '90px'
        }}>
          <div style={{
            maxWidth: '430px',
            margin: '0 auto',
            padding: '20px 15px'
          }}>
            <h2 style={{
              fontSize: '24px',
              color: '#89350c',
              textAlign: 'center',
              marginBottom: '20px',
              fontWeight: 'bold'
            }}>
              社群貼文範例
            </h2>
            
            <PostList
              posts={posts}
              loading={loading}
              error={error}
              hasMore={hasMore}
              onLoadMore={handleLoadMore}
              onLike={handleLike}
              onComment={handleComment}
              onSave={handleSave}
              onUserClick={handleUserClick}
              emptyMessage="目前沒有貼文，快來發布第一篇吧！"
            />
          </div>
        </div>
        
        <BottomNavbar />
      </div>
    </NotificationProvider>
  );
};

export default PostExample; 