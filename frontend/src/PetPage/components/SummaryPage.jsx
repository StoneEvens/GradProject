import React from 'react';
import '../DiseaseRecord.css';

const SummaryPage = ({ petName, aiText, setAiText }) => {
  return (
    <>
      <div className="record-pet-subtitle wide">{petName}</div>

      <div className="summary-section">
        <div className="summary-title">AI 病程總覽</div>
        <div className="summary-wrapper">
          <textarea
            className="summary-textarea"
            value={aiText}
            onChange={(e) => setAiText(e.target.value)}
          />
        </div>
      </div>

      <div className="summary-btn-group">
        <button className="btn upload">上傳</button>
      </div>
    </>
  );
};

export default SummaryPage;