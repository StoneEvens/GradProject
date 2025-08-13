import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import HuskyMarker from '../components/HuskyMarker';
import { useUser } from '../context/UserContext';
import styles from '../styles/InteractiveCityPage.module.css';

// 設定 Mapbox 配置
const mapboxToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;
const mapboxStyleId = import.meta.env.VITE_MAPBOX_STYLE_ID || 'mapbox://styles/mapbox/streets-v12';
mapboxgl.accessToken = mapboxToken;

console.log('使用 Mapbox GL JS');
console.log('樣式ID:', mapboxStyleId);
if (!mapboxToken) {
  console.error('Mapbox Access Token 未設置！請在.env文件中設置VITE_MAPBOX_ACCESS_TOKEN');
} else {
  console.log('Mapbox 配置已設置');
}

// 計算兩點間距離 (米)
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000; // 地球半徑 (米)
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c; // 距離 (米)
}

// Mapbox 地圖組件
const MapboxComponent = ({ userLocation, onMapLoad, onMapReady, onBearingChange }) => {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);

  useEffect(() => {
    if (mapRef.current && userLocation && !mapInstance.current) {
      // 創建 Mapbox Map 實例
      mapInstance.current = new mapboxgl.Map({
        container: mapRef.current,
        center: [userLocation.lng, userLocation.lat],
        zoom: 17, // 固定zoom為20 - 更近的視角
        pitch: 65, // 65度傾斜角
        bearing: 0,
        style: mapboxStyleId, // 從環境變數讀取樣式ID
        hash: false,
        // 限制地圖互動 - 只允許旋轉，優化效能
        dragPan: false,        // 禁用拖拽平移
        scrollZoom: false,     // 禁用滾輪縮放
        boxZoom: false,        // 禁用框選縮放
        doubleClickZoom: false, // 禁用雙擊縮放
        keyboard: false,       // 禁用鍵盤控制
        dragRotate: true,      // 允許拖拽旋轉
        pitchWithRotate: false, // 禁用旋轉時改變傾斜角
        touchZoomRotate: {     // 觸控設定
          around: 'center'     // 繞中心旋轉
        },
        // 效能優化設定
        antialias: true,       // 抗鋸齒
        attributionControl: false, // 移除版權資訊控制
        logoPosition: 'bottom-right', // Mapbox logo位置
        refreshExpiredTiles: false, // 不自動重新載入過期tiles
        renderWorldCopies: false,   // 不渲染世界副本
        maxTileCacheSize: 50       // 限制tile快取大小
      });

      // 地圖載入完成事件
      mapInstance.current.on('load', () => {
        console.log('Mapbox 地圖載入完成');
        
        // 如果使用預設樣式，則應用自定義修改
        if (mapboxStyleId.includes('mapbox://styles/mapbox/')) {
          console.log('應用自定義樣式修改到預設樣式');
          applyCustomStyle(mapInstance.current);
        } else {
          console.log('使用自定義樣式:', mapboxStyleId);
        }
        
        onMapLoad(mapInstance.current);
        onMapReady();
      });

      // 監聽地圖旋轉事件 - 讓哈士奇跟著轉動
      mapInstance.current.on('rotate', () => {
        const currentBearing = mapInstance.current.getBearing();
        console.log('地圖旋轉事件觸發，bearing:', currentBearing);
        if (onBearingChange) {
          onBearingChange(currentBearing);
        }
      });


      // 移除導航控制按鈕 - 已註解掉
      // mapInstance.current.addControl(new mapboxgl.NavigationControl(), 'top-right');
    }
  }, [userLocation, onMapLoad, onMapReady, onBearingChange]);

  return <div ref={mapRef} style={{ width: '100%', height: '100%' }} />;
};

