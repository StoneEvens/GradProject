import React from 'react';
import './CommunityPost.css';
import Header from '../components/Header';
import BottomNavigationBar from '../components/BottomNavigationBar';
import userProfileIcon from '../assets/icon/HeaderButton_UserProfile.png';
import mockCat2 from '../assets/MockPicture/mockCat2.jpg';
import mockDog2 from '../assets/MockPicture/mockDog2.jpg';
import mockCat4 from '../assets/MockPicture/mockCat4.jpg';
import mockDog3 from '../assets/MockPicture/mockDog3.jpg';
import { useNavigate, useParams } from 'react-router-dom';

// 與 CommunityPage.jsx 相同的模擬貼文數據
const posts = [
  {
    id: 1,
    userId: '_threedogkeeper_',
    userAvatar: userProfileIcon,
    content: '三隻狗寶今天去安森玩耍~',
    date: '2025年02月18日',
    image: mockCat2,
  },
  {
    id: 2,
    userId: '_catparadise_',
    userAvatar: userProfileIcon,
    content: '今天帶貓咪去打預防針',
    date: '2025年02月17日',
    image: mockDog2,
  },
  {
    id: 3,
    userId: '_petslovers_',
    userAvatar: userProfileIcon,
    content: '寵物美容初體驗',
    date: '2025年02月16日',
    image: mockCat4,
  },
  {
    id: 4,
    userId: '_dogwalker_',
    userAvatar: userProfileIcon,
    content: '晨跑遛狗的美好時光',
    date: '2025年02月15日',
    image: mockDog3,
  },
];

export default function CommunityPost() {
  const navigate = useNavigate();
  const { id } = useParams();
  
  // 根據 URL 參數找到對應的貼文
  const post = posts.find(p => p.id === parseInt(id));
  
  // 如果找不到貼文，顯示錯誤訊息
  if (!post) {
    return (
      <div className="community-post-page-container">
        <Header />
        <button className="back-button" onClick={() => navigate(-1)}>
          ← 返回
        </button>
        <div className="community-post-container">
          <h2 className="post-title">貼文不存在</h2>
        </div>
        <BottomNavigationBar />
      </div>
    );
  }

  const handleGoBack = () => {
    navigate(-1);
  };

  return (
    <div className="community-post-page-container">
      <Header />
      <button className="back-button" onClick={handleGoBack}>
        ← 返回
      </button>
      <div className="community-post-container">
        <div className="post-header">
          <img src={post.userAvatar} alt="用戶頭像" className="post-avatar" />
          <span className="post-username">{post.userId}</span>
        </div>
        {post.image && (
          <div className="post-image">
            <img src={post.image} alt="貼文圖片" className="post-img-large" />
          </div>
        )}
        <div className="post-content">{post.content}</div>
        <div className="post-date">{post.date}</div>
      </div>
      <BottomNavigationBar />
    </div>
  );
}