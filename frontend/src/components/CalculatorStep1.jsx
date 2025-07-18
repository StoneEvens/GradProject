import React, { useState } from 'react';
import axios from 'axios';
import '../styles/CalculatorStep1.css';
import defaultAvatar from '../MockPicture/mockCat1.jpg';

// Mapping between English and Chinese species
const speciesMap = {
  cat: '貓',
  dog: '狗',
};
const speciesReverseMap = {
  '貓': 'cat',
  '狗': 'dog',
};

function CalculatorStep1({ onNext, pets: apiPets }) {
  // Check if apiPets is valid
  if (!apiPets || !Array.isArray(apiPets) || apiPets.length === 0) {
    return <div className="calculator-step1">沒有寵物資料，請先添加寵物</div>;
  }

  // Format pets: convert species from English to Chinese for display
  const formattedPets = apiPets.map((pet) => ({
    id: pet.pet_id,  // pets API 返回的是 pet_id 而不是 id
    pet_name: pet.pet_name,
    species: speciesMap[pet.pet_type] || pet.pet_type, // display Chinese
    weight: pet.weight || '',
    height: pet.height || '',
    note: '',
    avatar: pet.headshot_url || defaultAvatar,
  }));

  const [selectedPet, setSelectedPet] = useState(0);
  const [pets, setPets] = useState(formattedPets);
  const [editInfo, setEditInfo] = useState({
    weight: formattedPets[0]?.weight || '',
    height: formattedPets[0]?.height || '',
    note: formattedPets[0]?.note || '',
  });

  const [isAdding, setIsAdding] = useState(false);
  const [newPet, setNewPet] = useState({ pet_name: '', species: '貓', weight: '', height: '', note: '' });
  const [errorMsg, setErrorMsg] = useState('');

  const handleSelectPet = (idx) => {
    setSelectedPet(idx);
    setEditInfo({
      weight: pets[idx].weight,
      height: pets[idx].height,
      note: pets[idx].note,
    });
    setIsAdding(false);
  };

  const handleInfoChange = (field, value) => {
    setEditInfo((prev) => ({ ...prev, [field]: value }));
    setPets((prev) =>
      prev.map((pet, idx) => (idx === selectedPet ? { ...pet, [field]: value } : pet))
    );
  };

  const validate = () => {
    if (isAdding) {
      if (!newPet.pet_name) return '請輸入名字！';
      if (!newPet.weight) return '請輸入體重！';
      if (!newPet.height) return '請輸入身高！';
    } else {
      if (!pets[selectedPet]?.pet_name) return '請輸入名字！';
      if (!editInfo.weight) return '請輸入體重！';
      if (!editInfo.height) return '請輸入身高！';
    }
    return '';
  };

  const handleNext = async () => {
    const err = validate();
    if (err) {
      setErrorMsg(err);
      return;
    }

    setErrorMsg('');

    if (isAdding) {
      // Convert species from Chinese to English before sending to backend
      const tempPet = {
        id: Date.now(),
        pet_name: newPet.pet_name,
        species: newPet.species, // for display
        pet_type: speciesReverseMap[newPet.species], // for backend
        weight: parseFloat(newPet.weight),
        height: parseFloat(newPet.height),
        avatar: defaultAvatar,
        isTemporary: true,
      };

      // Pass pet_type in English to backend
      onNext(tempPet);
    } else {
      const updatePayload = {
        pet_id: pets[selectedPet]?.id,
        weight: parseFloat(editInfo.weight),
        height: parseFloat(editInfo.height),
      };

      try {
        await axios.post('http://127.0.0.1:8000/api/v1/calculator/pets/update/', updatePayload);
        console.log('寵物更新成功！');
      } catch (err) {
        console.error('寵物更新失敗：', err);
        alert('更新寵物資料失敗，請稍後再試');
      }

      onNext(pets[selectedPet]);
    }
  };

  return (
    <>
      <div className="calculator-title">營養計算機</div>
      <div className="pet-select-label">
        Step 1.<br />請選擇一隻寵物
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', margin: '12px 0' }}>
        <label className="switch">
          <input
            type="checkbox"
            checked={isAdding}
            onChange={() => {
              const newMode = !isAdding;
              setIsAdding(newMode);
              setNewPet({ pet_name: '', species: '貓', weight: '', height: '', note: '' });
              console.log('目前模式:', newMode ? '新增' : '選擇');
            }}
          />
          <span className="slider round"></span>
        </label>
        <span style={{ marginLeft: 12 }}>
          {isAdding ? '新增臨時寵物模式' : '選擇寵物模式'}
        </span>
      </div>

      <div className="pet-select-section">
        <div className="pet-avatar-grid">
          {pets.map((pet, idx) => (
            <img
              key={`pet-${pet.id}`}
              src={pet.avatar}
              alt={pet.pet_name}
              className={`pet-avatar${selectedPet === idx && !isAdding ? ' selected' : ''}`}
              onClick={() => handleSelectPet(idx)}
            />
          ))}
        </div>
      </div>

      <div className="pet-select-label">
        寵物資訊 {isAdding && <span style={{ color: 'gray' }}>（新增臨時寵物中）</span>}
      </div>

      <div className="pet-info-section">
        <div className="pet-info-row">
          <span className="pet-info-label">名字：</span>
          {isAdding ? (
            <input
              className="pet-info-input"
              type="text"
              value={newPet.pet_name}
              onChange={(e) => setNewPet({ ...newPet, pet_name: e.target.value })}
              placeholder="請輸入名字"
            />
          ) : (
            <span>{pets[selectedPet]?.pet_name || '未知'}</span>
          )}
        </div>
        <div className="pet-info-row">
          <span className="pet-info-label">物種：</span>
          {isAdding ? (
            <select
              className="pet-info-input"
              value={newPet.species}
              onChange={(e) => setNewPet({ ...newPet, species: e.target.value })}
            >
              <option value="貓">貓</option>
              <option value="狗">狗</option>
            </select>
          ) : (
            <span>{pets[selectedPet]?.species || '未知'}</span>
          )}
        </div>
        <div className="pet-info-row">
          <span className="pet-info-label">體重：</span>
          {isAdding ? (
            <input
              className="pet-info-input"
              type="number"
              value={newPet.weight}
              onChange={(e) => setNewPet({ ...newPet, weight: e.target.value })}
              placeholder="公斤"
            />
          ) : (
            <input
              className="pet-info-input"
              type="number"
              value={editInfo.weight}
              onChange={(e) => handleInfoChange('weight', e.target.value)}
            />
          )}
          <span>公斤</span>
        </div>
        <div className="pet-info-row">
          <span className="pet-info-label">身高：</span>
          {isAdding ? (
            <input
              className="pet-info-input"
              type="number"
              value={newPet.height}
              onChange={(e) => setNewPet({ ...newPet, height: e.target.value })}
              placeholder="公分"
            />
          ) : (
            <input
              className="pet-info-input"
              type="number"
              value={editInfo.height}
              onChange={(e) => handleInfoChange('height', e.target.value)}
            />
          )}
          <span>公分</span>
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
