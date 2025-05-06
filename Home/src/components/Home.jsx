// src/pages/Home.jsx
import React from 'react'
import Header from '../components/Header'
import DailyTasks from '../components/DailyTasks'
import DailySchedule from '../components/DailySchedule'
import Calendar from '../components/Calendar'
import ArticleRecommendations from '../components/ArticleRecommendations'
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
