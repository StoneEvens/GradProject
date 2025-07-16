import React, { useState } from 'react';
import './CommunityPost.css';
import Header from '../components/Header';
import BottomNavigationBar from '../components/BottomNavigationBar';
import userProfileIcon from '../assets/icon/HeaderButton_UserProfile.png';
import petPageIcon from '../assets/icon/BottomButton_PetPage.png';
import mockCat2 from '../assets/MockPicture/mockCat2.jpg';
import mockDog2 from '../assets/MockPicture/mockDog2.jpg';
import mockCat4 from '../assets/MockPicture/mockCat4.jpg';
import mockDog3 from '../assets/MockPicture/mockDog3.jpg';
import { useNavigate, useParams, useLocation } from 'react-router-dom';

// 與 CommunityPage.jsx 相同的模擬貼文數據
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

export default function CommunityPost() {
  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation();
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [showCommentInput, setShowCommentInput] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [comments, setComments] = useState([]);
  const [showShareMessage, setShowShareMessage] = useState(false);
  const [showPetName, setShowPetName] = useState(false);
  
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

  // 初始化按讚數和檢查是否需要自動顯示留言輸入框
  React.useEffect(() => {
    setLikeCount(post.likes || 0);
    
    // 檢查 URL 參數是否包含 showComment=true
    const urlParams = new URLSearchParams(location.search);
    if (urlParams.get('showComment') === 'true') {
      setShowCommentInput(true);
      // 清除 URL 參數，避免重新整理時重複觸發
      navigate(`/community-post/${id}`, { replace: true });
    }
  }, [post, location.search, navigate, id]);

  const handleGoBack = () => {
    navigate(-1);
  };

  const handleLike = () => {
    setIsLiked(!isLiked);
    setLikeCount(isLiked ? likeCount - 1 : likeCount + 1);
  };

  const handleComment = () => {
    setShowCommentInput(!showCommentInput);
  };

  const handleShare = async () => {
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

  const handleUserProfile = () => {
    // TODO: 跳轉到用戶個人主頁
    console.log('跳轉到用戶個人主頁:', post.userId);
    // navigate(`/user-profile/${post.userId}`);
  };

  const handlePetIdentify = () => {
    setShowPetName(!showPetName);
  };

  const handleSubmitComment = () => {
    if (commentText.trim()) {
      const newComment = {
        id: Date.now(),
        userAvatar: userProfileIcon,
        username: '我',
        content: commentText,
        date: new Date().toLocaleDateString('zh-TW', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit'
        }).replace(/\//g, '/') + ' ' + new Date().toLocaleTimeString('zh-TW', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        })
      };
      setComments([...comments, newComment]);
      setCommentText('');
      setShowCommentInput(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmitComment();
    }
  };

  return (
    <div className="community-post-page-container">
      <Header />
      <button className="back-button" onClick={handleGoBack}>
        ← 返回
      </button>
      
      {/* 分享成功提示訊息 */}
      {showShareMessage && (
        <div className="share-message">
          已複製貼文連結！
        </div>
      )}
      
      <div className="community-post-container">
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
        
        <div className="post-date">{post.date}</div>
        
        {/* 互動按鈕區域 */}
        <div className="post-actions">
          <button type="button" className={`action-button like-button ${isLiked ? 'liked' : ''}`} onClick={handleLike}>
            <span className="action-icon">{isLiked ? '❤️' : '🤍'}</span>
            <span className="action-text">{likeCount}</span>
          </button>
          <button type="button" className="action-button comment-button" onClick={handleComment}>
            <span className="action-icon">💬</span>
            <span className="action-text">{post.comments + comments.length}</span>
          </button>
          <button type="button" className="action-button share-button" onClick={handleShare}>
            <span className="action-icon">📤</span>
            <span className="action-text">{post.shares || 0}</span>
          </button>
        </div>

        {/* 留言輸入區域 */}
        {showCommentInput && (
          <div className="comment-input-container">
            <div className="comment-input-header">
              <img src={userProfileIcon} alt="使用者頭貼" className="comment-user-avatar" />
              <div className="comment-input-wrapper">
                <textarea
                  className="comment-textarea"
                  placeholder="寫下你的留言..."
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  onKeyPress={handleKeyPress}
                  rows="3"
                />
                <button
                  type="button"
                  className={`comment-submit-button ${commentText.trim() ? 'active' : ''}`}
                  onClick={handleSubmitComment}
                  disabled={!commentText.trim()}
                >
                  送出
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 留言列表 */}
        {comments.length > 0 && (
          <div className="comments-section">
            <h3 className="comments-title">留言 ({comments.length})</h3>
            {comments.map(comment => (
              <div key={comment.id} className="comment-item">
                <img src={comment.userAvatar} alt="使用者頭貼" className="comment-avatar" />
                <div className="comment-content">
                  <div className="comment-header">
                    <span className="comment-username">{comment.username}</span>
                    <span className="comment-date">{comment.date}</span>
                  </div>
                  <div className="comment-text">{comment.content}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <BottomNavigationBar />
    </div>
  );
}