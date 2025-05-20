// src/pages/Home.jsx
import React from 'react'
import Header from './Header'
import DailyTasks from './DailyTasks'
import DailySchedule from './DailySchedule'
import Calendar from './Calendar'
import ArticleRecommendations from './ArticleRecommendations'
import BottomNavigationBar from '../../Public/components/BottomNavigationBar'

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
