// src/pages/Home.jsx
import React from 'react'
import Header from '../components/Home/Header'
import DailyTasks from '../components/Home/DailyTasks'
import DailySchedule from '../components/Home/DailySchedule'
import Calendar from '../components/Home/Calendar'
import ArticleRecommendations from '../components/Home/ArticleRecommendations'
import BottomNavigationBar from '../components/Home/BottomNavigationBar'

function Home() {
  return (
    <>
      <Header />
      <div className="app-container">
        <div className="main-content">
          <div className="task-schedule-wrapper">
            <DailyTasks />
            <DailySchedule />
          </div>
          <Calendar />
          <ArticleRecommendations />
        </div>
      </div>
      <BottomNavigationBar />
    </>
  )
}

export default Home
