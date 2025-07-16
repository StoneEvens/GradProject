import React, { useState } from 'react';
import axios from 'axios';
import '../styles/CalculatorStep1.css';
import defaultAvatar from '../MockPicture/mockCat1.jpg';

function CalculatorStep1({ onNext, pets: apiPets }) {
  const formattedPets = apiPets.map((pet) => ({
    id: pet.id,
    name: pet.name,
    species: pet.is_dog ? '狗' : '貓',
    weight: pet.weight || '',
    length: pet.length || '',
    note: '',
    avatar: pet.pet_avatar || defaultAvatar,
  }));

  const [selectedPet, setSelectedPet] = useState(0);
  const [pets, setPets] = useState(formattedPets);
  const [editInfo, setEditInfo] = useState({
    weight: pets[0]?.weight || '',
    length: pets[0]?.length || '',
    note: pets[0]?.note || '',
  });

  const [isAdding, setIsAdding] = useState(false);
  const [newPet, setNewPet] = useState({ name: '', species: '貓', weight: '', length: '', note: '' });
  const [errorMsg, setErrorMsg] = useState('');

  const handleSelectPet = (idx) => {
    setSelectedPet(idx);
    setEditInfo({
      weight: pets[idx].weight,
      length: pets[idx].length,
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

  const handleNext = async () => {
    const err = validate();
    if (err) {
      setErrorMsg(err);
      return;
    }

    setErrorMsg('');

    if (isAdding) {
      const payload = {
        user_id: 2, // 未來從 router 傳入
        name: newPet.name,
        is_dog: newPet.species === '狗',
        weight: parseFloat(newPet.weight),
        length: parseFloat(newPet.length),
        life_stage: 'adult',
        expect_adult_weight: 12,
      };

      try {
        const res = await axios.post('http://127.0.0.1:8000/api/v1/calculator/pets/create/', payload);
        alert('新增寵物成功！');
        const newPetWithId = { ...newPet, id: res.data.id || Date.now(), avatar: defaultAvatar };
        setPets((prev) => [...prev, newPetWithId]);
        setSelectedPet(pets.length);
        setIsAdding(false);
        onNext(newPetWithId);
      } catch (error) {
        console.error('新增寵物失敗：', error);
        alert('新增寵物失敗，請稍後再試');
      }
    } else {
      const updatePayload = {
        pet_id: pets[selectedPet].id,
        weight: parseFloat(editInfo.weight),
        length: parseFloat(editInfo.length),
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
              setNewPet({ name: '', species: '貓', weight: '', length: '', note: '' });
              console.log('目前模式:', newMode ? '新增' : '選擇');
            }}
          />
          <span className="slider round"></span>
        </label>
        <span style={{ marginLeft: 12 }}>
          {isAdding ? '新增寵物模式' : '選擇寵物模式'}
        </span>
      </div>

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
      </div>

      <div className="pet-select-label">
        寵物資訊 {isAdding && <span style={{ color: 'gray' }}>（新增寵物中）</span>}
      </div>

      <div className="pet-info-section">
        <div className="pet-info-row">
          <span className="pet-info-label">名字：</span>
          {isAdding ? (
            <input
              className="pet-info-input"
              type="text"
              value={newPet.name}
              onChange={(e) => setNewPet({ ...newPet, name: e.target.value })}
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
              onChange={(e) => setNewPet({ ...newPet, species: e.target.value })}
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
          <span className="pet-info-label">身長：</span>
          {isAdding ? (
            <input
              className="pet-info-input"
              type="number"
              value={newPet.length}
              onChange={(e) => setNewPet({ ...newPet, length: e.target.value })}
              placeholder="公分"
            />
          ) : (
            <input
              className="pet-info-input"
              type="number"
              value={editInfo.length}
              onChange={(e) => handleInfoChange('length', e.target.value)}
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
