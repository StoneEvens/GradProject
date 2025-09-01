import React, { useRef, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';

// 計算兩點間距離 (米)
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371000;
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c;
};


// 備用幾何模型組件
const FallbackCheckpointModel = ({ position, scale, isAnimating }) => {
  const groupRef = useRef();
  const [animationTime, setAnimationTime] = useState(0);

  useFrame((state, delta) => {
    if (!isAnimating || !groupRef.current) return;
    
    setAnimationTime(prev => prev + delta);
    
    // 旋轉動畫
    groupRef.current.rotation.y = animationTime * 0.5;
    
    // 上下浮動動畫
    const floatOffset = Math.sin(animationTime * 2) * 0.1;
    groupRef.current.position.y = position[1] + 0.5 + floatOffset;
  });

  return (
    <group ref={groupRef} position={position} scale={[scale, scale, scale]}>
      {/* 主體圓錐 - 添加點擊事件處理 */}
      <mesh 
        position={[0, 0.4, 0]} 
        castShadow 
        receiveShadow
        onClick={(e) => {
          console.log('主體圓錐被點擊');
          e.stopPropagation();
        }}
      >
        <coneGeometry args={[0.4, 1.2, 8]} />
        <meshStandardMaterial
          color={0x4a90e2}
          emissive={0x1a3052}
          emissiveIntensity={0.2}
          metalness={0.3}
          roughness={0.4}
          shadowSide={THREE.DoubleSide} // 雙面陰影渲染
        />
      </mesh>
      
      {/* 底座環形 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} castShadow receiveShadow>
        <torusGeometry args={[0.5, 0.08, 6, 24]} />
        <meshStandardMaterial
          color={0x66bbff}
          transparent
          opacity={0.8}
          metalness={0.8}
          roughness={0.2}
          shadowSide={THREE.DoubleSide}
        />
      </mesh>
      
      {/* 中心發光球 */}
      <mesh position={[0, 0.4, 0]} castShadow>
        <sphereGeometry args={[0.15, 16, 16]} />
        <meshStandardMaterial
          color={0xffffff}
          emissive={0xffffff}
          emissiveIntensity={0.3}
          metalness={0.1}
          roughness={0.1}
        />
      </mesh>
      
      {/* 不可見的大型點擊區域 */}
      <mesh position={[0, 0.5, 0]} visible={false}>
        <boxGeometry args={[2, 2, 2]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>
    </group>
  );
};

// GLB模型載入組件
const GLBCheckpointModel = ({ position, scale, isAnimating }) => {
  const groupRef = useRef();
  const [animationTime, setAnimationTime] = useState(0);
  const { scene, error } = useGLTF('/assets/models/Checkpoint.glb');

  // 如果模型載入失敗，返回備用模型
  if (error) {
    console.warn('GLB模型載入失敗，使用備用模型:', error);
    return <FallbackCheckpointModel position={position} scale={scale} isAnimating={isAnimating} />;
  }

  useFrame((state, delta) => {
    if (!isAnimating || !groupRef.current) return;
    
    setAnimationTime(prev => prev + delta);
    
    // 旋轉動畫
    groupRef.current.rotation.y = animationTime * 0.5;
    
    // 上下浮動動畫
    const floatOffset = Math.sin(animationTime * 2) * 0.02;
    groupRef.current.position.y = position[1] + 0.5 + floatOffset;
  });

  useEffect(() => {
    if (scene && groupRef.current) {
      // 為GLB模型啟用陰影和優化材質
      scene.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
          
          // 更新材質以支援環境光和陰影
          if (child.material) {
            child.material.envMapIntensity = 1.0;
            child.material.shadowSide = THREE.DoubleSide; // 雙面陰影
            child.material.needsUpdate = true;
          }
        }
      });
    }
  }, [scene]);

  return (
    <group ref={groupRef} position={position} scale={[scale, scale, scale]}>
      <primitive object={scene.clone()} />
    </group>
  );
};

