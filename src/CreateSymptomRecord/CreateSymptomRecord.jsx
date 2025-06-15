import React, { useState, useEffect } from 'react';
import './CreateSymptomRecord.css';
import Header from '../components/Header';
import BottomNavigationBar from '../components/BottomNavigationBar';
import mockCat1 from '../assets/MockPicture/mockCat1.jpg';
import mockCat2 from '../assets/MockPicture/mockCat2.jpg';
import mockCat3 from '../assets/MockPicture/mockCat3.jpg';

const SYMPTOMS = [
  '嘔吐', '打噴嚏', '腹瀉', '咳嗽',
  '掉毛', '流鼻涕', '軟便', '血便',
  '皮膚紅腫', '呼吸急促', '眼睛紅腫',
  '行動不便', '頻繁喝水', '食慾不振',
  '抽搐顫抖', '焦躁不安', '過度舔咬'
];

const mockPets = [
  {
    id: 1,
    name: '胖胖',
    species: '貓',
    weight: 8.5,
    length: 41,
    note: '無',
    avatar: mockCat1,
  },
  {
    id: 2,
    name: '肥肥',
    species: '貓',
    weight: 5.2,
    length: 38,
    note: '有糖尿病',
    avatar: mockCat2,
  },
  {
    id: 3,
    name: '咪寶',
    species: '貓',
    weight: 6.1,
    length: 40,
    note: '愛吃零食',
    avatar: mockCat3,
  },
];

