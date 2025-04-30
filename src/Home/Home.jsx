// src/pages/Home.jsx
import React from 'react'
import Header from '../components/Header'
import DailyTasks from '../Home/components/DailyTasks'
import DailySchedule from '../Home/components/DailySchedule'
import Calendar from '../Home/components/Calendar'
import ArticleRecommendations from '../Home/components/ArticleRecommendations'
import BottomNavigationBar from '../components/BottomNavigationBar'

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
