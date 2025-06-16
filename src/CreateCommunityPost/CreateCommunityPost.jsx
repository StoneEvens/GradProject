import React, { useState } from 'react';
import './CreateCommunityPost.css';
import Header from '../components/Header';
import BottomNavigationBar from '../components/BottomNavigationBar';
import mockProfile1 from '../assets/MockPicture/mockProfile1.png';

export default function CreateCommunityPost() {
  const [description, setDescription] = useState('');
  const [images, setImages] = useState([]);
  // 假設目前登入用戶
  const username = '__ilovecattts__';

  // 上傳圖片
  const handleImageUpload = (e) => {
    const files = Array.from(e.target.files);
    setImages([...images, ...files]);
  };
  // 刪除圖片
  const handleRemoveImage = (idx) => {
    setImages(images.filter((_, i) => i !== idx));
  };

  return (
    <div className="community-post-container">
      <Header showSearchBar={false} />
      <div className="header-row">
        <h2 className="main-title">新增日常貼文</h2>
      </div>
      {/* 用戶頭貼與名稱區塊 */}
      <div className="post-user-info">
        <img className="post-user-avatar" src={mockProfile1} alt="頭像" />
        <span className="post-username">{username}</span>
      </div>
      {/* 上傳照片區塊 */}
      <div className="section-box">
        <div className="section-label">上傳照片</div>
        <div className="image-upload-row">
          <label className="image-upload-btn">
            <input
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              multiple
              onChange={handleImageUpload}
            />
            <span className="plus-icon">＋</span>
          </label>
          <div className="image-preview-list">
            {images.map((img, idx) => (
              <div className="image-preview" key={idx}>
                <img src={URL.createObjectURL(img)} alt="preview" />
                <button className="remove-img-btn" onClick={() => handleRemoveImage(idx)} />
              </div>
            ))}
          </div>
        </div>
      </div>
      {/* 補充描述區塊 */}
      <div className="section-box">
        <div className="section-label">補充描述</div>
        <textarea
          className="desc-input"
          placeholder="想分享什麼？"
          value={description}
          onChange={e => setDescription(e.target.value)}
        />
      </div>
      {/* 預留空間 */}
      <div style={{ height: 40 }} />
      <BottomNavigationBar />
    </div>
  );
}
