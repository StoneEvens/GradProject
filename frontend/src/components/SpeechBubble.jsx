import React, { useRef } from 'react';
import { Html } from '@react-three/drei';
import styles from '../styles/SpeechBubble.module.css';

const SpeechBubble = ({ visible }) => {
  const bubbleRef = useRef();

  return (
    <Html position={[0.25, 0.15, 0.35]} center>
      <div 
        ref={bubbleRef} 
        className={`${styles.speechBubble} ${visible ? styles.visible : ''}`}
      >
        ！ 
      </div>
    </Html>
  );
};

export default SpeechBubble; 