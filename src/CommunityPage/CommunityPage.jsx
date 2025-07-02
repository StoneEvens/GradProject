import React from 'react';
import './CommunityPage.css';
import Header from '../components/Header';
import SearchBar from '../components/SearchBar';
import BottomNavigationBar from '../components/BottomNavigationBar';
import userProfileIcon from '../assets/icon/HeaderButton_UserProfile.png';
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

function Post({ post }) {
  const navigate = useNavigate();
  return (
    <div className="post-container" onClick={() => navigate(`/community-post/${post.id}`)} style={{ cursor: 'pointer' }}>
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
  );
}

function CommunityPage() {
  return (
    <form className="community-page">
      <Header showSearchBar={true} />
      <div className="posts-container">
        {posts.map(post => (
          <Post key={post.id} post={post} />
        ))}
      </div>
      <BottomNavigationBar />
    </form>
  );
}

export default CommunityPage;
