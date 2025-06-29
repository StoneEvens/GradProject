// src/App.jsx
import React from 'react'
import './App.css'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Home from './Home/Home'
import LoginPage from './LoginPage/LoginPage'
import RegisterPage from './RegisterPage/RegisterPage'
import PetHomePage from './PetPage/PetHomePage'
import DiseaseRecord from './PetPage/DiseaseRecord'

function App() {
  return (
    <Router>
      <Routes>
      <Route path="/" element={<LoginPage />} />
        <Route path="/home" element={<Home />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/pet" element={<PetHomePage />} />
        <Route path="/dr" element={<DiseaseRecord />} />
      </Routes>
    </Router>
  )
}

export default App