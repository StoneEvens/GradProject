import React, { useState } from 'react';
import './ForumPost.css';
import Header from '../components/Header';
import BottomNavigationBar from '../components/BottomNavigationBar';
import mockProfile1 from '../assets/MockPicture/mockProfile1.png';
import mockProfile2 from '../assets/MockPicture/mockProfile2.png';
import mockProfile3 from '../assets/MockPicture/mockProfile3.png';
import mockCat2 from '../assets/MockPicture/mockCat2.jpg';
import mockDog2 from '../assets/MockPicture/mockDog2.jpg';
import mockCat4 from '../assets/MockPicture/mockCat4.jpg';
import mockDog3 from '../assets/MockPicture/mockDog3.jpg';
import { useNavigate, useParams } from 'react-router-dom';
import userProfileIcon from '../assets/icon/HeaderButton_UserProfile.png';

const SYMPTOMS = [
  '嘔吐', '打噴嚏', '腹瀉', '咳嗽',
  '掉毛', '流鼻涕', '軟便', '血便',
  '皮膚紅腫', '呼吸急促', '眼睛紅腫',
  '行動不便', '頻繁喝水', '食慾不振',
  '抽搐顫抖', '焦躁不安', '過度舔咬'
];

const symptomRecords = {
  '2025-06-14': {
    date: '2025/06/14',
    symptoms: ['嘔吐', '掉毛'],
    otherSymptom: '',
    water: '0.5',
    temperature: '38.5',
    description: '今天精神不太好',
  },
  '2025-06-17': {
    date: '2025/06/17',
    symptoms: ['腹瀉', '咳嗽', '流鼻涕'],
    otherSymptom: '有點發燒',
    water: '0.7',
    temperature: '39.2',
    description: '有點發燒，精神還可以',
  },
  '2025-06-20': {
    date: '2025/06/20',
    symptoms: ['打噴嚏', '流鼻涕'],
    otherSymptom: '',
    water: '0.6',
    temperature: '38.8',
    description: '開始打噴嚏，鼻子有點濕濕的，可能是感冒初期',
  },
  '2025-06-21': {
    date: '2025/06/21',
    symptoms: ['流鼻涕', '咳嗽'],
    otherSymptom: '鼻塞',
    water: '0.7',
    temperature: '39.1',
    description: '鼻涕變多，開始咳嗽，精神還不錯',
  },
  '2025-06-22': {
    date: '2025/06/22',
    symptoms: ['咳嗽', '食慾不振'],
    otherSymptom: '',
    water: '0.5',
    temperature: '39.3',
    description: '咳嗽加重，不太想吃東西，體溫稍微升高',
  },
  '2025-06-23': {
    date: '2025/06/23',
    symptoms: ['咳嗽', '眼睛紅腫'],
    otherSymptom: '精神不太好',
    water: '0.8',
    temperature: '39.5',
    description: '咳嗽持續，眼睛有點紅腫，精神明顯變差',
  },
  '2025-06-24': {
    date: '2025/06/24',
    symptoms: ['流鼻涕', '掉毛'],
    otherSymptom: '鼻塞嚴重',
    water: '0.9',
    temperature: '39.2',
    description: '鼻涕很多，開始掉毛，鼻塞很嚴重',
  },
  '2025-06-25': {
    date: '2025/06/25',
    symptoms: ['咳嗽', '呼吸急促'],
    otherSymptom: '呼吸困難',
    water: '0.4',
    temperature: '39.8',
    description: '咳嗽很嚴重，呼吸急促，需要立即就醫',
  },
  '2025-06-26': {
    date: '2025/06/26',
    symptoms: ['流鼻涕', '打噴嚏'],
    otherSymptom: '症狀改善',
    water: '0.7',
    temperature: '38.9',
    description: '症狀開始改善，鼻涕減少，精神恢復一些',
  },
};

