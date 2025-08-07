import React, { useState } from 'react';
import axios from 'axios';
import styles from '../styles/CalculatorStep1.module.css';
import defaultAvatar from '../MockPicture/mockCat1.jpg';
import NotificationComponent from './Notification';
import HistoryRecordModal from './HistoryRecordModal';

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
  const [notification, setNotification] = useState('');
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  
  // 過去紀錄按鈕點擊事件
  const handleHistoryClick = () => {
    setShowHistoryModal(true);
  };
  
  // Check if apiPets is valid
  if (!apiPets || !Array.isArray(apiPets) || apiPets.length === 0) {
    return <div className={styles.container}>沒有寵物資料，請先添加寵物</div>;
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
        setNotification('更新寵物資料失敗，請稍後再試');
      }

      onNext(pets[selectedPet]);
    }
  };

  return (
    <>
      <div className={styles.titleSection}>
        <h2 className={styles.title}>營養計算機</h2>
        <button className={styles.historyButton} onClick={handleHistoryClick}>
          過去紀錄
        </button>
      </div>
      <div className={styles.divider}></div>
      
      <div className={styles.stepLabel}>
        <span>Step 1. 請選擇一隻寵物</span>
        <div className={styles.modeSwitch}>
          <label className={styles.switch}>
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
            <span className={styles.slider}></span>
          </label>
          <span className={styles.modeText}>
            {isAdding ? '新增臨時寵物' : '選擇寵物'}
          </span>
        </div>
      </div>

      <div className={styles.section}>
        <label className={styles.sectionLabel}>選擇寵物:</label>
        <div className={styles.petSwitcher}>
          {pets.map((pet, idx) => (
            <div
              key={`pet-${pet.id}`}
              className={`${styles.petItem} ${selectedPet === idx && !isAdding ? styles.activePet : ''}`}
              onClick={() => handleSelectPet(idx)}
            >
              <img
                src={pet.avatar}
                alt={pet.pet_name}
                className={styles.petAvatar}
              />
            </div>
          ))}
        </div>
      </div>

      <div className={styles.section}>
        <label className={styles.sectionLabel}>
          寵物資訊 {isAdding && <span className={styles.addingHint}>（新增臨時寵物中）</span>}
        </label>
        <div className={styles.petInfoSection}>
          <div className={styles.petInfoRow}>
            <span className={styles.petInfoLabel}>名字：</span>
            {isAdding ? (
              <input
                className={styles.petInfoInput}
                type="text"
                value={newPet.pet_name}
                onChange={(e) => setNewPet({ ...newPet, pet_name: e.target.value })}
                placeholder="請輸入名字"
              />
            ) : (
              <span className={styles.petInfoValue}>{pets[selectedPet]?.pet_name || '未知'}</span>
            )}
          </div>
          <div className={styles.petInfoRow}>
            <span className={styles.petInfoLabel}>物種：</span>
            {isAdding ? (
              <select
                className={styles.petInfoSelect}
                value={newPet.species}
                onChange={(e) => setNewPet({ ...newPet, species: e.target.value })}
              >
                <option value="貓">貓</option>
                <option value="狗">狗</option>
              </select>
            ) : (
              <span className={styles.petInfoValue}>{pets[selectedPet]?.species || '未知'}</span>
            )}
          </div>
          <div className={styles.petInfoRow}>
            <span className={styles.petInfoLabel}>體重：</span>
            {isAdding ? (
              <input
                className={styles.petInfoInput}
                type="number"
                value={newPet.weight}
                onChange={(e) => setNewPet({ ...newPet, weight: e.target.value })}
                placeholder="公斤"
              />
            ) : (
              <input
                className={styles.petInfoInput}
                type="number"
                value={editInfo.weight}
                onChange={(e) => handleInfoChange('weight', e.target.value)}
              />
            )}
            <span className={styles.petInfoUnit}>公斤</span>
          </div>
          <div className={styles.petInfoRow}>
            <span className={styles.petInfoLabel}>身高：</span>
            {isAdding ? (
              <input
                className={styles.petInfoInput}
                type="number"
                value={newPet.height}
                onChange={(e) => setNewPet({ ...newPet, height: e.target.value })}
                placeholder="公分"
              />
            ) : (
              <input
                className={styles.petInfoInput}
                type="number"
                value={editInfo.height}
                onChange={(e) => handleInfoChange('height', e.target.value)}
              />
            )}
            <span className={styles.petInfoUnit}>公分</span>
          </div>
        </div>
        {errorMsg && (
          <div className={styles.errorMsg}>{errorMsg}</div>
        )}
      </div>

      <div className={styles.actionButtons}>
        <button className={styles.nextButton} onClick={handleNext}>下一步</button>
      </div>
      
      <HistoryRecordModal
        isOpen={showHistoryModal}
        onClose={() => setShowHistoryModal(false)}
      />
      
      {notification && (
        <NotificationComponent 
          message={notification} 
          onClose={() => setNotification('')} 
        />
      )}
    </>
  );
}

export default CalculatorStep1;
