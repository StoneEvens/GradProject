import React, { useRef, useState } from 'react';
import './components/CalculatorStep2.css';
import mockFeed1 from '../assets/MockPicture/mockFeed1.png';
import mockFeed2 from '../assets/MockPicture/mockFeed2.png';
import mockFeed3 from '../assets/MockPicture/mockFeed3.png';

const initialFeeds = [
  {
    id: 1, name: '飼料1', img: mockFeed1, brand: '品牌A', carb: 20, protein: 30, fat: 10, ca: 0.8, p: 0.6, mg: 50, na: 120,
  },
  {
    id: 2, name: '飼料2', img: mockFeed2, brand: '品牌B', carb: 18, protein: 32, fat: 12, ca: 0.7, p: 0.5, mg: 40, na: 110,
  },
  {
    id: 3, name: '飼料3', img: mockFeed3, brand: '品牌C', carb: 22, protein: 28, fat: 11, ca: 0.9, p: 0.7, mg: 60, na: 130,
  },
];

function CalculatorStep2({ onNext, onPrev }) {
  const [selectedFeed, setSelectedFeed] = useState(0);
  const [feeds, setFeeds] = useState(initialFeeds);
  const fileInputRef = useRef();
  const [feedInfo, setFeedInfo] = useState({
    name: initialFeeds[0].name,
    brand: initialFeeds[0].brand,
    carb: initialFeeds[0].carb,
    protein: initialFeeds[0].protein,
    fat: initialFeeds[0].fat,
    ca: initialFeeds[0].ca,
    p: initialFeeds[0].p,
    mg: initialFeeds[0].mg,
    na: initialFeeds[0].na,
  });

  // 處理檔案上傳
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setFeeds(prev => [
          ...prev,
          {
            id: Date.now(),
            name: '自訂飼料',
            img: event.target.result,
          },
        ]);
      };
      reader.readAsDataURL(file);
    }
  };

  // 觸發 input[type=file]
  const handleAddFeedClick = () => {
    fileInputRef.current.value = '';
    fileInputRef.current.click();
  };

  const handleFeedInfoChange = (field, value) => {
    setFeedInfo(prev => ({ ...prev, [field]: value }));
  };

  // 點擊飼料時自動帶入成分
  const handleSelectFeed = (idx) => {
    setSelectedFeed(idx);
    const feed = feeds[idx];
    setFeedInfo({
      name: feed.name || '',
      brand: feed.brand || '',
      carb: feed.carb || '',
      protein: feed.protein || '',
      fat: feed.fat || '',
      ca: feed.ca || '',
      p: feed.p || '',
      mg: feed.mg || '',
      na: feed.na || '',
    });
  };

  return (
    <>
      <div className="calculator-title">營養計算機</div>
      <div className="pet-select-label">Step 2.<br />請選擇一款飼料</div>
      <div className="feed-select-section">
        <div className="feed-grid">
          {feeds.map((feed, idx) => (
            <div
              key={feed.id}
              className={`feed-item${selectedFeed === idx ? ' selected' : ''}`}
              onClick={() => handleSelectFeed(idx)}
            >
              <img src={feed.img} alt={feed.name} />
            </div>
          ))}
          <button className="add-feed-btn" type="button" onClick={handleAddFeedClick}>
            新增飼料
          </button>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            style={{ display: 'none' }}
            ref={fileInputRef}
            onChange={handleFileChange}
          />
        </div>
      </div>
      <div className="pet-select-label">飼料資訊</div>
      <div className="feed-info-section">
        <div className="feed-info-row">
          <span className="feed-info-label">品名：</span>
          <input className="pet-info-input" type="text" value={feedInfo.name} onChange={e => handleFeedInfoChange('name', e.target.value)} />
        </div>
        <div className="feed-info-row">
          <span className="feed-info-label">品牌：</span>
          <input className="pet-info-input" type="text" value={feedInfo.brand} onChange={e => handleFeedInfoChange('brand', e.target.value)} />
        </div>
        <div className="feed-info-row">
          <span className="feed-info-label">碳水化合物：</span>
          <input className="pet-info-input" type="number" value={feedInfo.carb} onChange={e => handleFeedInfoChange('carb', e.target.value)} />
          <span className="feed-info-unit">g</span>
        </div>
        <div className="feed-info-row">
          <span className="feed-info-label">蛋白質：</span>
          <input className="pet-info-input" type="number" value={feedInfo.protein} onChange={e => handleFeedInfoChange('protein', e.target.value)} />
          <span className="feed-info-unit">g</span>
        </div>
        <div className="feed-info-row">
          <span className="feed-info-label">脂肪：</span>
          <input className="pet-info-input" type="number" value={feedInfo.fat} onChange={e => handleFeedInfoChange('fat', e.target.value)} />
          <span className="feed-info-unit">g</span>
        </div>
        <div className="feed-info-row">
          <span className="feed-info-label">鈣：</span>
          <input className="pet-info-input" type="number" value={feedInfo.ca} onChange={e => handleFeedInfoChange('ca', e.target.value)} />
          <span className="feed-info-unit">g</span>
        </div>
        <div className="feed-info-row">
          <span className="feed-info-label">磷：</span>
          <input className="pet-info-input" type="number" value={feedInfo.p} onChange={e => handleFeedInfoChange('p', e.target.value)} />
          <span className="feed-info-unit">g</span>
        </div>
        <div className="feed-info-row">
          <span className="feed-info-label">鎂：</span>
          <input className="pet-info-input" type="number" value={feedInfo.mg} onChange={e => handleFeedInfoChange('mg', e.target.value)} />
          <span className="feed-info-unit">mg</span>
        </div>
        <div className="feed-info-row">
          <span className="feed-info-label">鈉：</span>
          <input className="pet-info-input" type="number" value={feedInfo.na} onChange={e => handleFeedInfoChange('na', e.target.value)} />
          <span className="feed-info-unit">mg</span>
        </div>
      </div>
      <div className="step-btn-row">
        <button className="previous-step-btn" onClick={onPrev}>上一步</button>
        <button className="next-step-btn" onClick={() => onNext(feeds[selectedFeed])}>下一步</button>
      </div>
    </>
  );
}

export default CalculatorStep2;
