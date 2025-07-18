import React, { useRef, useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from '../utils/axios';
import '../styles/CalculatorStep2.css';
import mockFeed1 from '../MockPicture/mockFeed1.png';
import mockFeed2 from '../MockPicture/mockFeed2.png';
import mockFeed3 from '../MockPicture/mockFeed3.png';

function CalculatorStep2({ onNext, onPrev, selectedPet }) {
  const { user_id } = useParams();
  const fileInputRef = useRef();
  const [selectedFeed, setSelectedFeed] = useState(0);
  const [feeds, setFeeds] = useState([]);
  const [feedInfo, setFeedInfo] = useState({
    name: '',
    brand: '',
    carb: '',
    protein: '',
    fat: '',
    ca: '',
    p: '',
    mg: '',
    na: ''
  });

  useEffect(() => {
    axios.get('/calculator/feeds/')
      .then(response => {
        const apiFeeds = response.data.map((item, idx) => ({
          id: item.id,
          name: item.name || `API飼料${idx + 1}`,
          brand: item.brand || '未知品牌',
          img: item.front_image_url || [mockFeed1, mockFeed2, mockFeed3][idx % 3],
          carb: item.carbohydrate,
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
      carb: (feed.carb !== undefined && feed.carb !== null) ? feed.carb.toString() : '',
      protein: (feed.protein !== undefined && feed.protein !== null) ? feed.protein.toString() : '',
      fat: (feed.fat !== undefined && feed.fat !== null) ? feed.fat.toString() : '',
      ca: (feed.ca !== undefined && feed.ca !== null) ? feed.ca.toString() : '',
      p: (feed.p !== undefined && feed.p !== null) ? feed.p.toString() : '',
      mg: (feed.mg !== undefined && feed.mg !== null) ? feed.mg.toString() : '',
      na: (feed.na !== undefined && feed.na !== null) ? feed.na.toString() : '',
    });
  };

  const handleFeedInfoChange = (field, value) => {
    setFeedInfo(prev => ({ ...prev, [field]: value }));
  };

const handleFileChange = async (e) => {
  const files = Array.from(e.target.files);
  if (files.length < 2) {
    alert("請選擇主圖與營養標各一張，檔名需包含 front 與 nutrition");
    return;
  }

  let frontImageFile = null;
  let nutritionImageFile = null;

  files.forEach(file => {
    const name = file.name.toLowerCase();
    if (name.includes("front")) {
      frontImageFile = file;
    } else if (name.includes("nutrition")) {
      nutritionImageFile = file;
    }
  });

  if (!frontImageFile || !nutritionImageFile) {
    alert("找不到包含 front 或 nutrition 的檔名，請重新命名並重新選取圖片。");
    return;
  }

  try {
    // Step 1: OCR
    const ocrForm = new FormData();
    ocrForm.append('image', nutritionImageFile);
    const ocrRes = await axios.post('/feeds/ocr/', ocrForm, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    const nutrients = ocrRes.data.extracted_nutrients || {};
    console.log("OCR 結果：", nutrients);

    // Step 2: 上傳圖片
    const uploadToFirebase = async (file, feedId, photoType) => {
      const form = new FormData();
      form.append('file', file);
      form.append('feed_id', feedId);
      form.append('photo_type', photoType);
      const res = await axios.post('/feeds/firebase/upload/', form, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      return res.data.download_url;
    };

    const tempFeedId = Date.now();  // 臨時唯一值

    const frontImageUrl = await uploadToFirebase(frontImageFile, tempFeedId, 'front');
    const nutritionImageUrl = await uploadToFirebase(nutritionImageFile, tempFeedId, 'nutrition');


    // Step 3: 建立 Feed
    const parseNumber = (val) => typeof val === 'number' ? val : 0;
    const createFeedPayload = {
      name: '自訂飼料',
      brand: '',
      protein: parseNumber(nutrients.protein),
      fat: parseNumber(nutrients.fat),
      carbohydrate: parseNumber(nutrients.carbohydrate),
      calcium: parseNumber(nutrients.calcium),
      phosphorus: parseNumber(nutrients.phosphorus),
      magnesium: parseNumber(nutrients.magnesium),
      sodium: parseNumber(nutrients.sodium),
      front_image_url: frontImageUrl,
      nutrition_image_url: nutritionImageUrl,
    };
    console.log(createFeedPayload)
    console.log('Hi, im here.')

    const createFeedRes = await axios.post(
      '/calculator/feeds/create/',
      createFeedPayload
    );
    console.log("建立 Feed 回傳結果：", createFeedRes.data);
    const createdFeed = createFeedRes.data.data;
    console.log("成功建立 Feed：", createdFeed);

    const newFeed = {
      id: createdFeed.id,
      name: createdFeed.name,
      brand: createdFeed.brand,
      img: frontImageUrl,
      carb: createdFeed.carbohydrate,
      protein: createdFeed.protein,
      fat: createdFeed.fat,
      ca: createdFeed.calcium,
      p: createdFeed.phosphorus,
      mg: createdFeed.magnesium,
      na: createdFeed.sodium,
    };

    setFeeds(prev => {
      const updated = [...prev, newFeed];
      setSelectedFeed(updated.length - 1);
      handleSelectFeed(updated.length - 1, updated);
      return updated;
    });

  } catch (error) {
    console.error("建立自訂飼料失敗：", error);
    alert("建立飼料失敗，請稍後再試");
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

    // Step 1: 更新 Feed 到後端
    const updateFeedBeforeCalculation = async () => {
      const updatePayload = {
        feed_id: feed.id,
        name: feedInfo.name,
        brand: feedInfo.brand,
        protein: parseFloat(feedInfo.protein) || 0,
        fat: parseFloat(feedInfo.fat) || 0,
        carbohydrate: parseFloat(feedInfo.carb) || 0,
        calcium: parseFloat(feedInfo.ca) || 0,
        phosphorus: parseFloat(feedInfo.p) || 0,
        magnesium: parseFloat(feedInfo.mg) || 0,
        sodium: parseFloat(feedInfo.na) || 0,
      };
      console.log(updatePayload)

      try {
        const res = await axios.post(
          'http://127.0.0.1:8000/api/v1/calculator/feeds/update/',
          updatePayload
        );
        console.log("飼料更新成功：", res.data);
      } catch (err) {
        console.error("飼料更新失敗：", err.response?.data || err.message);
        alert("飼料更新失敗，請稍後再試。");
        return false;
      }

      return true;
    };

    const updateSuccess = await updateFeedBeforeCalculation();
    if (!updateSuccess) return;

    // Step 2: 計算
    const formData = new FormData();
    formData.append('pet_type', selectedPet.species === '狗' ? 'dog' : 'cat');
    formData.append('life_stage', 'adult');
    formData.append('weight', selectedPet.weight || '');
    formData.append('expected_adult_weight', '');
    formData.append('litter_size', '');
    formData.append('weeks_of_lactation', '');
    formData.append('protein', feedInfo.protein || 0);
    formData.append('fat', feedInfo.fat || 0);
    formData.append('carbohydrates', feedInfo.carb || 0);
    formData.append('calcium', feedInfo.ca || 0);
    formData.append('phosphorus', feedInfo.p || 0);
    formData.append('magnesium', feedInfo.mg || 0);
    formData.append('sodium', feedInfo.na || 0);

    try {
      const res = await axios.post(
        'http://127.0.0.1:8000//api/v1/calculator/calculation/',
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
            multiple
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