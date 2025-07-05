import React from 'react';
import styles from '../styles/PetSwitcher.module.css';

const PetSwitcher = ({ 
  allPets, 
  currentPet, 
  onPetSwitch, 
  onAddPet
}) => {
  
  const handlePetClick = (pet) => {
    if (pet.id !== currentPet?.id) {
      onPetSwitch(pet);
    }
  };

  // 如果沒有寵物，不顯示組件
  if (!allPets || allPets.length === 0) {
    return null;
  }

  return (
    <div className={styles.petSwitcherContainer}>
      {/* 標題區域 */}
      <div className={styles.header}>
        <span className={styles.title}>切換目前寵物</span>
        <button className={styles.addButton} onClick={onAddPet}>
          新增寵物
        </button>
      </div>
      
      {/* 寵物列表 */}
      <div className={styles.petList}>
        {allPets.map((pet) => (
          <div
            key={pet.id}
            className={`${styles.petItem} ${currentPet?.id === pet.id ? styles.activePet : ''}`}
            onClick={() => handlePetClick(pet)}
          >
            <div className={styles.petAvatarWrapper}>
              <img
                src={pet.avatarUrl || '/assets/icon/DefaultAvatar.jpg'}
                alt={pet.name}
                className={styles.petAvatar}
              />
              {currentPet?.id === pet.id && (
                <div className={styles.activeIndicator}></div>
              )}
            </div>
            <span className={styles.petName}>{pet.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PetSwitcher; 