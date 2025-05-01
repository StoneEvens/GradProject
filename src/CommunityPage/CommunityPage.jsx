import React from 'react';
import './CommunityPage.css';
import Header from '../components/Header';
import SearchBar from '../components/SearchBar';
import BottomNavigationBar from '../components/BottomNavigationBar';
import userProfileIcon from '../assets/icon/HeaderButton_UserProfile.png';

// 模擬貼文數據
const posts = [
  {
    id: 1,
    userId: '_threedogkeeper_',
    userAvatar: userProfileIcon,
    content: '三隻狗寶今天去安森玩耍~',
    date: '2025年02月18日',
  },
  {
    id: 2,
    userId: '_catparadise_',
    userAvatar: userProfileIcon,
    content: '今天帶貓咪去打預防針',
    date: '2025年02月17日',
  },
  {
    id: 3,
    userId: '_petslovers_',
    userAvatar: userProfileIcon,
    content: '寵物美容初體驗',
    date: '2025年02月16日',
  },
  {
    id: 4,
    userId: '_dogwalker_',
    userAvatar: userProfileIcon,
    content: '晨跑遛狗的美好時光',
    date: '2025年02月15日',
  },
];

function Post({ post }) {
  return (
    <div className="post-container">
      <div className="post-header">
        <img src={post.userAvatar} alt="用戶頭像" className="post-avatar" />
        <span className="post-username">{post.userId}</span>
      </div>
      <div className="post-image" />
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
