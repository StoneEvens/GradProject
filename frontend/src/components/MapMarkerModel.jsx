import React, { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// 漂浮紅球模型組件
const CustomMapMarkerModel = ({ position, rotation = 0 }) => {
  const groupRef = useRef();
  const [animationTime, setAnimationTime] = useState(0);

  // 紅球參數
  const sphereRadius = 0.5; // 球體半徑
  const floatHeight = 1.5; // 漂浮高度

  useFrame((state, delta) => {
    if (!groupRef.current) return;
    
    setAnimationTime(prev => prev + delta);
    
    // 漂浮動畫 - 上下浮動幅度更大，速度更慢
    const floatOffset = Math.sin(animationTime * 1.5) * 0.3;
    groupRef.current.position.y = position[1] + floatHeight + floatOffset;
    
    // 輕微的左右擺動增加漂浮感
    const swayOffset = Math.sin(animationTime * 0.8) * 0.1;
    groupRef.current.position.x = position[0] + swayOffset;
    
    // 慢速自轉
    groupRef.current.rotation.y = animationTime * 0.5;
  });

  return (
    <group ref={groupRef} position={position} scale={[1, 1, 1]}>
      {/* 漂浮的紅球 */}
      <mesh 
        position={[0, 0, 0]} 
        castShadow 
        receiveShadow
      >
        <sphereGeometry args={[sphereRadius, 64, 64]} />
        <meshStandardMaterial 
          color={0xff0000} // 紅色
          metalness={0.2}
          roughness={0.3}
          emissive={0x330000} // 輕微的紅色發光
          emissiveIntensity={0.2}
          shadowSide={THREE.DoubleSide} // 雙面陰影渲染
        />
      </mesh>
      
      {/* 球體下方的輕微陰影效果 */}
      <mesh 
        position={[0, -floatHeight - 0.1, 0]} 
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <circleGeometry args={[sphereRadius * 0.8, 32]} />
        <meshBasicMaterial 
          color={0x000000}
          transparent 
          opacity={0.2}
        />
      </mesh>
    </group>
  );
};

// 主要MapMarkerModel組件
const MapMarkerModel = ({ position, rotation = 0 }) => {
  return (
    <group userData={{ type: 'mapMarker', isPlayer: true }}>
      <CustomMapMarkerModel
        position={position}
        rotation={rotation}
      />
    </group>
  );
};

export default MapMarkerModel;