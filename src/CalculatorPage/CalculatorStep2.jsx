import React, { useState } from 'react';
import './components/CalculatorStep2.css';
import mockFeed1 from '../assets/MockPicture/mockFeed1.png';
import mockFeed2 from '../assets/MockPicture/mockFeed2.png';
import mockFeed3 from '../assets/MockPicture/mockFeed3.png';

const mockFeeds = [
  { id: 1, name: '飼料1', img: mockFeed1 },
  { id: 2, name: '飼料2', img: mockFeed2 },
  { id: 3, name: '飼料3', img: mockFeed3 },
];

function CalculatorStep2({ onNext, onPrev }) {
  const [selectedFeed, setSelectedFeed] = useState(0);

  return (
    <>
      <div className="calculator-title">營養計算機</div>
      <div className="pet-select-label">Step 2.<br />請選擇一款飼料</div>
      <div className="feed-select-section">
        <div className="feed-grid">
          {mockFeeds.map((feed, idx) => (
            <div
              key={feed.id}
              className={`feed-item${selectedFeed === idx ? ' selected' : ''}`}
              onClick={() => setSelectedFeed(idx)}
            >
              <img src={feed.img} alt={feed.name} />
            </div>
          ))}
          <button className="add-feed-btn" type="button">新增飼料</button>
        </div>
      </div>
      <div className="step-btn-row">
        <button className="previous-step-btn" onClick={onPrev}>上一步</button>
        <button className="next-step-btn" onClick={onNext}>下一步</button>
      </div>
    </>
  );
}

export default CalculatorStep2;
