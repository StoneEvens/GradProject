// src/PetHomePage.jsx
import React from 'react';
import './PetHomePage.css';
import '../components/Header.css';
import '../components/BottomNavigationBar.css';
import Header from '../components/Header';
import BottomNavigationBar from '../components/BottomNavigationBar';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Tooltip,
} from 'chart.js';

ChartJS.register(LineElement, PointElement, LinearScale, CategoryScale, Tooltip);

const PetHomePage = () => {
  const weightData = {
    labels: ['5/1', '5/7', '5/14', '5/21'],
    datasets: [
      {
        label: '體重 (kg)',
        data: [5.2, 5.3, 5.4, 5.5],
        borderColor: 'black',
        backgroundColor: 'lightgray',
        tension: 0.3,
      },
    ],
  };

  return (
    <>
      <Header />
      <div className="pet-home">
        <section className="pet-profile">
          <div className="pet-photo">
            <div className="circle"></div>
            <button className="add-photo">＋</button>
          </div>
          <div className="pet-info">
            <div className="pet-name">胖胖</div>
            <div className="pet-desc">我五歲了！我喜歡吃貓條！</div>
            <button className="edit-button">編輯</button>
          </div>
          <div className="pet-switcher">
            <div className="pet-icons">● ● ●</div>
          </div>
        </section>

        <section className="section-box">
          <div className="section-title">常用快捷鍵</div>
          <div className="quick-links">
            <button className="quick-btn">
              <img src="/history.png" alt="病程紀錄" />病程紀錄</button>
            <button className="quick-btn">
              <img src="user.png" alt="飼主帳號" />飼主帳號</button>
            <button className="quick-btn">
              <img src="/problem.png" alt="異常紀錄" />異常紀錄</button>
            <button className="quick-btn">
              <img src="/report.png" alt="健康報告" />健康報告</button>
          </div>
        </section>

        <section className="section-box">
          <div className="section-title">飼料食用中</div>
          <div className="food-items">
            <button className="food-add">Add</button>
            <div className="food-card" title="卡比主食罐：$85 / 成分：雞肉、南瓜">
              <img src="https://i.imgur.com/qPtQ1Iv.png" alt="food1" />
            </div>
            <div className="food-card" title="CIAO肉泥條：$25 / 成分：鮪魚、雞肉精華">
              <img src="https://i.imgur.com/W9gkFbC.png" alt="food2" />
            </div>
          </div>
        </section>

        <section className="section-box">
          <div className="section-title">體重變化曲線</div>
          <Line data={weightData} />
        </section>
      </div>
      <BottomNavigationBar />
    </>
  );
};

export default PetHomePage;
