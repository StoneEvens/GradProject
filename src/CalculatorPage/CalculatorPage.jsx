import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Header from '../components/Header';
import BottomNavigationBar from '../components/BottomNavigationBar';
import './components/CalculatorPage.css';
import CalculatorStep1 from './CalculatorStep1';
import CalculatorStep2 from './CalculatorStep2';
import CalculatorStep3 from './CalculatorStep3';

function CalculatorPage() {
  const [step, setStep] = useState(1);
  const [selectedFeed, setSelectedFeed] = useState(null);
  const [selectedPet, setSelectedPet] = useState(null);
  const [pets, setPets] = useState([]);
  const [loading, setLoading] = useState(true);

  // 這裡先寫死 user_id = 2，之後可以從 props 或 context 傳入
  const userId = 2;

  useEffect(() => {
    const fetchPets = async () => {
      try {
        const response = await axios.get(`http://127.0.0.1:8000/api/pets/?user_id=${userId}`);
        setPets(response.data);
      } catch (error) {
        console.error('載入寵物失敗：', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPets();
  }, [userId]);

  const handleStep1Next = (pet) => {
    setSelectedPet(pet);
    setStep(2);
  };

  const handleStep2Next = (feed) => {
    setSelectedFeed(feed);
    setStep(3);
  };

  return (
    <div className="calculator-page-container">
      <Header />
      <div className="calculator-content">
        {loading ? (
          <div style={{ padding: '2rem', textAlign: 'center' }}>載入中...</div>
        ) : (
          <>
            {step === 1 && <CalculatorStep1 onNext={handleStep1Next} pets={pets} />}
            {step === 2 && <CalculatorStep2 onNext={handleStep2Next} onPrev={() => setStep(1)} />}
            {step === 3 && <CalculatorStep3 onPrev={() => setStep(2)} selectedFeed={selectedFeed} selectedPet={selectedPet} />}
          </>
        )}
      </div>
      <BottomNavigationBar />
    </div>
  );
}

export default CalculatorPage;



// import React, { useState } from 'react';
// import Header from '../components/Header';
// import BottomNavigationBar from '../components/BottomNavigationBar';
// import './components/CalculatorPage.css';
// import CalculatorStep1 from './CalculatorStep1';
// import CalculatorStep2 from './CalculatorStep2';
// import CalculatorStep3 from './CalculatorStep3';

// function CalculatorPage() {
//   const [step, setStep] = useState(1);
//   const [selectedFeed, setSelectedFeed] = useState(null);
//   const [selectedPet, setSelectedPet] = useState(null);

//   const handleStep1Next = (pet) => {
//     setSelectedPet(pet);
//     setStep(2);
//   };
//   const handleStep2Next = (feed) => {
//     setSelectedFeed(feed);
//     setStep(3);
//   };

//   return (
//     <div className="calculator-page-container">
//       <Header />
//       <div className="calculator-content">
//         {step === 1 && <CalculatorStep1 onNext={handleStep1Next} />}
//         {step === 2 && <CalculatorStep2 onNext={handleStep2Next} onPrev={() => setStep(1)} />}
//         {step === 3 && <CalculatorStep3 onPrev={() => setStep(2)} selectedFeed={selectedFeed} selectedPet={selectedPet} />}
//       </div>
//       <BottomNavigationBar />
//     </div>
//   );
// }

// export default CalculatorPage;
