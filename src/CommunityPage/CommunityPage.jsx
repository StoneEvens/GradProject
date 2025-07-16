import React, { useState } from 'react';
import './CommunityPage.css';
import Header from '../components/Header';
import SearchBar from '../components/SearchBar';
import BottomNavigationBar from '../components/BottomNavigationBar';
import userProfileIcon from '../assets/icon/HeaderButton_UserProfile.png';
import petPageIcon from '../assets/icon/BottomButton_PetPage.png';
import mockCat2 from '../assets/MockPicture/mockCat2.jpg';
import mockDog2 from '../assets/MockPicture/mockDog2.jpg';
import mockCat4 from '../assets/MockPicture/mockCat4.jpg';
import mockDog3 from '../assets/MockPicture/mockDog3.jpg';
import { useNavigate } from 'react-router-dom';

// 模擬貼文數據
const posts = [
  {
    id: 1,
    userId: '_threedogkeeper_',
    userAvatar: userProfileIcon,
    content: '三隻狗寶今天去安森玩耍~',
    date: '2025/02/18',
    image: mockCat2,
    petName: '可愛的貓咪 🐱',
    likes: 24,
    comments: 8,
    shares: 3,
  },
  {
    id: 2,
    userId: '_catparadise_',
    userAvatar: userProfileIcon,
    content: '今天帶貓咪去打預防針',
    date: '2025/02/17',
    image: mockDog2,
    petName: '活潑的狗狗 🐕',
    likes: 18,
    comments: 5,
    shares: 2,
  },
  {
    id: 3,
    userId: '_petslovers_',
    userAvatar: userProfileIcon,
    content: '寵物美容初體驗',
    date: '2025/02/16',
    image: mockCat4,
    petName: '優雅的貓咪 🐈',
    likes: 31,
    comments: 12,
    shares: 7,
  },
  {
    id: 4,
    userId: '_dogwalker_',
    userAvatar: userProfileIcon,
    content: '晨跑遛狗的美好時光',
    date: '2025/02/15',
    image: mockDog3,
    petName: '快樂的狗狗 🐶',
    likes: 42,
    comments: 15,
    shares: 9,
  },
];

function Post({ post }) {
  const navigate = useNavigate();
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(post.likes);
  const [showShareMessage, setShowShareMessage] = useState(false);
  const [showPetName, setShowPetName] = useState(false);

  const handleLike = (e) => {
    e.stopPropagation(); // 防止觸發貼文點擊
    setIsLiked(!isLiked);
    setLikeCount(isLiked ? likeCount - 1 : likeCount + 1);
  };

  const handleComment = (e) => {
    e.stopPropagation(); // 防止觸發貼文點擊
    // 跳轉到貼文詳細頁面並自動顯示留言輸入框
    navigate(`/community-post/${post.id}?showComment=true`);
  };

  const handleShare = async (e) => {
    e.stopPropagation(); // 防止觸發貼文點擊
    try {
      // 構建貼文連結
      const postUrl = `${window.location.origin}/community-post/${post.id}`;
      
      // 複製到剪貼簿
      await navigator.clipboard.writeText(postUrl);
      
      // 顯示提示訊息
      setShowShareMessage(true);
      
      // 3秒後自動隱藏提示訊息
      setTimeout(() => {
        setShowShareMessage(false);
      }, 3000);
      
    } catch (err) {
      console.error('複製失敗:', err);
      // 如果 navigator.clipboard 不可用，使用傳統方法
      const textArea = document.createElement('textarea');
      textArea.value = `${window.location.origin}/community-post/${post.id}`;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      
      setShowShareMessage(true);
      setTimeout(() => {
        setShowShareMessage(false);
      }, 3000);
    }
  };

  const handleUserProfile = (e) => {
    e.stopPropagation(); // 防止觸發貼文點擊
    // TODO: 跳轉到用戶個人主頁
    console.log('跳轉到用戶個人主頁:', post.userId);
    // navigate(`/user-profile/${post.userId}`);
  };

  const handlePetIdentify = (e) => {
    e.stopPropagation(); // 防止觸發貼文點擊
    setShowPetName(!showPetName);
  };

  return (
    <div className="post-container" onClick={() => navigate(`/community-post/${post.id}`)} style={{ cursor: 'pointer' }}>
      {/* 分享成功提示訊息 */}
      {showShareMessage && (
        <div className="share-message">
          已複製貼文連結！
        </div>
      )}
      
      <div className="post-header">
        <button 
          type="button" 
          className="user-profile-button" 
          onClick={handleUserProfile}
          style={{ 
            background: 'none', 
            border: 'none', 
            padding: 0, 
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center'
          }}
        >
          <img src={post.userAvatar} alt="用戶頭像" className="post-avatar" />
          <span className="post-username">{post.userId}</span>
        </button>
      </div>
      {post.image && (
        <div className="post-image">
          <img src={post.image} alt="貼文圖片" className="post-img-large" />
          <button 
            type="button" 
            className="pet-identify-button" 
            onClick={handlePetIdentify}
          >
            <img src={petPageIcon} alt="寵物識別" className="pet-identify-icon" />
          </button>
          {showPetName && (
            <div className="pet-name-popup">
              {post.petName}
            </div>
          )}
        </div>
      )}
      <div className="post-content">{post.content}</div>
      
      {/* 互動按鈕區域 */}
      <div className="post-actions">
        <button type="button" className={`action-button like-button ${isLiked ? 'liked' : ''}`} onClick={handleLike}>
          <span className="action-icon">{isLiked ? '❤️' : '🤍'}</span>
          <span className="action-text">{likeCount}</span>
        </button>
        <button type="button" className="action-button comment-button" onClick={handleComment}>
          <span className="action-icon">💬</span>
          <span className="action-text">{post.comments}</span>
        </button>
        <button type="button" className="action-button share-button" onClick={handleShare}>
          <span className="action-icon">📤</span>
          <span className="action-text">{post.shares}</span>
        </button>
      </div>
      
      <div className="post-date">{post.date}</div>
    </div>
  );
}

function CommunityPage() {
  return (
    <div className="community-page">
      <Header showSearchBar={true} />
      <div className="posts-container">
        {posts.map(post => (
          <Post key={post.id} post={post} />
        ))}
      </div>
      <BottomNavigationBar />
    </div>
  );
}

export default CommunityPage;
