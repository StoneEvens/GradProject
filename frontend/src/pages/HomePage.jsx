// home.jsx
import React, { Suspense, useRef, useEffect, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, useGLTF, useProgress, Environment } from "@react-three/drei";
import { useNavigate } from "react-router-dom";
import { TextureLoader } from "three";
import { useLoader } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import styles from "../styles/HomePage.module.css";
import * as THREE from "three";
import HuskyAnimation from '../components/HuskyAnimation'; 
import ShibaAnimation from '../components/ShibaAnimation';

// 預加載模型
try {
  useGLTF.preload("/assets/models/Lounge Sofa.glb");
  useGLTF.preload("/assets/models/Cat.glb");
  useGLTF.preload("/assets/models/Table.glb");
  useGLTF.preload("/assets/models/Lounge Chair.glb");
  useGLTF.preload("/assets/models/Shiba Inu.glb");
  useGLTF.preload("/assets/models/Dog bowl.glb");
  useGLTF.preload("/assets/models/Husky.glb");
  useGLTF.preload("/assets/models/Steak.glb");
  useGLTF.preload("/assets/models/Fruit Bowl.glb");
  useGLTF.preload("/assets/models/Book Stack.glb");
  useGLTF.preload("/assets/models/Cup.glb");
} catch (error) {
  console.error("模型預加載失敗:", error.message);
}

