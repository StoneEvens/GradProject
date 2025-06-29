// src/PetPage/components/SummaryPage.jsx
import React from 'react';
import '../DiseaseRecord.css';

const SummaryPage = ({ goBack }) => {
  return (
    <>
      <div className="form-section">
        <div className="form-switch blue">AI 疾病摘要</div>

        <textarea
          className="input-box big"
          defaultValue={`
在這段期間內，胖胖體重變化顯著···（此處放自動產生或使用者輸入的完整病程文字）
`}
          readOnly
        />
      </div>

      <div className="two-btns">
        <button className="btn wide" onClick={goBack}>編輯</button>
        <button className="btn wide send">上傳</button>
      </div>
    </>
  );
};

export default SummaryPage;
