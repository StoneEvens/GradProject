import React, { useRef, useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import './components/CalculatorStep2.css';
import mockFeed1 from '../assets/MockPicture/mockFeed1.png';
import mockFeed2 from '../assets/MockPicture/mockFeed2.png';
import mockFeed3 from '../assets/MockPicture/mockFeed3.png';

function CalculatorStep2({ onNext, onPrev, selectedPet }) {
  const { user_id } = useParams();
  const fileInputRef = useRef();
  const [selectedFeed, setSelectedFeed] = useState(0);
  const [feeds, setFeeds] = useState([]);
  const [feedInfo, setFeedInfo] = useState({});

  useEffect(() => {
    const uid = user_id || 2;
    axios.get(`http://127.0.0.1:8000/api/feeds/?user_id=${uid}`)
      .then(response => {
        const apiFeeds = response.data.map((item, idx) => ({
          id: item.id,
          name: item.name || `API飼料${idx + 1}`,
          brand: item.brand || '未知品牌',
          img: [mockFeed1, mockFeed2, mockFeed3][idx % 3],
          carb: item.carbohydrates,
          protein: item.protein,
          fat: item.fat,
          ca: item.calcium,
          p: item.phosphorus,
          mg: item.magnesium,
          na: item.sodium,
        }));
        setFeeds(apiFeeds);
        // 預設選第一筆
        if (apiFeeds.length > 0) {
          setSelectedFeed(0);
          handleSelectFeed(0, apiFeeds);
        }
      })
      .catch(err => {
        console.error('載入飼料資料失敗：', err);
      });
  }, [user_id]);

  const handleSelectFeed = (idx, source = feeds) => {
    setSelectedFeed(idx);
    const feed = source[idx];
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

  const handleFeedInfoChange = (field, value) => {
    setFeedInfo(prev => ({ ...prev, [field]: value }));
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const newFeed = {
          id: Date.now(),
          name: '自訂飼料',
          brand: '',
          img: event.target.result,
          carb: 0,
          protein: 0,
          fat: 0,
          ca: 0,
          p: 0,
          mg: 0,
          na: 0,
        };
        setFeeds(prev => {
          const updated = [...prev, newFeed];
          setSelectedFeed(updated.length - 1);
          handleSelectFeed(updated.length - 1, updated);
          return updated;
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddFeedClick = () => {
    fileInputRef.current.value = '';
    fileInputRef.current.click();
  };

  const handleNext = async () => {
    const feed = feeds[selectedFeed];

    if (!feed || !selectedPet) {
      alert("請先選擇飼料與寵物");
      return;
    }

    const formData = new FormData();
    formData.append('pet_type', selectedPet.species === '狗' ? 'dog' : 'cat');
    formData.append('life_stage', 'adult');
    formData.append('weight', selectedPet.weight || '');
    formData.append('expected_adult_weight', '');
    formData.append('litter_size', '');
    formData.append('weeks_of_lactation', '');
    formData.append('protein', feed.protein || 0);
    formData.append('fat', feed.fat || 0);
    formData.append('carbohydrates', feed.carb || 0);
    formData.append('calcium', feed.ca || 0);
    formData.append('phosphorus', feed.p || 0);
    formData.append('magnesium', feed.mg || 0);
    formData.append('sodium', feed.na || 0);

    try {
      const res = await axios.post(
        'http://127.0.0.1:8000/calculator/',
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );
      console.log('計算成功：', res.data);
      onNext(feed, res.data); // 把飼料和後端回傳的計算結果傳出去
    } catch (err) {
      console.error('計算失敗：', err.response?.data || err.message);
      alert('送出失敗，請確認資料或稍後再試。');
    }
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
        {[
          ['品名', 'name', 'text'],
          ['品牌', 'brand', 'text'],
          ['碳水化合物', 'carb', 'number', 'g'],
          ['蛋白質', 'protein', 'number', 'g'],
          ['脂肪', 'fat', 'number', 'g'],
          ['鈣', 'ca', 'number', 'g'],
          ['磷', 'p', 'number', 'g'],
          ['鎂', 'mg', 'number', 'mg'],
          ['鈉', 'na', 'number', 'mg'],
        ].map(([label, key, type, unit]) => (
          <div className="feed-info-row" key={key}>
            <span className="feed-info-label">{label}：</span>
            <input
              className="pet-info-input"
              type={type}
              value={feedInfo[key]}
              onChange={e => handleFeedInfoChange(key, e.target.value)}
            />
            {unit && <span className="feed-info-unit">{unit}</span>}
          </div>
        ))}
      </div>
      <div className="step-btn-row">
        <button className="previous-step-btn" onClick={onPrev}>上一步</button>
        <button className="next-step-btn" onClick={handleNext}>下一步</button>
      </div>
    </>
  );
}

export default CalculatorStep2;