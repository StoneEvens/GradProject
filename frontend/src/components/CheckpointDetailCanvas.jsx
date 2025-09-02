import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Canvas, useFrame, useThree, useLoader } from '@react-three/fiber';
import { OrbitControls, Environment } from '@react-three/drei';
import * as THREE from 'three';

// 第一人稱視角控制器
const FirstPersonCamera = ({ position = [0, 1.7, 0] }) => {
  const { camera, gl } = useThree();
  const [isPointerLocked, setIsPointerLocked] = useState(false);
  const [rotation, setRotation] = useState({ x: 0, y: 0 });
  const velocity = useRef(new THREE.Vector3());
  const direction = useRef(new THREE.Vector3());
  const keys = useRef({});

  // 設定相機初始位置（成人視角高度 1.7m）
  useEffect(() => {
    camera.position.set(...position);
    camera.lookAt(0, 1.7, -1); // 向前看
  }, [camera, position]);

  // 鍵盤事件處理
  useEffect(() => {
    const handleKeyDown = (event) => {
      keys.current[event.code] = true;
    };

    const handleKeyUp = (event) => {
      keys.current[event.code] = false;
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // 滑鼠鎖定事件處理
  useEffect(() => {
    const handlePointerLockChange = () => {
      setIsPointerLocked(document.pointerLockElement === gl.domElement);
    };

    const handleClick = () => {
      if (!isPointerLocked) {
        gl.domElement.requestPointerLock();
      }
    };

    const handleMouseMove = (event) => {
      if (!isPointerLocked) return;

      const sensitivity = 0.002;
      setRotation(prev => ({
        x: Math.max(-Math.PI/2, Math.min(Math.PI/2, prev.x - event.movementY * sensitivity)),
        y: prev.y - event.movementX * sensitivity
      }));
    };

    document.addEventListener('pointerlockchange', handlePointerLockChange);
    gl.domElement.addEventListener('click', handleClick);
    document.addEventListener('mousemove', handleMouseMove);

    return () => {
      document.removeEventListener('pointerlockchange', handlePointerLockChange);
      gl.domElement.removeEventListener('click', handleClick);
      document.removeEventListener('mousemove', handleMouseMove);
    };
  }, [gl.domElement, isPointerLocked]);

  // 每幀更新相機位置和旋轉
  useFrame((state, delta) => {
    const speed = 5; // 移動速度

    // 重置移動方向
    direction.current.set(0, 0, 0);

    // 根據按鍵設定移動方向
    if (keys.current['KeyW'] || keys.current['ArrowUp']) {
      direction.current.z -= 1;
    }
    if (keys.current['KeyS'] || keys.current['ArrowDown']) {
      direction.current.z += 1;
    }
    if (keys.current['KeyA'] || keys.current['ArrowLeft']) {
      direction.current.x -= 1;
    }
    if (keys.current['KeyD'] || keys.current['ArrowRight']) {
      direction.current.x += 1;
    }

    // 正規化移動方向
    direction.current.normalize();

    // 根據相機旋轉調整移動方向
    const cameraDirection = new THREE.Vector3();
    camera.getWorldDirection(cameraDirection);
    
    const right = new THREE.Vector3();
    right.crossVectors(cameraDirection, camera.up).normalize();

    // 計算最終移動向量
    const moveVector = new THREE.Vector3();
    moveVector.addScaledVector(cameraDirection, -direction.current.z);
    moveVector.addScaledVector(right, direction.current.x);
    moveVector.y = 0; // 不允許垂直移動

    // 應用移動
    velocity.current.copy(moveVector).multiplyScalar(speed * delta);
    
    // 簡單的地面範圍限制
    const newPosition = camera.position.clone().add(velocity.current);
    const x = newPosition.x;
    const z = newPosition.z;
    
    // 地面範圍限制（50m x 50m的平面）
    const planeSize = 50;
    const maxDistance = (planeSize / 2) - 2; // 留2米邊距
    
    // 檢查是否在地面範圍內
    const distanceFromCenter = Math.sqrt(x * x + z * z);
    
    if (distanceFromCenter < maxDistance) {
      camera.position.add(velocity.current);
    }

    // 應用滑鼠旋轉
    camera.rotation.x = rotation.x;
    camera.rotation.y = rotation.y;
    camera.rotation.order = 'YXZ';
  });

  return null;
};

// 簡單地面平面
const SimplePlane = ({ size = 50 }) => {
  return (
    <mesh 
      rotation={[-Math.PI / 2, 0, 0]} 
      position={[0, 0, 0]}
      receiveShadow
    >
      <planeGeometry args={[size, size]} />
      <meshStandardMaterial 
        color="#F5F0E8" 
        roughness={0.6}
        metalness={0.1}
      />
    </mesh>
  );
};

// 簡單照明設置
const SimpleLighting = () => {
  return (
    <>
      {/* 環境光 */}
      <ambientLight intensity={0.4} color="#ffffff" />
      
      {/* 主要陽光 */}
      <directionalLight
        position={[10, 10, 5]}
        intensity={1}
        color="#ffffff"
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-far={50}
        shadow-camera-left={-25}
        shadow-camera-right={25}
        shadow-camera-top={25}
        shadow-camera-bottom={-25}
      />
    </>
  );
};



// 主場景組件
const SimpleScene = ({ checkpoint }) => {
  return (
    <>
      <SimpleLighting />
      <SimplePlane />
      
      {/* 第一人稱視角控制 */}
      <FirstPersonCamera position={[0, 1.7, 0]} />
      
      {/* 環境貼圖 */}
      <Environment preset="sunset" />
    </>
  );
};

// 主要Canvas組件
const CheckpointDetailCanvas = ({ checkpoint, onSceneReady }) => {
  const [isSceneLoaded, setIsSceneLoaded] = useState(false);

  const handleSceneLoad = useCallback(() => {
    setIsSceneLoaded(true);
    onSceneReady?.();
  }, [onSceneReady]);

  useEffect(() => {
    // 模擬場景載入延遲
    const timer = setTimeout(() => {
      handleSceneLoad();
    }, 500);

    return () => clearTimeout(timer);
  }, [handleSceneLoad]);

  return (
    <div style={{ 
      width: '100%', 
      height: '100vh', 
      position: 'relative',
      maxWidth: '430px',
      margin: '0 auto'
    }}>
      <Canvas
        camera={{ 
          fov: 75,
          near: 0.1,
          far: 1000,
          position: [0, 1.7, 0]
        }}
        shadows="soft"
        gl={{ 
          antialias: true,
          alpha: true,
          powerPreference: "high-performance",
          shadowMap: {
            enabled: true,
            type: THREE.PCFSoftShadowMap,
            autoUpdate: true
          },
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.2
        }}
        style={{ background: 'linear-gradient(to bottom, #87CEEB 0%, #E0F6FF 50%, #F0F8FF 100%)' }}
      >
        <SimpleScene checkpoint={checkpoint} />
      </Canvas>
      
      {/* 控制說明 */}
      <div style={{
        position: 'absolute',
        bottom: '20px',
        left: '20px',
        color: 'white',
        backgroundColor: 'rgba(0,0,0,0.7)',
        padding: '10px',
        borderRadius: '5px',
        fontFamily: 'monospace',
        fontSize: '12px',
        zIndex: 100
      }}>
        <div>點擊畫面鎖定滑鼠視角</div>
        <div>WASD 或方向鍵移動</div>
        <div>滑鼠控制視角</div>
        <div>ESC 解鎖滑鼠</div>
      </div>
    </div>
  );
};

export default CheckpointDetailCanvas;