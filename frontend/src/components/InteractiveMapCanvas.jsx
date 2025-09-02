import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Environment } from '@react-three/drei';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import * as THREE from 'three';
import CheckpointModel from './CheckpointModel';
import MapMarkerModel from './MapMarkerModel';

// Mapbox配置
const mapboxToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;
const mapboxStyleId = import.meta.env.VITE_MAPBOX_STYLE_ID || 'mapbox://styles/mapbox/streets-v12';
mapboxgl.accessToken = mapboxToken;

// 輔助函數：將角度轉換為方位描述
const getDirectionDescription = (angle) => {
  if (angle >= 337.5 || angle < 22.5) return "正北";
  if (angle >= 22.5 && angle < 67.5) return "東北";
  if (angle >= 67.5 && angle < 112.5) return "正東";
  if (angle >= 112.5 && angle < 157.5) return "東南";
  if (angle >= 157.5 && angle < 202.5) return "正南";
  if (angle >= 202.5 && angle < 247.5) return "西南";
  if (angle >= 247.5 && angle < 292.5) return "正西";
  if (angle >= 292.5 && angle < 337.5) return "西北";
  return "未知";
};

// 座標轉換工具
class CoordinateConverter {
  constructor() {
    this.origin = null;
    // 調整縮放比例 - 1度約111000米，所以1米約0.000009度
    // 反向計算：1度 = 111000米，所以縮放比例應該是111000
    this.scale = 111000; // 更準確的地理座標轉換比例
  }

  setOrigin(lng, lat) {
    this.origin = { lng, lat };
  }

  // 地理座標轉Three.js世界座標
  geoToWorld(lng, lat) {
    if (!this.origin) return [0, 0, 0];
    
    // 使用Web Mercator投影的近似計算
    const x = (lng - this.origin.lng) * this.scale * Math.cos(this.origin.lat * Math.PI / 180);
    const z = (lat - this.origin.lat) * this.scale; // 修正Z軸方向，北方為正Z
    
    return [x, 0, z];
  }

  // Three.js世界座標轉地理座標
  worldToGeo(x, z) {
    if (!this.origin) return { lng: 0, lat: 0 };
    
    const lng = this.origin.lng + (x / this.scale / Math.cos(this.origin.lat * Math.PI / 180));
    const lat = this.origin.lat + (z / this.scale); // 修正Z軸方向
    
    return { lng, lat };
  }

  // 座標轉換（移除調試訊息）
  debugConversion(lng, lat, label = '') {
    const worldPos = this.geoToWorld(lng, lat);
    return worldPos;
  }
}

// 相機控制器 - 同步相機和地圖旋轉
const CameraController = ({ userLocation, converter, onBearingChange, mapInstance }) => {
  const { camera } = useThree();
  const [bearing, setBearing] = useState(0); // 內部控制的方向角
  const [targetPosition, setTargetPosition] = useState([0, 15, 25]);
  const [targetLookAt, setTargetLookAt] = useState([0, 0, 0]);
  const bearingRef = useRef(0); // 用於在 useFrame 中訪問最新的 bearing 值

  // 更新 bearingRef
  useEffect(() => {
    bearingRef.current = bearing;
  }, [bearing]);

  // 根據bearing計算相機位置並同步地圖
  useEffect(() => {
    if (!userLocation || !converter.origin) return;

    // 用戶位置在Three.js中始終是原點[0,0,0]
    const userWorldPos = [0, 0, 0];
    
    // 計算相機位置
    const height = 20;
    const distance = 35;
    const bearingRad = bearing * Math.PI / 180;
    
    const cameraX = userWorldPos[0] + Math.sin(bearingRad) * distance;
    const cameraZ = userWorldPos[2] + Math.cos(bearingRad) * distance;
    
    setTargetPosition([cameraX, height, cameraZ]);
    setTargetLookAt(userWorldPos);
    
    // 立即同步地圖旋轉，不使用動畫
    if (mapInstance && mapInstance.current) {
      mapInstance.current.setBearing(-bearing);
    }
    
    // 通知父組件bearing變化
    onBearingChange?.(bearing);
  }, [bearing, userLocation, converter, onBearingChange, mapInstance]);

  // 鍵盤控制相機旋轉 - 移除防抖處理
  useEffect(() => {
    const keydownHandler = (e) => {
      const rotationStep = 10;
      
      switch(e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          setBearing(prev => (prev - rotationStep + 360) % 360);
          break;
        case 'ArrowRight':
          e.preventDefault();
          setBearing(prev => (prev + rotationStep) % 360);
          break;
        case 'ArrowUp':
        case 'ArrowDown':
          e.preventDefault();
          break;
      }
    };

    document.addEventListener('keydown', keydownHandler);
    return () => document.removeEventListener('keydown', keydownHandler);
  }, []);

  // 快速更新相機位置 - 輕微插值減少突兀感
  useFrame(() => {
    if (targetPosition && targetLookAt) {
      camera.position.lerp(new THREE.Vector3(...targetPosition), 0.3);
      camera.lookAt(new THREE.Vector3(...targetLookAt));
    }
  });

  return null;
};

