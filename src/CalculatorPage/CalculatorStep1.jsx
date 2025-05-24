import React, { useState } from 'react';
import './components/CalculatorStep1.css';
import mockCat1 from '../assets/MockPicture/mockCat1.jpg';
import mockCat2 from '../assets/MockPicture/mockCat2.jpg';
import mockCat3 from '../assets/MockPicture/mockCat3.jpg';
import addPetIcon from '../assets/icon/CalculatorPage_AddPet.png';

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

function CalculatorStep1({ onNext }) {
  const [selectedPet, setSelectedPet] = useState(0);
  const [pets, setPets] = useState(mockPets);
  const [editInfo, setEditInfo] = useState({
    weight: pets[0].weight,
    length: pets[0].length,
    note: pets[0].note,
  });
  const [isAdding, setIsAdding] = useState(false);
  const [newPet, setNewPet] = useState({ name: '', species: '貓', weight: '', length: '', note: '' });
  const [errorMsg, setErrorMsg] = useState('');

  // 切換寵物時同步資訊
  const handleSelectPet = idx => {
    setSelectedPet(idx);
    setEditInfo({
      weight: pets[idx].weight,
      length: pets[idx].length,
      note: pets[idx].note,
    });
    setIsAdding(false);
  };

  // 編輯資訊
  const handleInfoChange = (field, value) => {
    setEditInfo(prev => ({ ...prev, [field]: value }));
    setPets(prev => prev.map((pet, idx) => idx === selectedPet ? { ...pet, [field]: value } : pet));
  };

  // 驗證必填欄位
  const validate = () => {
    if (isAdding) {
      if (!newPet.name) return '請輸入名字！';
      if (!newPet.weight) return '請輸入體重！';
      if (!newPet.length) return '請輸入身長！';
    } else {
      if (!pets[selectedPet].name) return '請輸入名字！';
      if (!editInfo.weight) return '請輸入體重！';
      if (!editInfo.length) return '請輸入身長！';
    }
    return '';
  };

  // 下一步按鈕事件
  const handleNext = () => {
    const err = validate();
    if (err) {
      setErrorMsg(err);
      return;
    }
    setErrorMsg('');
    const pet = isAdding ? newPet : pets[selectedPet];
    onNext(pet);
  };

  return (
    <>
      <div className="calculator-title">營養計算機</div>
      <div className="pet-select-label">Step 1.<br />請選擇一隻寵物</div>
      <div className="pet-select-section">
        <div className="pet-avatar-grid">
          {pets.map((pet, idx) => (
            <img
              key={pet.id}
              src={pet.avatar}
              alt={pet.name}
              className={`pet-avatar${selectedPet === idx && !isAdding ? ' selected' : ''}`}
              onClick={() => handleSelectPet(idx)}
            />
          ))}
        </div>
        <button
          className={`add-pet-btn-rect${isAdding ? ' selected' : ''}`}
          type="button"
          onClick={() => {
            setIsAdding(true);
            setNewPet({ name: '', species: '貓', weight: '', length: '', note: '' });
          }}
        >
          新增寵物
        </button>
      </div>
      <div className="pet-select-label">寵物資訊</div>
      <div className="pet-info-section">
        <div className="pet-info-row">
          <span className="pet-info-label">名字：</span>
          {isAdding ? (
            <input
              className="pet-info-input"
              type="text"
              value={newPet.name}
              onChange={e => setNewPet({ ...newPet, name: e.target.value })}
              placeholder="請輸入名字"
            />
          ) : (
            <span>{pets[selectedPet].name}</span>
          )}
        </div>
        <div className="pet-info-row">
          <span className="pet-info-label">物種：</span>
          {isAdding ? (
            <select
              className="pet-info-input"
              value={newPet.species}
              onChange={e => setNewPet({ ...newPet, species: e.target.value })}
            >
              <option value="貓">貓</option>
              <option value="狗">狗</option>
            </select>
          ) : (
            <span>{pets[selectedPet].species}</span>
          )}
        </div>
        <div className="pet-info-row">
          <span className="pet-info-label">體重：</span>
          {isAdding ? (
            <input
              className="pet-info-input"
              type="number"
              value={newPet.weight}
              onChange={e => setNewPet({ ...newPet, weight: e.target.value })}
              placeholder="公斤"
            />
          ) : (
            <input
              className="pet-info-input"
              type="number"
              value={editInfo.weight}
              onChange={e => handleInfoChange('weight', e.target.value)}
            />
          )}
          <span>公斤</span>
        </div>
        <div className="pet-info-row">
          <span className="pet-info-label">身長：</span>
          {isAdding ? (
            <input
              className="pet-info-input"
              type="number"
              value={newPet.length}
              onChange={e => setNewPet({ ...newPet, length: e.target.value })}
              placeholder="公分"
            />
          ) : (
            <input
              className="pet-info-input"
              type="number"
              value={editInfo.length}
              onChange={e => handleInfoChange('length', e.target.value)}
            />
          )}
          <span>公分</span>
        </div>
        <div className="pet-info-row">
          <span className="pet-info-label">注意事項：</span>
          {isAdding ? (
            <input
              className="pet-info-input"
              type="text"
              value={newPet.note}
              onChange={e => setNewPet({ ...newPet, note: e.target.value })}
              placeholder="請輸入注意事項"
            />
          ) : (
            <input
              className="pet-info-input"
              type="text"
              value={editInfo.note}
              onChange={e => handleInfoChange('note', e.target.value)}
            />
          )}
        </div>
        {errorMsg && (
          <div style={{ color: 'red', marginTop: 4, marginLeft: 8, fontSize: '0.95rem' }}>{errorMsg}</div>
        )}
      </div>
      <button className="next-step-btn" onClick={handleNext}>下一步</button>
    </>
  );
}

export default CalculatorStep1;