// 應用自定義樣式到 Mapbox 地圖
const applyCustomStyle = (map) => {
  // 等待樣式完全載入後再修改
  if (map.isStyleLoaded()) {
    // 修改背景顏色
    map.setPaintProperty('land', 'background-color', '#AFFFA0');
    
    // 修改水域顏色
    if (map.getLayer('water')) {
      map.setPaintProperty('water', 'fill-color', '#1A87D6');
    }
    
    // 修改道路顏色
    const roadLayers = map.getStyle().layers.filter(layer => 
      layer.id.includes('road') || layer.id.includes('street')
    );
    
    roadLayers.forEach(layer => {
      if (layer.type === 'line') {
        try {
          map.setPaintProperty(layer.id, 'line-color', '#59A499');
        } catch (e) {
          console.log('無法修改圖層:', layer.id);
        }
      }
    });

    // 隱藏標籤
    const labelLayers = map.getStyle().layers.filter(layer => 
      layer.id.includes('label') || layer.id.includes('text')
    );
    
    labelLayers.forEach(layer => {
      try {
        map.setLayoutProperty(layer.id, 'visibility', 'none');
      } catch (e) {
        console.log('無法隱藏標籤:', layer.id);
      }
    });
  } else {
    // 如果樣式還沒載入完成，等待一下再試
    setTimeout(() => applyCustomStyle(map), 100);
  }
};

