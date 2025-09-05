import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import InteractiveMapCanvas from '../components/InteractiveMapCanvas';
import { useUser } from '../context/UserContext';
import ConfirmNotification from '../components/ConfirmNotification';
import Notification from '../components/Notification';
import CheckpointInfoArea from '../components/CheckpointInfoArea';
import styles from '../styles/InteractiveCityPage.module.css';
const InteractiveCityPage = () => {
  const navigate = useNavigate();
  const { userHeadshot } = useUser();
  const watchId = useRef(null);
  const [userLocation, setUserLocation] = useState(null);
  const [isTracking, setIsTracking] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [showPermissionPrompt, setShowPermissionPrompt] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [errorNotification, setErrorNotification] = useState(null);
  const [coinBalance, setCoinBalance] = useState(0);
  const [isFullyLoaded, setIsFullyLoaded] = useState(false);
  const [currentLoadingMessage, setCurrentLoadingMessage] = useState('準備中...');
  const [selectedCheckpoint, setSelectedCheckpoint] = useState(null);

  // 請求定位權限
  const requestLocationPermission = () => {
    setCurrentLoadingMessage('正在獲取您的位置...');
    console.log('開始請求位置權限...');
    
    if ('geolocation' in navigator) {
      // 添加手動超時機制
      const timeoutId = setTimeout(() => {
        console.log('手動超時：位置請求超過15秒');
        setErrorNotification('定位請求超時，請檢查您的GPS設定或重試');
        setCurrentLoadingMessage('');
        setShowPermissionPrompt(false);
      }, 15000);
      
      navigator.geolocation.getCurrentPosition(
        (position) => {
          clearTimeout(timeoutId);
          console.log('位置權限獲取成功！', position);
          const lng = position.coords.longitude;
          const lat = position.coords.latitude;
          const accuracy = position.coords.accuracy;
          
          setUserLocation({ lng, lat });
          setCurrentLoadingMessage(`正在初始化地圖... (精確度: ${Math.round(accuracy)}米)`);
          setShowPermissionPrompt(false);
        },
        (error) => {
          clearTimeout(timeoutId);
          console.log('位置權限請求失敗:', error);
          let errorMsg = '無法獲取您的位置';
          
          if (error.code === 1) {
            // 權限被拒絕 - 設置權限被拒絕狀態
            console.log('使用者拒絕了位置權限');
            setPermissionDenied(true);
            setShowPermissionPrompt(false);
            setCurrentLoadingMessage('');
          } else if (error.code === 2) {
            errorMsg = '無法取得位置資訊，請檢查您的網路連線或GPS設定';
            setErrorNotification(errorMsg);
            setShowPermissionPrompt(false);
            setCurrentLoadingMessage('');
          } else if (error.code === 3) {
            errorMsg = '定位請求超時，請重試';
            setErrorNotification(errorMsg);
            setShowPermissionPrompt(false);
            setCurrentLoadingMessage('');
          }
        },
        {
          enableHighAccuracy: false, // 改為 false 以加快速度
          timeout: 10000, // 縮短到10秒
          maximumAge: 300000 // 5分鐘內的快取位置可接受
        }
      );
    } else {
      setErrorNotification('您的瀏覽器不支援定位功能');
      setShowPermissionPrompt(false);
    }
  };

  // 初始化時檢查並請求位置權限
  useEffect(() => {
    // 檢查瀏覽器是否支援地理位置API
    if (!('geolocation' in navigator)) {
      setErrorNotification('您的瀏覽器不支援定位功能');
      return;
    }

    // 檢查是否在安全環境下 (HTTPS 或 localhost)
    const isSecureContext = window.isSecureContext || 
                           location.protocol === 'https:' || 
                           location.hostname === 'localhost' ||
                           location.hostname === '140.119.19.25' ||
                           location.hostname === '127.0.0.1';
    
    if (!isSecureContext) {
      console.warn('非安全環境，位置權限可能無法正常工作');
      setErrorNotification('請使用 HTTPS 連線或在 localhost 環境下使用位置功能');
      return;
    }

    // 簡化邏輯：直接嘗試獲取位置，如果失敗再處理
    const checkPermissionAndProceed = async () => {
      console.log('開始權限檢查流程...');
      
      // 嘗試檢查權限，但如果失敗就忽略
      try {
        if ('permissions' in navigator) {
          const result = await navigator.permissions.query({ name: 'geolocation' });
          console.log('權限狀態:', result.state);
          
          if (result.state === 'granted') {
            console.log('權限已授予，直接獲取位置');
            requestLocationPermission();
            return;
          } else if (result.state === 'denied') {
            console.log('權限已被拒絕');
            setPermissionDenied(true);
            setCurrentLoadingMessage('');
            return;
          }
          // 如果是 'prompt'，就顯示我們的提示
          console.log('需要提示用戶授予權限');
        }
      } catch (error) {
        console.log('權限API不可用，使用預設流程');
      }

      // 顯示權限請求提示
      setShowPermissionPrompt(true);
      setCurrentLoadingMessage('');
    };

    checkPermissionAndProceed();
  }, []);

  // 處理地圖載入
  const handleMapLoad = useCallback((mapInstance) => {
    setMapLoaded(true);
    setCurrentLoadingMessage('正在設置GPS追蹤...');
  }, []);

  // 簡化的GPS追蹤
  const startGPSTracking = useCallback(() => {
    if (watchId.current || !userLocation) {
      return;
    }

    setIsTracking(true);
    
    // 完成載入
    setCurrentLoadingMessage('載入完成！');
    setTimeout(() => {
      setIsFullyLoaded(true);
    }, 500);

    // 持續追蹤位置
    watchId.current = navigator.geolocation.watchPosition(
      (position) => {
        const lng = position.coords.longitude;
        const lat = position.coords.latitude;
        
        setUserLocation({ lng, lat });
      },
      (error) => {
        console.warn('位置更新失敗:', error);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 1000,
        timeout: 10000
      }
    );
  }, [userLocation]);

  // 處理地圖準備完成
  const handleMapReady = useCallback(() => {
    startGPSTracking();
  }, [startGPSTracking]);

  // 組件卸載時清理
  useEffect(() => {
    return () => {
      if (watchId.current) {
        navigator.geolocation.clearWatch(watchId.current);
      }
    };
  }, []);

  // 處理權限確認
  const handlePermissionConfirm = () => {
    console.log('使用者點擊確認，準備請求位置權限');
    setShowPermissionPrompt(false);
    setCurrentLoadingMessage('正在請求位置權限...');
    
    // 稍微延遲一下，確保UI更新完成
    setTimeout(() => {
      requestLocationPermission();
    }, 100);
  };

  // 處理被拒絕權限後的重新請求
  const handlePermissionRetry = () => {
    console.log('重新請求位置權限');
    setPermissionDenied(false);
    setCurrentLoadingMessage('正在請求位置權限...');
    
    // 稍微延遲一下，確保UI更新完成
    setTimeout(() => {
      requestLocationPermission();
    }, 100);
  };

  // 處理權限拒絕
  const handlePermissionCancel = () => {
    setShowPermissionPrompt(false);
    setCurrentLoadingMessage('');
    setErrorNotification('需要定位權限才能使用互動城市功能');
  };

  // 處理站點點擊
  const handleCheckpointClick = (checkpoint) => {
    // 使用模擬數據測試
    const mockCheckpoint = {
      id: 1,
      name: '景美溪二號站點',
      ownerName: '小明',
      description: '這是文山區景美溪步行路線的第二號站點，風景優美，適合散步和拍照。',
      imageUrl: '/assets/icon/MockCheckpointHeadshot.jpg',
      ownerAvatar: '/assets/icon/MockCheckpointHeadshot.jpg'
    };
    setSelectedCheckpoint(mockCheckpoint);
  };

  // 處理關閉站點資訊
  const handleCloseCheckpoint = () => {
    setSelectedCheckpoint(null);
  };

  // 處理進入站點
  const handleEnterCheckpoint = () => {
    if (selectedCheckpoint) {
      console.log('進入站點:', selectedCheckpoint);
      navigate(`/checkpoint/${selectedCheckpoint.id}`);
    }
  };

  return (
    <div className={styles.container}>
      {/* 定位權限提示 */}
      {showPermissionPrompt && (
        <ConfirmNotification
          message="互動城市需要存取您的位置資訊，以顯示您在地圖上的位置並與附近的站點互動。點擊「確認」後，瀏覽器將詢問位置權限。"
          onConfirm={handlePermissionConfirm}
          onCancel={handlePermissionCancel}
        />
      )}

      {/* 權限被拒絕後的提示 */}
      {permissionDenied && !showPermissionPrompt && (
        <ConfirmNotification
          message="位置權限被拒絕。請點擊「確認」重新請求位置權限，或點擊「取消」返回主頁面。如果瀏覽器已永久拒絕權限，請手動在瀏覽器設定中允許位置存取權限。"
          onConfirm={handlePermissionRetry}
          onCancel={() => navigate('/main')}
        />
      )}
      
      {/* 錯誤通知 */}
      {errorNotification && !showPermissionPrompt && !permissionDenied && (
        <Notification
          message={errorNotification}
          onClose={() => setErrorNotification(null)}
        />
      )}
      
      {/* 統一的地圖與3D場景容器 */}
      <div className={styles.mapContainer}>
        {userLocation && (
          <InteractiveMapCanvas
            userLocation={userLocation}
            checkpoints={[]}
            onMapLoad={handleMapLoad}
            onMapReady={handleMapReady}
            onCheckpointClick={handleCheckpointClick}
          />
        )}
      </div>
      
      {/* 載入畫面覆蓋層 - 只有在有載入訊息且沒有顯示權限提示時才顯示 */}
      {!isFullyLoaded && !showPermissionPrompt && !permissionDenied && currentLoadingMessage && (
        <div className={styles.loadingScreen}>
          <div className={styles.loadingContent}>
            <div className={styles.spinner}></div>
            <p className={styles.loadingText}>正在載入互動城市</p>
            <p className={styles.debugMessage}>{currentLoadingMessage}</p>
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
      
      {/* 使用者頭像與金幣餘額區域 */}
      <div className={styles.userInfoSection}>
        {/* 金幣餘額顯示 */}
        <div className={styles.coinBalance}>
          <img src="/assets/icon/CoinsIcon.png" alt="金幣" className={styles.coinIcon} />
          <span className={styles.coinAmount}>{coinBalance}</span>
        </div>
        
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
      
      {/* 功能按鈕區域 */}
      <div className={styles.actionButtons}>
        {/* 任務按鈕 */}
        <button 
          className={styles.actionButton}
          onClick={() => console.log('任務按鈕被點擊')}
          title="任務"
        >
          <img 
            src="/assets/icon/MissionIcon.png" 
            alt="任務" 
            className={styles.actionIcon}
          />
        </button>
        
        {/* 路線按鈕 */}
        <button 
          className={styles.actionButton}
          onClick={() => console.log('路線按鈕被點擊')}
          title="路線"
        >
          <img 
            src="/assets/icon/RouteIcon.png" 
            alt="路線" 
            className={styles.actionIcon}
          />
        </button>
        
        {/* 競標按鈕 */}
        <button 
          className={styles.actionButton}
          onClick={() => console.log('競標按鈕被點擊')}
          title="競標"
        >
          <img 
            src="/assets/icon/Auctionicon.png" 
            alt="競標" 
            className={styles.actionIcon}
          />
        </button>
      </div>

      {/* 站點資訊區域 */}
      {selectedCheckpoint && (
        <CheckpointInfoArea
          checkpoint={selectedCheckpoint}
          onClose={handleCloseCheckpoint}
          onEnter={handleEnterCheckpoint}
        />
      )}

    </div>
  );
};

export default InteractiveCityPage;