// 主要CheckpointModel組件
const CheckpointModel = ({ checkpoint, position, userLocation, converter, onClick }) => {
  const [currentDistance, setCurrentDistance] = useState(null);
  const [currentScale, setCurrentScale] = useState(1.0);
  const [isVisible, setIsVisible] = useState(true);
  const [isHovered, setIsHovered] = useState(false);
  const [isClicked, setIsClicked] = useState(false);

  // 距離縮放配置 - 三種大小
  const distanceScales = {
    close: { max: 100, scale: 10.0 },       // 100m內 - 最大
    medium: { max: 500, scale: 15.0 },      // 100-500m - 中等
    far: { max: Infinity, scale: 18.0 },     // 500m外 - 最小
  };

  // 更新距離和縮放
  useEffect(() => {
    if (!userLocation) return;

    const distance = calculateDistance(
      userLocation.lat,
      userLocation.lng,
      checkpoint.lat,
      checkpoint.lng
    );

    setCurrentDistance(distance);

    // 超過1000m隱藏（增加可見範圍）
    if (distance > 1000) {
      setIsVisible(false);
      return;
    }

    setIsVisible(true);

    // 計算縮放比例 - 簡化為三種大小
    let scaleConfig;
    
    if (distance <= distanceScales.close.max) {
      scaleConfig = distanceScales.close;  // 100m內
    } else if (distance <= distanceScales.medium.max) {
      scaleConfig = distanceScales.medium; // 100-500m
    } else {
      scaleConfig = distanceScales.far;    // 500m外
    }

    setCurrentScale(scaleConfig.scale);
  }, [userLocation, checkpoint]);

  // 點擊處理 - 增強調試
  const handleClick = (event) => {
    console.log('=== CHECKPOINT CLICKED ===');
    console.log('Event:', event);
    console.log('Checkpoint:', checkpoint);
    
    event.stopPropagation();
    
    // 點擊動畫效果
    setIsClicked(true);
    setTimeout(() => setIsClicked(false), 200);
    
    const distance = currentDistance || 0;
    const distanceText = distance < 1000
      ? `${Math.round(distance)} 公尺`
      : `${(distance / 1000).toFixed(1)} 公里`;
      
    let distanceLevel = '';
    if (distance <= 100) {
      distanceLevel = '近距離';
    } else if (distance <= 500) {
      distanceLevel = '中距離';
    } else {
      distanceLevel = '遠距離';
    }

    // 控制台日誌
    console.log(`點擊站點: ${checkpoint.name}, ${distanceLevel}, ${distanceText}`);
    
    // 呼叫父組件的點擊處理函數
    if (onClick) {
      onClick(checkpoint);
    }
  };

  // 滑鼠懸停處理 - 增強調試
  const handlePointerOver = (event) => {
    console.log('=== CHECKPOINT HOVER IN ===');
    event.stopPropagation();
    setIsHovered(true);
    document.body.style.cursor = 'pointer';
  };

  const handlePointerOut = (event) => {
    console.log('=== CHECKPOINT HOVER OUT ===');
    event.stopPropagation();
    setIsHovered(false);
    document.body.style.cursor = 'default';
  };

  if (!isVisible) {
    return null;
  }

  // 計算互動效果的縮放
  const interactiveScale = isClicked ? currentScale * 0.9 : isHovered ? currentScale * 1.1 : currentScale;

  return (
    <group userData={{ checkpoint, isClickable: true }}>
      {/* 精確的點擊區域 - 只匹配模型大小 */}
      <mesh 
        position={position}
        onClick={handleClick} 
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
        visible={false}
      >
        <sphereGeometry args={[currentScale * 0.6]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>
      
      {/* 嘗試載入GLB模型，失敗則使用備用模型 */}
      <GLBCheckpointModel
        position={position}
        scale={interactiveScale}
        isAnimating={true}
      />
      
    </group>
  );
};

// 預載入GLB模型
try {
  useGLTF.preload('/assets/models/Checkpoint.glb');
} catch (error) {
  console.warn('無法預載入CheckpointModel GLB檔案:', error);
}

export default CheckpointModel;