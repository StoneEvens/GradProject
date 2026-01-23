import React, { useState } from 'react';
import './PetHomePage.css';
import '../components/Header.css';
import '../components/BottomNavigationBar.css';
import Header from '../components/Header';
import BottomNavigationBar from '../components/BottomNavigationBar';

const PetHomePage = () => {
  const [showAddFoodModal, setShowAddFoodModal] = useState(false);
  const [selectedFood, setSelectedFood] = useState(null);
  const [newFood, setNewFood] = useState({ name: '', image: '' });
  const [foodCards, setFoodCards] = useState([
    { id: 1, name: '示範飼料1', image: '/food.jpg' },
    { id: 2, name: '示範飼料2', image: '/food.jpg' },
  ]);

  const [selectedDateIndex, setSelectedDateIndex] = useState(0);
  const nutritionResults = [
    '點擊我去使用計算機',
    '2024/12/01 的計算結果',
    '2024/12/05 的計算結果',
  ];

  const handleNext = () => {
    setSelectedDateIndex((prev) => Math.min(prev + 1, nutritionResults.length - 1));
  };

  const handlePrev = () => {
    setSelectedDateIndex((prev) => Math.max(prev - 1, 0));
  };

  return (
    <>
      <Header />
      <div className="pet-home">
        {/* 🐾 基本資料 */}
        <section className="pet-profile">
          <div className="pet-photo">
            <div className="circle"></div>
          </div>
          <div className="pet-info">
            <div className="pet-name">胖胖</div>
            <div className="pet-desc">我五歲了！我喜歡吃貓條！</div>
            <button className="edit-button">編輯</button>
          </div>
        </section>

        {/* 📌 快捷鍵 */}
        <section className="section-box">
          <div className="section-title">常用快捷鍵</div>
          <div className="quick-links">
            <button className="quick-btn"><img src="/history.png" alt="病程" />寵物病史</button>
            <button className="quick-btn"><img src="user.png" alt="飼主帳號" />飼主帳號</button>
            <button className="quick-btn"><img src="/problem.png" alt="異常" />異常紀錄</button>
            <button className="quick-btn"><img src="/report.png" alt="報告" />健康報告</button>
          </div>
        </section>

        {/* 🍽 飼料食用中 */}
        <section className="section-box">
          <div className="section-title">飼料食用中</div>
          <div className="food-items">
            {foodCards.map((food) => (
              <div key={food.id} className="food-card" onClick={() => setSelectedFood(food)}>
                <img src={food.image} alt={food.name} />
              </div>
            ))}
          </div>
          <button className="food-add" onClick={() => setShowAddFoodModal(true)}>新增</button>

          {/* 🪟 新增飼料視窗 */}
          {showAddFoodModal && (
            <div className="modal-overlay" onClick={() => setShowAddFoodModal(false)}>
              <div className="modal-content" onClick={e => e.stopPropagation()}>
                <h3>新增飼料</h3>
                <label>
                  飼料名稱：
                  <input type="text" value={newFood.name} onChange={(e) => setNewFood({ ...newFood, name: e.target.value })} />
                </label>
                <label>
                  包裝圖片：
                  <input type="file" onChange={(e) => {
                    const file = e.target.files[0];
                    const reader = new FileReader();
                    reader.onloadend = () => setNewFood({ ...newFood, image: reader.result });
                    if (file) reader.readAsDataURL(file);
                  }} />
                </label>
                <div className="modal-actions">
                  <button className="btn cancel" onClick={() => setShowAddFoodModal(false)}>取消</button>
                  <button className="btn confirm" onClick={() => {
                    if (newFood.name && newFood.image) {
                      setFoodCards([...foodCards, { ...newFood, id: Date.now() }]);
                      setNewFood({ name: '', image: '' });
                      setShowAddFoodModal(false);
                    }
                  }}>儲存</button>
                </div>
              </div>
            </div>
          )}

          {/* 📄 飼料詳細視窗 */}
          {selectedFood && (
            <div className="modal-overlay" onClick={() => setSelectedFood(null)}>
              <div className="modal-content" onClick={e => e.stopPropagation()}>
                <h3>{selectedFood.name}</h3>
                <img src={selectedFood.image} alt={selectedFood.name} style={{ width: '100%' }} />
                <div className="modal-actions">
                  <button className="btn cancel" onClick={() => setSelectedFood(null)}>返回</button>
                  <button className="btn confirm" onClick={() => {
                    setFoodCards(foodCards.filter(f => f.id !== selectedFood.id));
                    setSelectedFood(null);
                  }}>刪除</button>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* 📊 營養計算機 */}
        <section className="section-box">
          <div className="section-title-with-nav">
            <div className="section-title">營養計算機</div>
          </div>
          <div className="nutrition-box">
            <button className="calc-btn" onClick={() => alert('導向營養計算機頁面')}>{nutritionResults[selectedDateIndex]}</button>
          </div>
        </section>
      </div>
      <BottomNavigationBar />
    </>
  );
};

export default PetHomePage;
