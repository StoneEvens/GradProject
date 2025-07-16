import React, { useState, useEffect } from 'react';
import './ForumPage.css';
import Header from '../components/Header';
import BottomNavigationBar from '../components/BottomNavigationBar';
import mockProfile1 from '../assets/MockPicture/mockProfile1.png';
import mockProfile2 from '../assets/MockPicture/mockProfile2.png';
import mockProfile3 from '../assets/MockPicture/mockProfile3.png';
import { useNavigate } from 'react-router-dom';

const ForumPage = () => {
  const navigate = useNavigate();
  const [posts, setPosts] = useState([
    {
      id: 1,
      avatar: mockProfile1,
      userId: 'cat_lover123',
      title: '黃金獵犬糖尿病記錄～',
      content: '自從確診糖尿病以來，我們每天固定時間打胰島素、控制飲食，生活節奏也變得更有規律。雖然過程中經歷了不少起伏，但看到牠的精神慢慢變好，真的很感動',
      likes: 15,
      hasImage: true,
      isLiked: false
    },
    {
      id: 2,
      avatar: mockProfile2,
      userId: 'pet_care_expert',
      title: '布偶貓關節發炎記錄',
      content: '布偶貓的關節炎讓牠一度走路都很吃力，看到牠不願意跳上沙發，真的很心疼。這段期間嘗試了物理治療、保健品輔助，並且定期追蹤X光變化，希望能延緩退化速度。這篇記錄所有治療的嘗試過程，給有相同困擾的毛爸媽參考！',
      likes: 28,
      hasImage: false,
      isLiked: false
    },
    {
      id: 3,
      avatar: mockProfile3,
      userId: 'meow_master',
      title: '球球的漫漫抗癌之路',
      content: '從確診那天開始，我們就決定陪著球球勇敢面對每一次化療、副作用，甚至情緒的低潮。一路上遇到了很多溫暖的醫生和朋友，也在治療中學會了更多和毛孩相處的珍貴時光。這裡記錄了治療進度、副作用處理心得，以及我們的小小勝利時刻。',
      likes: 42,
      hasImage: true,
      isLiked: false
    },
    {
      id: 4,
      avatar: mockProfile2,
      userId: 'dog_family',
      title: '【已康復】小邦無預警的下肢癱瘓',
      content: '小邦某天突然無法站立，緊急送醫後診斷出是神經壓迫導致的下肢癱瘓。經過一段時間的復健、針灸治療和細心照顧，奇蹟般地恢復行走能力！這篇整理了我們一路以來的治療流程、復健小撇步，也想給其他遇到相似狀況的家庭一些希望。',
      likes: 8,
      hasImage: false,
      isLiked: false
    },
    {
      id: 5,
      avatar: mockProfile1,
      userId: 'samoyed_owner',
      title: '薩摩耶皮膚病歷程記錄！',
      content: '薩摩耶的皮膚問題讓我們經歷了長期的抗戰：從掉毛、紅腫到不斷復發的皮膚炎。這篇記錄詳細整理了確診過程、使用的藥物種類、過敏原測試結果，以及最終找到適合方案的經驗。希望讓有相似困擾的飼主少走一點冤枉路！',
      likes: 13,
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

  const handlePostClick = (postId) => {
    navigate(`/forum-post/${postId}`);
  };

  // 依據有無圖片決定內文顯示長度
  const getDisplayContent = (post) => {
    if (post.hasImage) {
      return post.content.length > 40 ? post.content.slice(0, 40) + '...' : post.content;
    } else {
      return post.content.length > 70 ? post.content.slice(0, 70) + '...' : post.content;
    }
  };

  return (
    <div className="forum-page-with-nav">
      <Header showSearchBar={false} />
      <div className="app-container">
        <div className="forum-page-content">
          {posts.map(post => (
            <div key={post.id} className="forum-post" onClick={() => handlePostClick(post.id)} style={{ cursor: 'pointer' }}>
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
                  <p className="post-text">{getDisplayContent(post)}</p>
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
