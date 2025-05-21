import React, { useState } from 'react';
import Header from '../components/Header';
import BottomNavigationBar from '../components/BottomNavigationBar';
import './components/CalculatorPage.css';
import CalculatorStep1 from './CalculatorStep1';
import CalculatorStep2 from './CalculatorStep2';
import CalculatorStep3 from './CalculatorStep3';

function CalculatorPage() {
  const [step, setStep] = useState(1);

  return (
    <div className="calculator-page-container">
      <Header />
      <div className="calculator-content">
        {step === 1 && <CalculatorStep1 onNext={() => setStep(2)} />}
        {step === 2 && <CalculatorStep2 onNext={() => setStep(3)} onPrev={() => setStep(1)} />}
        {step === 3 && <CalculatorStep3 onPrev={() => setStep(2)} />}
      </div>
      <BottomNavigationBar />
    </div>
  );
}

export default CalculatorPage;
