import React, { useEffect, useState } from 'react';
import './components/CalculatorStep3.css';
import mockFeed1 from '../assets/MockPicture/mockFeed1.png';
import mockFeed2 from '../assets/MockPicture/mockFeed2.png';
import mockFeed3 from '../assets/MockPicture/mockFeed3.png';

const mockFeeds = [
  { id: 1, name: '飼料1', img: mockFeed1 },
  { id: 2, name: '飼料2', img: mockFeed2 },
  { id: 3, name: '飼料3', img: mockFeed3 },
];

function CalculatorStep3({ onPrev, selectedFeed = 0 }) {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 2000);
    return () => clearTimeout(timer);
  }, []);

  // 假設 selectedFeed 由父元件傳入，這裡預設為 0
  const feed = mockFeeds[selectedFeed] || mockFeeds[0];

  return (
    <>
      <div className="calculator-title">營養計算機</div>
      <div className="pet-select-label">Step 3.<br />計算結果</div>
      <div className="feed-select-section">
        {loading ? (
          <div className="ai-loading">AI 計算中...</div>
        ) : (
          <div className="result-content">
            <div className="result-row">
              <div className="result-label">使用飼料：</div>
              <div className="result-value result-feed-img">
                <img src={feed.img} alt={feed.name} />
              </div>
            </div>
            <div className="result-row">
              <div className="result-label">計算結果：</div>
              <div className="result-value">此飼料的建議攝取量為每日四餐，一餐約40g，但綜合健康報告進行客製化計算之後，發現牛磺酸會不足約100mg，建議購買相關保健食品補充。</div>
            </div>
            <div className="result-row">
              <div className="result-label">注意事項：</div>
              <div className="result-value">布偶貓容易罹患腎臟相關疾病，建議提供充足水分。</div>
            </div>
          </div>
        )}
      </div>
      <button className="previous-step-btn" onClick={onPrev}>上一步</button>
    </>
  );
}

export default CalculatorStep3;