// 錯誤邊界元件
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, errorMessage: "" };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, errorMessage: error.message };
  }

  componentDidCatch(error, errorInfo) {
    console.error("3D 模型載入錯誤:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="model-error">
          <p>模型載入失敗，請刷新頁面重試</p>
          <p className="error-details">{this.state.errorMessage}</p>
          <button 
            className="retry-button"
            onClick={() => window.location.reload()}
          >
            重新嘗試
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// 載入進度元件
function LoadingIndicator() {
    const { progress, errors } = useProgress();
    const hasErrors = Object.keys(errors).length > 0;
  
    return (
      <Html center>
        <div className="loading-placeholder">
          <div className="loading-spinner"></div>
          {hasErrors ? (
            <p className="loading-error">載入出錯，請刷新頁面</p>
          ) : (
            <p>載入中...{progress.toFixed(0)}%</p>
          )}
        </div>
      </Html>
    );
  }  

// 修改 ModelLoader 組件，移除陰影相關設置
function ModelLoader({ url, position, scale, rotation, onPointerOver, onPointerOut, isShaking, ...props }) {
  const modelRef = useRef();
  const [originalPosition] = useState(position);
  const [animationProgress, setAnimationProgress] = useState(0);

  useFrame((state, delta) => {
    if (isShaking && modelRef.current) {
      setAnimationProgress((prev) => (prev + delta * 10) % (Math.PI * 2));
      
      const jumpHeight = 0.03;
      const bounce = Math.abs(Math.sin(animationProgress)) * jumpHeight;
      
      const swayAmount = 0.01;
      const swayZ = Math.sin(animationProgress * 1.5) * swayAmount;
      
      modelRef.current.position.x = originalPosition[0];
      modelRef.current.position.y = originalPosition[1] + bounce;
      modelRef.current.position.z = originalPosition[2] + swayZ;
      
      const squashStretch = 0.02;
      const squashFactor = 1 - Math.abs(Math.sin(animationProgress)) * squashStretch;
      const stretchFactor = 1 + Math.abs(Math.sin(animationProgress)) * squashStretch;
      
      modelRef.current.rotation.x = Math.sin(animationProgress * 1.5) * 0.01;
      
      if (modelRef.current.scale.x && modelRef.current.scale.y && modelRef.current.scale.z) {
        const baseScale = typeof scale === 'number' ? scale : 1;
        modelRef.current.scale.x = baseScale * squashFactor;
        modelRef.current.scale.y = baseScale * stretchFactor;
        modelRef.current.scale.z = baseScale * squashFactor;
      }
    } else if (modelRef.current) {
      modelRef.current.position.x = originalPosition[0];
      modelRef.current.position.y = originalPosition[1];
      modelRef.current.position.z = originalPosition[2];
      modelRef.current.rotation.x = rotation ? rotation[0] : 0;
      
      if (modelRef.current.scale.x && modelRef.current.scale.y && modelRef.current.scale.z) {
        const baseScale = typeof scale === 'number' ? scale : 1;
        modelRef.current.scale.x = baseScale;
        modelRef.current.scale.y = baseScale;
        modelRef.current.scale.z = baseScale;
      }
      
      setAnimationProgress(0);
    }
  });

  try {
    const { scene } = useGLTF(url);
    return (
      <primitive 
        ref={modelRef}
        object={scene} 
        position={position} 
        scale={scale}
        rotation={rotation} 
        onPointerOver={onPointerOver}
        onPointerOut={onPointerOut}
        {...props} 
      />
    );
  } catch (error) {
    console.error(`模型 ${url} 載入失敗:`, error);
    return null;
  }
}

function RotatingPlatform() {
  const groupRef = useRef();
  const [shakingCats, setShakingCats] = useState({
    cat1: false,
    cat2: false,
    cat3: false,
    shiba: false
  });

  const handleCatHover = (catId) => {
    setShakingCats(prev => ({ ...prev, [catId]: true }));
    setTimeout(() => {
      setShakingCats(prev => ({ ...prev, [catId]: false }));
    }, 800);
  };

  const woodColor = useLoader(TextureLoader, "/assets/textures/Wood_Color.png");
  const woodNormal = useLoader(TextureLoader, "/assets/textures/Wood_Normal.png");
  const woodRoughness = useLoader(TextureLoader, "/assets/textures/Wood_Roughness.png");

  useEffect(() => {
    woodColor.wrapS = woodColor.wrapT = THREE.RepeatWrapping;
    woodNormal.wrapS = woodNormal.wrapT = THREE.RepeatWrapping;
    woodRoughness.wrapS = woodRoughness.wrapT = THREE.RepeatWrapping;
  
    woodColor.repeat.set(2, 2);
    woodNormal.repeat.set(2, 2);
    woodRoughness.repeat.set(2, 2);
  }, []);

  return (
    <group ref={groupRef} position={[0, 0, 0]}>
      {/* 上蓋平台 */} 
      <mesh>
        <cylinderGeometry args={[1.5, 1.5, 0.1, 64]} />
        <meshStandardMaterial
          map={woodColor}
          normalMap={woodNormal}
          roughnessMap={woodRoughness}
          metalness={0.1}
          roughness={0.4}
        />
      </mesh>

      {/* 下接半圓體 */} 
      <mesh position={[0, 0, 0]} scale={[1, 0.6, 1]} rotation={[Math.PI, 0, 0]}>
        <sphereGeometry args={[1.5, 128, 128, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial
          map={woodColor}
          normalMap={woodNormal}
          roughnessMap={woodRoughness}
          metalness={0.1}
          roughness={0.4}
        />
      </mesh>

      <ModelLoader 
        url="/assets/models/Lounge Sofa.glb" 
        position={[-0.9, 0.05, 0]} 
        scale={1.4} 
        rotation={[0, Math.PI, 0]}
      />

      <ModelLoader 
        url="/assets/models/Lounge Chair.glb" 
        position={[0.5, 0.05, 0.2]} 
        scale={1.4} 
        rotation={[0, Math.PI/2, 0]}
      />
      
      <ModelLoader 
        url="/assets/models/Table.glb" 
        position={[-0.75, 0.05, 0.8]} 
        scale={1.2} 
        rotation={[0, Math.PI, 0]}
      />
      
      <ModelLoader 
        url="/assets/models/Cat.glb" 
        position={[0, 0.4, -0.25]} 
        scale={0.08}
        rotation={[0, Math.PI, 0]}
        onPointerOver={() => handleCatHover('cat1')}
        isShaking={shakingCats.cat1}
      />

      <HuskyAnimation />

      <ShibaAnimation />

      <ModelLoader 
        url="/assets/models/Dog bowl.glb" 
        position={[-0.4, 0.075, 1.1]} 
        scale={0.25}
        rotation={[0, 0, 0]}
      />

      <ModelLoader 
        url="/assets/models/Steak.glb" 
        position={[-0.415, 0.07, 1.1]} 
        scale={0.15}
        rotation={[0, 0, 0]}
      />

      <ModelLoader 
        url="/assets/models/Fruit Bowl.glb" 
        position={[0, 0.45, 0.6]} 
        scale={1.2}
        rotation={[0, 0, 0]}
      />

      <ModelLoader 
        url="/assets/models/Book Stack.glb" 
        position={[-0.65, 0.45, -0.3]} 
        scale={0.25}
        rotation={[0, Math.PI/2, 0]}
      />

      <ModelLoader 
        url="/assets/models/Cup.glb" 
        position={[-0.35, 0.45, 0.5]} 
        scale={0.45}
        rotation={[0, -Math.PI/1.5, 0]}
      />

    </group>
  );
}

export default function Home() {
  const navigate = useNavigate();
  const [cameraPosition, setCameraPosition] = useState([0, 1.2, 5]);
  const FOV = 42; // 視野角度（保持不變）
  const TARGET_HEIGHT = 3; // 目標物體的預期高度

  // 計算相機距離的函數
  const calculateCameraDistance = () => {
    // 獲取視窗尺寸
    const width = window.innerWidth;
    const height = window.innerHeight;
    const aspectRatio = width / height;

    // 計算所需的相機距離以保持物體在視野中的大小
    const fovRad = (FOV * Math.PI) / 180; // 將FOV轉換為弧度
    const targetDistance = (TARGET_HEIGHT / 2) / Math.tan(fovRad / 2);

    // 根據寬高比調整距離
    let adjustedDistance = targetDistance;
    
    // 寬屏幕需要更遠的距離以保持完整視野
    if (aspectRatio > 1) {
      adjustedDistance *= (1 + (aspectRatio - 1) * 0.2);
    }
    
    // 確保最小和最大距離限制
    const minDistance = 4;
    const maxDistance = 10;
    adjustedDistance = Math.max(minDistance, Math.min(maxDistance, adjustedDistance));

    // 根據螢幕寬度微調
    if (width <= 480) {
      adjustedDistance *= 1.2; // 手機螢幕略微拉遠
    } else if (width > 1440) {
      adjustedDistance *= 0.9; // 超大螢幕略微拉近
    }

    return [0, 1.2, adjustedDistance];
  };

  // 監聽視窗大小變化
  useEffect(() => {
    const handleResize = () => {
      setCameraPosition(calculateCameraDistance());
    };

    // 初始設置
    handleResize();

    // 添加事件監聽
    window.addEventListener('resize', handleResize);

    // 清理事件監聽
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const handleRegisterClick = () => {
    navigate('/register');
  };

  const handleLoginClick = () => {
    navigate('/login');
  };

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>寵物健康管理系統</h1>

      <div className={styles.canvasWrapper}>
        <ErrorBoundary>
          <Canvas 
            camera={{ 
              position: cameraPosition,
              fov: 42,
              up: [0, 1, 0],
              far: 1000
            }}
          >
            <color attach="background" args={['#ffca9c']} />
            
            <Environment preset="apartment" intensity={0.0015} />
            <ambientLight intensity={0.00001} color="#fff5e6" />
            <directionalLight
              position={[0, 50, 0]}
              intensity={0.4}
              color="#ffebcc"
            />

            <Suspense fallback={<LoadingIndicator />}>
              <RotatingPlatform />
              <OrbitControls 
                enablePan={false} 
                enableZoom={false}
                minPolarAngle={Math.PI / 2.5}
                maxPolarAngle={Math.PI / 2.5}
                enableDamping 
                dampingFactor={0.05} 
                rotateSpeed={0.5}
                minAzimuthAngle={-Math.PI / 6}
                maxAzimuthAngle={Math.PI / 6}
              />
            </Suspense>
          </Canvas>
        </ErrorBoundary>
      </div>

      <div className={styles.authContainer}>
        <button className={styles.registerButton} onClick={handleRegisterClick}>
          立刻註冊
        </button>
        <p className={styles.loginLink} onClick={handleLoginClick}>
          已經有帳號了嗎?登入
        </p>
      </div>
    </div>
  );
}
