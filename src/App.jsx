// src/App.jsx
import React from 'react'
import './App.css'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Home from './Home/Home'
import LoginPage from './LoginPage/LoginPage'
import RegisterPage from './RegisterPage/RegisterPage'
import PetHomePage from './PetPage/PetHomePage'
import PetHomePage from './PetPage/DProgress'

function App() {
  return (
    <Router>
      <Routes>
      <Route path="/" element={<LoginPage />} />
        <Route path="/home" element={<Home />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/pet" element={<PetHomePage />} />
        <Route path="/pro" element={<DProgress />} />
      </Routes>
    </Router>
  )
}

export default App