// 計算兩個地理座標間的距離（米）
const calculateDistance = (lat1, lng1, lat2, lng2) => {
  const R = 6371000; // 地球半徑（米）
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

// Three.js場景組件
const Scene = ({ userLocation, checkpoints, converter, onBearingChange, mapInstance, onModelsGenerated, onCheckpointClick }) => {
  const [simulationModels, setSimulationModels] = useState([]);

  // 生成10個隨機分布的模擬checkpoint
  useEffect(() => {
    if (userLocation && !converter.origin) {
      const models = [];
      
      // 生成10個隨機checkpoint，在700米範圍內隨機分布
      for (let i = 0; i < 10; i++) {
        // 隨機距離：0-700米
        const distance = Math.random() * 700;
        
        // 隨機角度：0-360度
        const angle = Math.random() * 360;
        const angleRad = angle * Math.PI / 180;
        
        // 計算模型的地理座標位置
        // 1度約 111000米，所以距離轉換為度數
        // 注意：在地理座標系中，北方是正緯度(lat)，東方是正經度(lng)
        const deltaLat = (distance * Math.cos(angleRad)) / 111000;
        const deltaLng = (distance * Math.sin(angleRad)) / (111000 * Math.cos(userLocation.lat * Math.PI / 180));
        
        const modelLng = userLocation.lng + deltaLng;
        const modelLat = userLocation.lat + deltaLat;
        
        models.push({
          id: `checkpoint_${i}`,
          name: `Checkpoint ${i + 1}`,
          lng: modelLng,
          lat: modelLat,
          distance: distance,
          angle: angle
        });
      }
      
      setSimulationModels(models);
      
      // 通知父組件模型已生成
      onModelsGenerated?.(models, userLocation);
    }
  }, [userLocation]);

  // 設置坐標系原點
  useEffect(() => {
    if (userLocation && !converter.origin) {
      converter.setOrigin(userLocation.lng, userLocation.lat);
    }
  }, [userLocation, converter, simulationModels]);

  return (
    <>
      
      {/* 增強環境光 */}
      <ambientLight intensity={1.0} color="#fff5e6" />
      
      {/* 主方向光 - 模擬太陽光，優化陰影品質 */}
      <directionalLight
        position={[50, 60, 30]}
        intensity={1.8}
        color="#fff8e1"
        castShadow
        shadow-mapSize-width={4096} // 提高陰影解析度
        shadow-mapSize-height={4096}
        shadow-camera-far={200} // 增加陰影渲染範圍
        shadow-camera-left={-100}
        shadow-camera-right={100}
        shadow-camera-top={100}
        shadow-camera-bottom={-100}
        shadow-camera-near={0.1}
        shadow-bias={-0.0005} // 減少陰影瑕疵
        shadow-normalBias={0.02}
      />
      
      {/* 補充方向光 - 減少陰影過暗 */}
      <directionalLight
        position={[-20, 30, -15]}
        intensity={1.0}
        color="#e6f3ff"
      />
      
      {/* 頂部光源 - 增加整體亮度 */}
      <directionalLight
        position={[0, 50, 0]}
        intensity={0.6}
        color="#ffffff"
      />
      
      {/* 陰影接收地面 - 隱形平面用於接收陰影 */}
      <mesh 
        rotation={[-Math.PI / 2, 0, 0]} 
        position={[0, -0.1, 0]} 
        receiveShadow
        visible={false}
      >
        <planeGeometry args={[500, 500]} />
        <shadowMaterial transparent opacity={0.4} />
      </mesh>

      

      {/* 用戶模型 (立體指針) - 始終在原點，不再旋轉 */}
      {userLocation && (
        <MapMarkerModel
          position={[0, 0, 0]} // 用戶始終在原點
          rotation={0} // 指針不旋轉，改用相機旋轉
        />
      )}

      {/* 模擬checkpoint - 只顯示1000米以內的 */}
      {simulationModels
        .filter(model => {
          // 計算checkpoint與用戶的實際距離
          const distance = calculateDistance(
            userLocation.lat, userLocation.lng,
            model.lat, model.lng
          );
          return distance <= 1000; // 只顯示1000米以內的
        })
        .map(model => {
          const position = converter.debugConversion(model.lng, model.lat, `渲染${model.name}`);
          return (
            <CheckpointModel
              key={model.id}
              checkpoint={model}
              position={position}
              userLocation={userLocation}
              converter={converter}
              onClick={onCheckpointClick}
            />
          );
        })}

      {/* 相機控制器 */}
      <CameraController
        userLocation={userLocation}
        converter={converter}
        onBearingChange={onBearingChange}
        mapInstance={mapInstance}
      />
    </>
  );
};

// 主要組件
const InteractiveMapCanvas = ({ 
  userLocation, 
  checkpoints = [],
  onMapLoad,
  onMapReady,
  onBearingChange,
  onCheckpointClick 
}) => {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const converterRef = useRef(new CoordinateConverter());
  const [mapBearing, setMapBearing] = useState(0);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [simulationModels, setSimulationModels] = useState([]);
  const [currentUserLocation, setCurrentUserLocation] = useState(null);

  // 處理模型生成回調
  const handleModelsGenerated = useCallback((models, userLoc) => {
    setSimulationModels(models);
    setCurrentUserLocation(userLoc);
  }, []);

  // 創建和配置Mapbox地圖
  useEffect(() => {
    if (!mapRef.current || !userLocation || mapInstance.current) return;

    // 創建Mapbox實例
    mapInstance.current = new mapboxgl.Map({
      container: mapRef.current,
      center: [userLocation.lng, userLocation.lat],
      zoom: 17.5,
      pitch: 65,
      bearing: 0,
      style: mapboxStyleId,
      
      // 禁用所有地圖互動 - 改用相機控制
      dragPan: false,
      scrollZoom: false,
      boxZoom: false,
      doubleClickZoom: false,
      keyboard: false,
      dragRotate: false,  // 禁用地圖旋轉
      pitchWithRotate: false,
      
      // 隱藏控制項
      attributionControl: false,
      logoPosition: 'bottom-right'
    });

    // 地圖載入完成
    mapInstance.current.on('load', () => {
      applyCustomMapStyle(mapInstance.current);
      setMapLoaded(true);
      onMapLoad?.(mapInstance.current);
      onMapReady?.();
    });

    // 不再監聽地圖旋轉，改用內部相機控制

    // 同步地圖中心到用戶位置
    if (userLocation) {
      mapInstance.current.easeTo({
        center: [userLocation.lng, userLocation.lat],
        duration: 300
      });
    }

    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, [userLocation, onMapLoad, onMapReady, onBearingChange]);

  // 更新用戶位置時同步地圖
  useEffect(() => {
    if (mapInstance.current && userLocation) {
      mapInstance.current.easeTo({
        center: [userLocation.lng, userLocation.lat],
        zoom: 17.5,
        duration: 300
      });
    }
  }, [userLocation]);

  // 鍵盤控制移動到CameraController中

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {/* Mapbox地圖層 (底層) */}
      <div 
        ref={mapRef} 
        style={{ 
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%', 
          height: '100%',
          zIndex: 1
        }} 
      />
      
      {/* Three.js Canvas層 (上層) */}
      {mapLoaded && (
        <div 
          style={{ 
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%', 
            height: '100%',
            zIndex: 2,
            pointerEvents: 'auto' // 允許3D模型點擊事件
          }}
        >
          <Canvas
            camera={{ 
              position: [0, 15, 25],
              fov: 60,
              near: 0.1,
              far: 1000 
            }}
            style={{ background: 'transparent' }}
            shadows="soft" // 啟用軟陰影以獲得更好的視覺效果
            gl={{ 
              antialias: true,
              alpha: true,
              powerPreference: "high-performance",
              shadowMap: {
                enabled: true,
                type: THREE.PCFSoftShadowMap, // 使用PCF軟陰影
                autoUpdate: true
              }
            }}
          >
            <Scene
              userLocation={userLocation}
              checkpoints={checkpoints}
              converter={converterRef.current}
              onBearingChange={onBearingChange}
              mapInstance={mapInstance}
              onModelsGenerated={handleModelsGenerated}
              onCheckpointClick={onCheckpointClick}
            />
          </Canvas>
        </div>
      )}
    </div>
  );
};

// 自定義地圖樣式
const applyCustomMapStyle = (map) => {
  if (!map.isStyleLoaded()) {
    setTimeout(() => applyCustomMapStyle(map), 100);
    return;
  }

  try {
    // 修改地面顏色
    if (map.getLayer('land')) {
      map.setPaintProperty('land', 'background-color', '#AFFFA0');
    }
    
    // 修改水域顏色
    if (map.getLayer('water')) {
      map.setPaintProperty('water', 'fill-color', '#1A87D6');
    }
    
    // 修改道路顏色
    const layers = map.getStyle().layers;
    layers.forEach(layer => {
      if (layer.id.includes('road') && layer.type === 'line') {
        try {
          map.setPaintProperty(layer.id, 'line-color', '#59A499');
        } catch (e) {
          // 忽略無法修改的圖層
        }
      }
      
      // 隱藏文字標籤
      if (layer.id.includes('label') || layer.id.includes('text')) {
        try {
          map.setLayoutProperty(layer.id, 'visibility', 'none');
        } catch (e) {
          // 忽略無法修改的圖層
        }
      }
    });
  } catch (error) {
    // 忽略地圖樣式錯誤
  }
};

export default InteractiveMapCanvas;