const InteractiveCityPage = () => {
  const navigate = useNavigate();
  const { userHeadshot } = useUser();
  const map = useRef(null);
  const watchId = useRef(null);
  const huskyMarker = useRef(null);
  const [userLocation, setUserLocation] = useState(null);
  const [isTracking, setIsTracking] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [locationError, setLocationError] = useState(null);
  const [isMoving, setIsMoving] = useState(false);
  const [heading, setHeading] = useState(null);
  const [mapBearing, setMapBearing] = useState(0);
  
  // 載入狀態管理
  const [isFullyLoaded, setIsFullyLoaded] = useState(false);
  const [loadingSteps, setLoadingSteps] = useState({
    gettingLocation: false,
    initializingMap: false,
    loadingMapStyle: false,
    settingUpGPS: false
  });
  const [currentLoadingMessage, setCurrentLoadingMessage] = useState('準備中...');

  // 簡化的定位獲取
  useEffect(() => {
    setCurrentLoadingMessage('正在獲取您的位置...');
    
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lng = position.coords.longitude;
          const lat = position.coords.latitude;
          const accuracy = position.coords.accuracy;
          console.log('定位成功:', lng, lat, '精確度:', accuracy + '米');
          console.log('定位來源:', position.coords.accuracy < 100 ? 'GPS' : 'WiFi/IP估算');
          
          setUserLocation({ lng, lat });
          setLoadingSteps(prev => ({ ...prev, gettingLocation: true }));
          setCurrentLoadingMessage(`正在初始化地圖... (精確度: ${Math.round(accuracy)}米)`);
        },
        (error) => {
          console.error('定位錯誤:', error.code, error.message);
          let errorMsg = '無法獲取您的位置';
          
          if (error.code === 1) {
            errorMsg = '請允許瀏覽器存取您的位置';
          } else if (error.code === 2) {
            errorMsg = '無法取得位置資訊';
          } else if (error.code === 3) {
            errorMsg = '定位請求超時';
          }
          
          setLocationError(errorMsg);
          setCurrentLoadingMessage(errorMsg);
        },
        {
          enableHighAccuracy: true,
          timeout: 60000,
          maximumAge: 0
        }
      );
    } else {
      setLocationError('您的瀏覽器不支援定位功能');
    }
  }, []);

  // 處理地圖載入
  const handleMapLoad = useCallback((mapInstance) => {
    map.current = mapInstance;
    console.log('Mapbox 載入完成');
    setMapLoaded(true);
    setLoadingSteps(prev => ({ ...prev, initializingMap: true, loadingMapStyle: true }));
    setCurrentLoadingMessage('正在設置GPS追蹤...');
  }, []);

  // 簡化的GPS追蹤 - 提前定義
  const startGPSTracking = useCallback(() => {
    if (watchId.current) {
      console.log('GPS追蹤已啟動');
      return;
    }

    console.log('開始GPS追蹤');
    setIsTracking(true);

    // 創建哈士奇標記（Mapbox版本）
    if (userLocation && map.current && !huskyMarker.current) {
      console.log('創建哈士奇標記');
      try {
        huskyMarker.current = new HuskyMarker(map.current, userLocation);
      } catch (error) {
        console.error('創建哈士奇標記失敗:', error);
      }
      
      // 完成載入
      setLoadingSteps(prev => ({ ...prev, settingUpGPS: true }));
      setCurrentLoadingMessage('載入完成！');
      setTimeout(() => {
        setIsFullyLoaded(true);
      }, 500);
    }

    // 持續追蹤位置
    watchId.current = navigator.geolocation.watchPosition(
      (position) => {
        const lng = position.coords.longitude;
        const lat = position.coords.latitude;
        const accuracy = position.coords.accuracy;
        
        console.log('位置更新:', lng, lat, '精確度:', accuracy + '米');
        
        // 如果精確度太差(超過500米)，顯示警告但仍然更新
        if (accuracy > 500) {
          console.warn('定位精確度較差:', accuracy + '米，建議使用手機測試');
        }
        
        setUserLocation({ lng, lat });
        
        // 更新地圖中心和哈士奇標記位置
        if (map.current && isTracking) {
          // 固定zoom為17，只更新中心點 - 減少動畫時間避免卡頓
          map.current.easeTo({
            center: [lng, lat],
            zoom: 17, // 強制保持zoom為17
            duration: 300 // 減少動畫時間到0.3秒，減少卡頓
          });
          
          // 更新哈士奇標記位置
          if (huskyMarker.current) {
            huskyMarker.current.updatePosition({ lat, lng });
          }
        }
      },
      (error) => {
        console.error('位置更新失敗:', error);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 1000,
        timeout: 10000
      }
    );
  }, [userLocation, isTracking]);

  // 處理地圖準備完成
  const handleMapReady = useCallback(() => {
    console.log('地圖準備完成，開始GPS追蹤');
    startGPSTracking();
  }, [startGPSTracking]);

  // 處理地圖bearing變化
  const handleBearingChange = useCallback((bearing) => {
    setMapBearing(bearing);
  }, []);



  // 停止GPS追蹤
  const stopGPSTracking = () => {
    if (watchId.current) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
    setIsTracking(false);
  };

  

  // 監聽地圖bearing變化，更新哈士奇旋轉
  useEffect(() => {
    if (huskyMarker.current && mapBearing !== null) {
      console.log('更新哈士奇旋轉，mapBearing:', mapBearing);
      huskyMarker.current.updateMapRotation(mapBearing);
    }
  }, [mapBearing]);

  // 設置鍵盤控制 - 簡化版本
  useEffect(() => {
    const keydownHandler = (e) => {
      if (!map.current) return;
      
      const currentBearing = map.current.getBearing();
      const rotationStep = 10; // 恢復到10度步進
      
      switch(e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          map.current.setBearing(currentBearing - rotationStep);
          break;
        case 'ArrowRight':
          e.preventDefault();
          map.current.setBearing(currentBearing + rotationStep);
          break;
        case 'ArrowUp':
        case 'ArrowDown':
          e.preventDefault();
          break;
      }
    };

    // 添加鍵盤事件監聽器
    document.addEventListener('keydown', keydownHandler);

    return () => {
      // 移除鍵盤事件監聽器
      document.removeEventListener('keydown', keydownHandler);
    };
  }, []);

  // 組件卸載時清理
  useEffect(() => {
    return () => {
      if (watchId.current) {
        navigator.geolocation.clearWatch(watchId.current);
      }
      if (huskyMarker.current) {
        huskyMarker.current.remove();
      }
    };
  }, []);

  // Mapbox 狀態處理完成

  return (
    <div className={styles.container}>
      {/* Mapbox 地圖容器 */}
      <div className={styles.mapContainer}>
        {userLocation && (
          <MapboxComponent
            userLocation={userLocation}
            onMapLoad={handleMapLoad}
            onMapReady={handleMapReady}
            onBearingChange={handleBearingChange}
          />
        )}
      </div>
      
      {/* 載入畫面覆蓋層 */}
      {!isFullyLoaded && (
        <div className={styles.loadingScreen}>
          <div className={styles.loadingContent}>
            <div className={styles.spinner}></div>
            <p className={styles.loadingText}>正在載入互動城市</p>
            <p className={styles.debugMessage}>{currentLoadingMessage}</p>
            
            {locationError && (
              <div className={styles.errorMessage}>
                <p>{locationError}</p>
                <button 
                  className={styles.retryButton}
                  onClick={() => window.location.reload()}
                >
                  重新載入
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* 返回按鈕 */}
      <button 
        className={styles.backButton}
        onClick={() => navigate('/main')}
        title="返回主頁"
      >
        ❮
      </button>
      
      {/* 使用者頭像按鈕 */}
      <button 
        className={styles.avatarButton}
        title="使用者頭像"
      >
        <img 
          src={userHeadshot}
          alt="使用者頭像"
          className={styles.avatarImage}
        />
      </button>
    </div>
  );
};

export default InteractiveCityPage;