import React, { useState } from 'react';
import './ForumPost.css';
import Header from '../components/Header';
import BottomNavigationBar from '../components/BottomNavigationBar';
import mockProfile1 from '../assets/MockPicture/mockProfile1.png';
import mockProfile2 from '../assets/MockPicture/mockProfile2.png';
import mockProfile3 from '../assets/MockPicture/mockProfile3.png';
import { useNavigate, useParams } from 'react-router-dom';

// 與 ForumPage.jsx 相同的模擬貼文數據
const posts = [
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
];

export default function ForumPost() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  
  // 根據 URL 參數找到對應的貼文
  const post = posts.find(p => p.id === parseInt(id));
  
  // 如果找不到貼文，顯示錯誤訊息
  if (!post) {
    return (
      <div className="forum-post-page-container">
        <Header />
        <button className="back-button" onClick={() => navigate(-1)}>
          ← 返回
        </button>
        <div className="forum-post-container">
          <h2 className="post-title">貼文不存在</h2>
        </div>
        <BottomNavigationBar />
      </div>
    );
  }

  // 初始化按讚數
  React.useEffect(() => {
    setLikeCount(post.likes || 0);
    setIsLiked(post.isLiked || false);
  }, [post]);

  const handleGoBack = () => {
    navigate(-1);
  };

  const handleLike = () => {
    setIsLiked(!isLiked);
    setLikeCount(isLiked ? likeCount - 1 : likeCount + 1);
  };

  return (
    <div className="forum-post-page-container">
      <Header />
      <button className="back-button" onClick={handleGoBack}>
        ← 返回
      </button>
      
      <div className="forum-post-container">
        <div className="post-header">
          <img src={post.avatar} alt="用戶頭像" className="post-avatar" />
          <span className="post-username">{post.userId}</span>
        </div>
        
        <div className="post-content">
          <h1 className="post-title">{post.title}</h1>
          <p className="post-text">{post.content}</p>
        </div>
        
        {post.hasImage && (
          <div className="post-image">
            <div className="image-placeholder"></div>
          </div>
        )}
        
        <div className="post-actions">
          <button 
            type="button" 
            className={`like-button ${isLiked ? 'liked' : ''}`} 
            onClick={handleLike}
          >
            <span className="like-icon">{isLiked ? '❤️' : '🤍'}</span>
            <span className="like-count">{likeCount}</span>
          </button>
        </div>
      </div>
      <BottomNavigationBar />
    </div>
  );
}
