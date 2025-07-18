import React from 'react';
import styles from '../styles/Annotation.module.css';

const Annotation = ({ annotation, x, y, isVisible, onClick }) => {
  if (!isVisible) return null;

  return (
    <div
      className={styles.annotationContainer}
      style={{
        left: `${x}%`,
        top: `${y}%`
      }}
      onClick={onClick}
    >
      {/* 標註標籤 */}
      <div className={styles.annotationLabel}>
        <div className={styles.triangle}></div>
        <div className={styles.labelContent}>
          {annotation.display_name}
        </div>
      </div>
    </div>
  );
};

export default Annotation;