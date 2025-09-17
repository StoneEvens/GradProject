import React from 'react';
import { useTranslation } from 'react-i18next';
import styles from '../styles/PetSwitcher.module.css';

const PetSwitcher = ({
  allPets,
  currentPet,
  onPetSwitch,
  onAddPet
}) => {
  const { t } = useTranslation('pet');
  
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
        <span className={styles.title}>{t('page.switcher.title')}</span>
        <button className={styles.addButton} onClick={onAddPet}>
          {t('page.switcher.addButton')}
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
                alt={pet.pet_name}
                className={styles.petAvatar}
              />
              {currentPet?.id === pet.id && (
                <div className={styles.activeIndicator}></div>
              )}
            </div>
            <span className={styles.petName}>{pet.pet_name}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PetSwitcher; 