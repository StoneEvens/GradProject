import React, { useState, useEffect } from 'react';
import TopNavbar from '../components/TopNavbar.jsx';
import BottomNavbar from '../components/BottomNavigationbar';
import styles from '../styles/CalculatorPage.module.css';
import { getUserPets } from '../services/petService';
import CalculatorStep1 from '../components/CalculatorStep1.jsx';
import CalculatorStep2 from '../components/CalculatorStep2.jsx';
import CalculatorStep3 from '../components/CalculatorStep3.jsx';

function CalculatorPage() {
  const [step, setStep] = useState(1);
  const [selectedFeed, setSelectedFeed] = useState(null);
  const [selectedPet, setSelectedPet] = useState(null);
  const [pets, setPets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [calculationResult, setCalculationResult] = useState(null);

  useEffect(() => {
    const fetchPets = async () => {
      try {
        const pets = await getUserPets();
        setPets(pets || []);
      } catch (error) {
        console.error('載入寵物失敗：', error);
        setPets([]);
      } finally {
        setLoading(false);
      }
    };

    fetchPets();
  }, []);

  const handleStep1Next = (pet) => {
    setSelectedPet(pet);
    setStep(2);
  };

  const handleStep2Next = (feed, result) => {
    setSelectedFeed(feed);
    setCalculationResult(result);
    setStep(3);
  };

  const handleComplete = () => {
    // 重置所有狀態，回到第一步
    setStep(1);
    setSelectedPet(null);
    setSelectedFeed(null);
    setCalculationResult(null);
  };

  return (
    <div className={styles.container}>
      <TopNavbar />
      <div className={styles.content}>
        {loading ? (
          <div className={styles.loadingContainer}>載入中...</div>
        ) : (
          <div className={styles.stepContent}>
            {step === 1 && <CalculatorStep1 onNext={handleStep1Next} pets={pets} />}
            {step === 2 && <CalculatorStep2 selectedPet={selectedPet} onNext={handleStep2Next} onPrev={() => setStep(1)} />}
            {step === 3 && <CalculatorStep3 onPrev={() => setStep(2)} onComplete={handleComplete} selectedFeed={selectedFeed} selectedPet={selectedPet} calculationResult={calculationResult}/>}
          </div>
        )}
      </div>
      <BottomNavbar />
    </div>
  );
}

export default CalculatorPage;
