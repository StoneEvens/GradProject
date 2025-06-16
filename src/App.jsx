// src/App.jsx
import React from 'react'
import './App.css'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Home from './Home/Home'
import LoginPage from './LoginPage/LoginPage'
import RegisterPage from './RegisterPage/RegisterPage'
import ProfilePage from './ProfilePage/ProfilePage'
import CommunityPage from './CommunityPage/CommunityPage'
import ForumPage from './ForumPage/ForumPage'
import CalculatorPage from './CalculatorPage/CalculatorPage'
import CreateSymptomRecord from './CreateSymptomRecord/CreateSymptomRecord'
import ViewSymptomRecord from './ViewSymptomRecord/ViewSymptomRecord'
import CreateCommunityPost from './CreateCommunityPost/CreateCommunityPost'

function App() {
  return (
    <Router>
      <Routes>
      <Route path="/" element={<LoginPage />} />
        <Route path="/home" element={<Home />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/profilepage" element={<ProfilePage />} />
        <Route path="/communitypage" element={<CommunityPage />} />
        <Route path="/forumpage" element={<ForumPage />} />
        <Route path="/calculatorpage" element={<CalculatorPage />} />
        <Route path="/create-symptom-record" element={<CreateSymptomRecord />} />
        <Route path="/view-symptom-record" element={<ViewSymptomRecord />} />
        <Route path="/create-community-post" element={<CreateCommunityPost />} />
      </Routes>
    </Router>
  )
}

export default App