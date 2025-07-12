import React, { useEffect, useState } from 'react';
import '../styles/CalculatorStep3.css';
import mockFeed1 from '../MockPicture/mockFeed1.png';
import mockFeed2 from '../MockPicture/mockFeed2.png';
import mockFeed3 from '../MockPicture/mockFeed3.png';

const mockFeeds = [
  { id: 1, name: '飼料1', img: mockFeed1 },
  { id: 2, name: '飼料2', img: mockFeed2 },
  { id: 3, name: '飼料3', img: mockFeed3 },
];

function CalculatorStep3({ onPrev, selectedFeed, selectedPet, calculationResult }) {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 2000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <>
      <div className="calculator-title">營養計算機</div>
      <div className="pet-select-label">Step 3.<br />計算結果</div>
      <div className="feed-select-section">
        {loading ? (
          <div className="ai-loading">AI 計算中...</div>
        ) : (
          <div className="result-bottom-box">
            <div className="result-bottom-title">計算結果：</div>
            <div className="result-bottom-text">{calculationResult?.description || '無資料'}</div>
          </div>
        )}
      </div>
      <button className="previous-step-btn" onClick={onPrev}>上一步</button>
    </>
  );
}

export default CalculatorStep3;
