import React, { useState, useEffect } from 'react';
import './ForumPage.css';
import Header from '../components/Header';
import BottomNavigationBar from '../components/BottomNavigationBar';
import mockProfile1 from '../assets/MockPicture/mockProfile1.png';
import mockProfile2 from '../assets/MockPicture/mockProfile2.png';
import mockProfile3 from '../assets/MockPicture/mockProfile3.png';

const ForumPage = () => {
  const [posts, setPosts] = useState([
    {
      id: 1,
      avatar: mockProfile1,
      userId: 'cat_lover123',
      title: '我家貓咪最近食慾不振怎麼辦？',
      content: '最近發現我家的小橘貓都不太吃東西，已經持續三天了。平常最愛的罐頭也提不起興趣，請問有人有類似的經驗嗎？',
      likes: 15,
      hasImage: true,
      isLiked: false
    },
    {
      id: 2,
      avatar: mockProfile2,
      userId: 'pet_care_expert',
      title: '分享：如何訓練貓咪使用貓砂盆',
      content: '經過三個月的訓練，終於成功讓我家新來的貓咪學會使用貓砂盆了！以下是幾個重要的訓練技巧...',
      likes: 28,
      hasImage: false,
      isLiked: false
    },
    {
      id: 3,
      avatar: mockProfile3,
      userId: 'meow_master',
      title: '貓咪結紮後需要注意什麼？',
      content: '下週要帶我家母貓去結紮，想請教有經驗的貓奴們，術後照顧需要注意哪些事項？',
      likes: 42,
      hasImage: true,
      isLiked: false
    }
  ]);

  // 預留未來串接後端 API 的區塊
  useEffect(() => {
    // TODO: 串接後端 API 取得論壇貼文資料
    // fetch('/api/forum/posts')
    //   .then(res => res.json())
    //   .then(data => setPosts(data));
  }, []);

  const handleLike = (postId) => {
    setPosts(posts.map(post => {
      if (post.id === postId) {
        return {
          ...post,
          likes: post.isLiked ? post.likes - 1 : post.likes + 1,
          isLiked: !post.isLiked
        };
      }
      return post;
    }));
  };

  return (
    <div className="forum-page-with-nav">
      <Header showSearchBar={false} />
      <div className="app-container">
        <div className="forum-page-content">
          {posts.map(post => (
            <div key={post.id} className="forum-post">
              <div className="post-header">
                <img src={post.avatar} alt="用戶頭像" className="user-avatar" />
                <span className="user-id">{post.userId}</span>
                <button 
                  className={`like-button ${post.isLiked ? 'liked' : ''}`}
                  onClick={() => handleLike(post.id)}
                >
                  ❤️ {post.likes}
                </button>
              </div>
              <div className="post-content">
                <div className="post-main">
                  <h3 className="post-title">{post.title}</h3>
                  <p className="post-text">{post.content}</p>
                </div>
                {post.hasImage && (
                  <div className="post-image">
                    <div className="image-placeholder"></div>
                  </div>
                )}
              </div>
              <div className="post-footer"></div>
            </div>
          ))}
        </div>
      </div>
      <BottomNavigationBar />
    </div>
  );
};

export default ForumPage;
