import React from 'react';
import { useNavigate } from 'react-router-dom';
import styles from '../styles/HomePage.module.css';

const HomePage = () => {
  const navigate = useNavigate();

  const handleRegisterClick = () => {
    navigate('/register');
  };

  const handleLoginClick = () => {
    navigate('/login');
  };

  return (
    <div className={styles.container}>
      <div className={styles.buttonWrapper}>
        <button
          className={styles.registerButton}
          onClick={handleRegisterClick}
          aria-label="立刻註冊"
        />
        <button
          className={styles.loginButton}
          onClick={handleLoginClick}
          aria-label="登入"
        />
      </div>
    </div>
  );
};

export default HomePage;