function CustomCalendar({ records }) {
  const [currentYear, setCurrentYear] = useState(2025);
  const [currentMonth, setCurrentMonth] = useState(6);
  const weekNames = ['日', '一', '二', '三', '四', '五', '六'];
  const firstDay = new Date(currentYear, currentMonth - 1, 1).getDay();
  const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
  const calendarDays = Array(firstDay).fill(null);
  for (let i = 1; i <= daysInMonth; i++) {
    calendarDays.push(i);
  }

  const formattedTitle = `${currentYear}年${currentMonth}月`;
  const recordDates = Object.keys(records);
  // 直接將所有有紀錄的日期視為已選
  const selectedDates = recordDates;
  const lastMonth = () => {
    if (currentMonth === 1) {
      setCurrentYear(currentYear - 1);
      setCurrentMonth(12);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };
  const nextMonth = () => {
    if (currentMonth === 12) {
      setCurrentYear(currentYear + 1);
      setCurrentMonth(1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };
  function getDateKey(day) {
    return `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }
  return (
    <div className="calendar-container symptom-calendar-container">
      <div className="calendar-title-bar">
        <h3 className="section-title">
          <button name="lastMonth" className="calendar-arrow left" type="button" aria-label="上一月" onClick={lastMonth} />
          <span className="calendar-title-text">{formattedTitle}</span>
          <button name="nextMonth" className="calendar-arrow right" type="button" aria-label="下一月" onClick={nextMonth} />
        </h3>
      </div>
      <div className="calendar-grid">
        {weekNames.map((day, index) => (
          <div key={index} className="calendar-day-name">{day}</div>
        ))}
        {calendarDays.map((d, index) => {
          if (d === null) return <div key={index} className="calendar-day empty"></div>;
          const dateKey = getDateKey(d);
          const hasRecord = recordDates.includes(dateKey);
          const isSelected = hasRecord;
          return (
            <div
              key={index}
              className={`calendar-day symptom-calendar-day${hasRecord ? ' has-record' : ' no-record'}${isSelected ? ' selected' : ''}`}
              style={{
                opacity: hasRecord ? 1 : 0.5,
                cursor: 'default',
                backgroundColor: isSelected ? '#FFB370' : hasRecord ? '#fff1db' : '#fff1db',
                border: isSelected ? '2px solid #FFB370' : 'none',
              }}
            >
              {d}
            </div>
          );
        })}
      </div>
    </div>
  );
}

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
    image: mockCat2,
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
    image: mockCat4,
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
    image: mockDog3,
    isLiked: false
  }
];

export default function ForumPost() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [showCommentInput, setShowCommentInput] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [comments, setComments] = useState([]);
  const [showShareMessage, setShowShareMessage] = useState(false);
  
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

  const handleComment = () => {
    setShowCommentInput(!showCommentInput);
  };

  const handleShare = async () => {
    try {
      // 構建貼文連結
      const postUrl = `${window.location.origin}/forum-post/${post.id}`;
      await navigator.clipboard.writeText(postUrl);
      setShowShareMessage(true);
      setTimeout(() => {
        setShowShareMessage(false);
      }, 3000);
    } catch (err) {
      const textArea = document.createElement('textarea');
      textArea.value = `${window.location.origin}/forum-post/${post.id}`;
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

  // 在 return 區塊圖片下方插入日曆與症狀統計
  const [selectedDates, setSelectedDates] = useState([Object.keys(symptomRecords)[0]]);
  const handleDateSelect = (dateKey) => {
    setSelectedDates(prev => {
      if (prev.includes(dateKey)) {
        return prev.filter(date => date !== dateKey);
      } else {
        return [...prev, dateKey];
      }
    });
  };
  const getSymptomCount = (symptom) => {
    return selectedDates.filter(dateKey => 
      symptomRecords[dateKey]?.symptoms?.includes(symptom)
    ).length;
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
        {post.hasImage && post.image && (
          <img 
            className="forum-post-img"
            src={post.image}
            alt="貼文圖片"
            style={{ display: 'block', margin: '20px auto', width: '300px', height: '300px', objectFit: 'cover', borderRadius: '8px' }}
          />
        )}
        {/* 日曆與症狀統計區塊 */}
        <div className="section-box calendar-section">
          <div className="section-label">選擇日期</div>
          <CustomCalendar
            records={symptomRecords}
          />
        </div>
        <div className="section-box">
          <div className="section-label">症狀</div>
          <div className="symptom-grid">
            {SYMPTOMS.map((symptom) => {
              // 若為4字，插入換行
              let displaySymptom = symptom;
              if (symptom.length === 4) {
                displaySymptom = symptom.slice(0,2) + '\n' + symptom.slice(2);
              }
              const count = Object.keys(symptomRecords).filter(dateKey => 
                symptomRecords[dateKey]?.symptoms?.includes(symptom)
              ).length;
              return (
                <div key={symptom} className="symptom-count-item">
                  <span className="symptom-name" style={{whiteSpace: 'pre-line'}}>{displaySymptom}</span>
                  <span className={`symptom-count ${count === 0 ? 'zero' : ''}`}>{count === 0 ? '0' : count}</span>
                </div>
              );
            })}
          </div>
        </div>
        {/* 補充描述區塊 */}
        <div className="section-box">
          <div className="section-label">補充描述</div>
          <div className="desc-input">
            <div className="description-list">
              {Object.keys(symptomRecords).map(dateKey => {
                const record = symptomRecords[dateKey];
                if (!record?.description) return null;
                // 將日期格式從 YYYY-MM-DD 轉換為 M/D
                const dateParts = dateKey.split('-');
                const displayDate = `${parseInt(dateParts[1])}/${parseInt(dateParts[2])}`;
                return (
                  <div key={dateKey} className="description-item">
                    <span className="description-date">{displayDate}：</span>
                    <span className="description-text">{record.description}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        {/* 互動按鈕區塊 */}
        <div className="post-actions">
          <button 
            type="button" 
            className={`action-button like-button ${isLiked ? 'liked' : ''}`}
            onClick={handleLike}
          >
            <span className="action-icon">{isLiked ? '❤️' : '🤍'}</span>
            <span className="action-text">{likeCount}</span>
          </button>
          <button 
            type="button" 
            className="action-button comment-button"
            onClick={handleComment}
          >
            <span className="action-icon">💬</span>
            <span className="action-text">留言</span>
          </button>
          <button 
            type="button" 
            className="action-button share-button"
            onClick={handleShare}
          >
            <span className="action-icon">🔗</span>
            <span className="action-text">分享</span>
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
        {/* 分享成功提示訊息 */}
        {showShareMessage && (
          <div className="share-message">
            已複製貼文連結！
          </div>
        )}
      </div>
      <BottomNavigationBar />
    </div>
  );
}