export default function CreateSymptomRecord() {
  const today = new Date();
  const [date, setDate] = useState(today.toISOString().slice(0, 10));
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isMedical, setIsMedical] = useState(false);
  const [selectedSymptoms, setSelectedSymptoms] = useState([]);
  const [otherSymptom, setOtherSymptom] = useState('');
  const [water, setWater] = useState('');
  const [temperature, setTemperature] = useState('');
  const [description, setDescription] = useState('');
  const [images, setImages] = useState([]);
  const [selectedPet, setSelectedPet] = useState(0);
  const [petWeight, setPetWeight] = useState(mockPets[0].weight);
  const [petLength, setPetLength] = useState(mockPets[0].length);
  const [petNote, setPetNote] = useState(mockPets[0].note);
  const [errorMsg, setErrorMsg] = useState('');

  // 當切換寵物時，更新可編輯欄位
  useEffect(() => {
    setPetWeight(mockPets[selectedPet].weight);
    setPetLength(mockPets[selectedPet].length);
    setPetNote(mockPets[selectedPet].note);
  }, [selectedPet]);

  // 勾選症狀
  const handleSymptomChange = (symptom) => {
    if (selectedSymptoms.includes(symptom)) {
      setSelectedSymptoms(selectedSymptoms.filter(s => s !== symptom));
    } else {
      setSelectedSymptoms([...selectedSymptoms, symptom]);
    }
  };

  // 上傳圖片
  const handleImageUpload = (e) => {
    const files = Array.from(e.target.files);
    setImages([...images, ...files]);
  };

  // 刪除圖片
  const handleRemoveImage = (idx) => {
    setImages(images.filter((_, i) => i !== idx));
  };

  const handleOtherSymptomChange = (e) => {
    const value = e.target.value;
    setOtherSymptom(value);
    if (value && !selectedSymptoms.includes('其他')) {
      setSelectedSymptoms([...selectedSymptoms, '其他']);
    } else if (!value && selectedSymptoms.includes('其他')) {
      setSelectedSymptoms(selectedSymptoms.filter(s => s !== '其他'));
    }
  };

  const handleUpload = () => {
    if (selectedSymptoms.length === 0) {
      setErrorMsg('請至少選擇一項症狀');
      return;
    }
    if (!water || !temperature) {
      setErrorMsg('請填寫飲水量和體溫');
      return;
    }
    setErrorMsg('');
    // 這裡可以放實際上傳邏輯
  };

  return (
    <div className="symptom-record-container">
      <Header showSearchBar={false} />
      <div className="header-row">
        <h2 className="main-title">建立症狀紀錄</h2>
      </div>
      <div className="date-row">
        <span>時間：{date.replace(/-/g, '/')}</span>
        <button className="date-btn" onClick={() => setShowDatePicker(!showDatePicker)}>
          選擇日期
        </button>
        {showDatePicker && (
          <input
            type="date"
            className="date-picker"
            value={date}
            onChange={e => { setDate(e.target.value); setShowDatePicker(false); }}
            max={today.toISOString().slice(0, 10)}
          />
        )}
      </div>
      <div className="medical-row">
        <label className={`medical-checkbox ${isMedical ? 'checked' : ''}`}>
          <input
            type="checkbox"
            checked={isMedical}
            onChange={() => setIsMedical(!isMedical)}
          />
          <span>已就醫</span>
        </label>
      </div>
      <div className="pet-select-section">
        <div className="pet-select-label">選擇寵物</div>
        <div className="pet-avatar-grid">
          {mockPets.map((pet, idx) => (
            <img
              key={pet.id}
              src={pet.avatar}
              alt={pet.name}
              className={`pet-avatar${selectedPet === idx ? ' selected' : ''}`}
              onClick={() => setSelectedPet(idx)}
            />
          ))}
        </div>
        <div className="pet-info-section">
          <div className="pet-info-row">
            <span className="pet-info-label">名字：</span>
            <span>{mockPets[selectedPet].name}</span>
          </div>
          <div className="pet-info-row">
            <span className="pet-info-label">物種：</span>
            <span>{mockPets[selectedPet].species}</span>
          </div>
          <div className="pet-info-row">
            <span className="pet-info-label">體重：</span>
            <input
              className="pet-info-input"
              type="number"
              value={petWeight}
              onChange={e => setPetWeight(e.target.value)}
              min="0"
              step="0.1"
            />
            <span>公斤</span>
          </div>
          <div className="pet-info-row">
            <span className="pet-info-label">身長：</span>
            <input
              className="pet-info-input"
              type="number"
              value={petLength}
              onChange={e => setPetLength(e.target.value)}
              min="0"
              step="0.1"
            />
            <span>公分</span>
          </div>
          <div className="pet-info-row">
            <span className="pet-info-label">注意事項：</span>
            <input
              className="pet-info-input"
              type="text"
              value={petNote}
              onChange={e => setPetNote(e.target.value)}
            />
          </div>
        </div>
      </div>
      <div className="section-box">
        <div className="section-label">症狀</div>
        <div className="symptom-grid">
          {SYMPTOMS.map((symptom) => (
            <label key={symptom} className="symptom-checkbox">
              <input
                type="checkbox"
                checked={selectedSymptoms.includes(symptom)}
                onChange={() => handleSymptomChange(symptom)}
              />
              <span>{symptom}</span>
            </label>
          ))}
        </div>
        <div className="other-symptom-container">
          <label className="other-symptom-checkbox">
            <input
              type="checkbox"
              checked={selectedSymptoms.includes('其他')}
              onChange={() => handleSymptomChange('其他')}
            />
            <span>其他</span>
            <input
              className="other-input"
              type="text"
              placeholder="請輸入其他症狀"
              value={otherSymptom}
              onChange={handleOtherSymptomChange}
            />
          </label>
        </div>
      </div>
      <div className="section-box">
        <div className="section-label">健康數值紀錄</div>
        <div className="body-record-row">
          <label>喝水量：</label>
          <input
            className="body-input"
            type="number"
            value={water}
            onChange={e => setWater(e.target.value)}
            min="0"
            step="0.1"
          />
          <span>公升</span>
        </div>
        <div className="body-record-row">
          <label>體溫：</label>
          <input
            className="body-input"
            type="number"
            value={temperature}
            onChange={e => setTemperature(e.target.value)}
            min="0"
            step="0.1"
          />
          <span>度</span>
        </div>
      </div>
      <div className="section-box">
        <div className="section-label">補充描述</div>
        <textarea
          className="desc-input"
          placeholder="請輸入您想補充的描述"
          value={description}
          onChange={e => setDescription(e.target.value)}
        />
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
      {errorMsg && (
        <div className="error-msg">{errorMsg}</div>
      )}
      <button className="upload-btn" onClick={handleUpload}>上傳</button>
      <BottomNavigationBar />
    </div>
  );
}