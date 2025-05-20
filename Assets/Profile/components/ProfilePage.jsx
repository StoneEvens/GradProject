import React from 'react';
import './ProfilePage.css';
import Header from '../../Public/components/Header';
import BottomNavigationBar from '../../Public/components/BottomNavigationBar';
import mockProfile1 from '../icons/mock_profile_pic.jpg';

// 寵物照片九宮格元件，未來可直接傳入圖片陣列
function PetPhotoGrid({ photos = [] }) {
  return (
    <div className="pet-photo-grid">
      {[...Array(9)].map((_, idx) => (
        photos[idx] ? (
          <img
            className="pet-photo-img"
            src={photos[idx]}
            alt={`貼文照片${idx + 1}`}
            key={idx}
          />
        ) : (
          <div className="pet-photo-placeholder" key={idx}></div>
        )
      ))}
    </div>
  );
}

function ProfilePage() {
  // 未來可由props或API取得照片陣列
  const recentPhotos = [];

  return (
    <div className="profile-page-container">
      <Header />
      <div className="profile-content">
        {/* 頭像與簡介區塊 */}
        <div className="profile-header">
          <img className="profile-avatar" src={mockProfile1} alt="頭像" />
          <div className="profile-info">
            <div className="profile-username">__ilovecattts__</div>
            <div className="profile-realname">李筱貞</div>
            <div className="profile-desc">
              三隻布偶貓！老大是五歲的胖胖，老二是三歲的肥肥，老么是6個月大的咪寶！
            </div>
          </div>
        </div>
        {/* 分頁選單 */}
        <div className="profile-tabs">
          <button
            className="profile-tab profile-tab-community"
            type='button'
            onClick={() => window.location.href = '/community'}
          >
            社群
          </button>
          <button
            className="profile-tab profile-tab-forum"
            onClick={() => window.location.href = '/forum'}
          >
            論壇
          </button>
        </div>
        {/* 貓咪照片九宮格 */}
        <PetPhotoGrid photos={recentPhotos} />
      </div>
      <BottomNavigationBar />
    </div>
  );
}

export default ProfilePage;
