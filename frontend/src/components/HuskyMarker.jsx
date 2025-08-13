import mapboxgl from 'mapbox-gl';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';

// 3D 哈士奇標記類別 (Mapbox GL JS 版本)
class HuskyMarker {
  constructor(map, coordinates) {
    this.map = map; // 保存 Mapbox 地圖引用
    this.coordinates = coordinates;
    this.scene = new THREE.Scene();
    this.renderer = new THREE.WebGLRenderer({ 
      alpha: true, 
      antialias: true,
      preserveDrawingBuffer: true 
    });
    this.model = null;
    this.mixer = null;
    this.isAnimating = false;
    this.animations = {}; // 存儲不同動畫
    this.currentAction = null; // 當前播放的動畫
    this.currentState = 'Idle'; // 當前狀態 ('Idle' | 'Walk')
    this.mapBearing = 0; // 地圖旋轉角度
    this.movingHeading = null; // 移動方向
    
    // 設定渲染器，放大 canvas 範圍
    const size = 100; 
    this.renderer.setSize(size, size);
    this.renderer.setClearColor(0x000000, 0); // 完全透明背景
    this.renderer.domElement.style.pointerEvents = 'none';
    // this.renderer.domElement.style.border = '1px solid rgba(0,123,191,0.3)'; // 調試用邊框
    
    // 使用透視相機，設定65度視野角
    this.camera = new THREE.PerspectiveCamera(65, 1, 0.1, 1000);
    
    // 調整相機位置，從低角度往上看，模擬地面視角
    this.camera.position.set(0, 2.3, 3);
    this.camera.lookAt(0, -0.5, 0); // 看向模型的下半部
    
    // 進一步增強光源強度
    const ambientLight = new THREE.AmbientLight(0xffffff, 2.5); // 進一步提高環境光
    this.scene.add(ambientLight);
    
    // 主光源 - 從更遠的距離照射
    const directionalLight = new THREE.DirectionalLight(0xffffff, 4.5); // 進一步提高強度
    directionalLight.position.set(0, 10, 8); // 拉遠位置
    directionalLight.castShadow = false;
    this.scene.add(directionalLight);
    
    // 側面補光
    const sideLight = new THREE.DirectionalLight(0xffffff, 0.9); // 提高側面光強度
    sideLight.position.set(5, 5, 0); // 從側面照射
    this.scene.add(sideLight);
    
    // 底部填光，減少陰影
    const bottomLight = new THREE.DirectionalLight(0xffffff, 1.0); // 進一步提高強度
    bottomLight.position.set(0, -5, 3); // 拉遠位置
    this.scene.add(bottomLight);
    
    // 創建 Mapbox 標記
    this.createMapboxMarker(coordinates);
    
    // 在模型載入後才顯示標記
    this.loadModel();
  }
  
  createMapboxMarker(coordinates) {
    // 創建 Mapbox 標記
    this.marker = new mapboxgl.Marker({
      element: this.renderer.domElement,
      anchor: 'center'
    }).setLngLat([coordinates.lng, coordinates.lat]); // Mapbox 使用 [lng, lat] 格式
  }

  async loadModel() {
    // 確保 map 和 renderer 都存在
    if (!this.map || !this.renderer || !this.renderer.domElement) {
      console.error('地圖或渲染器尚未初始化');
      return;
    }
    
    const loader = new GLTFLoader();
    
    try {
      const gltf = await new Promise((resolve, reject) => {
        loader.load(
          '/assets/models/Husky.glb',
          (gltf) => {
            resolve(gltf);
          },
          (progress) => {
            // 載入進度
          },
          (error) => {
            console.error('模型載入錯誤:', error);
            reject(error);
          }
        );
      });
      
      // 移除之前的模型（如果有）
      if (this.model) {
        this.scene.remove(this.model);
      }
      
      this.model = gltf.scene;
      
      // 調整模型大小和位置，放大模型
      this.model.scale.set(0.6, 0.6, 0.6); 
      this.model.position.set(0, -1, 0); // 將模型下移，讓它看起來站在地面上
      
      this.scene.add(this.model);
      
      // 設定動畫
      if (gltf.animations && gltf.animations.length > 0) {
        this.mixer = new THREE.AnimationMixer(this.model);
        
        // 只載入精確名稱為 'Idle' 和 'Walk' 的動畫
        let idleFound = false;
        let walkFound = false;
        
        gltf.animations.forEach((clip, index) => {
          const name = clip.name.toLowerCase();
          
          // 只接受精確名稱為 'Idle' 的動畫
          if (!idleFound && clip.name === 'Idle') {
            const action = this.mixer.clipAction(clip);
            this.animations.Idle = action;
            idleFound = true;
          }
          // 只接受精確名稱為 'Walk' 的動畫
          else if (!walkFound && clip.name === 'Walk') {
            const action = this.mixer.clipAction(clip);
            this.animations.Walk = action;
            walkFound = true;
          }
        });
        
        // 設定動畫播放模式
        if (this.animations.Idle) {
          this.animations.Idle.setLoop(THREE.LoopRepeat);
          this.animations.Idle.clampWhenFinished = false;
        }
        if (this.animations.Walk) {
          this.animations.Walk.setLoop(THREE.LoopRepeat);
          this.animations.Walk.clampWhenFinished = false;
        }
        
        // 只有當 Idle 動畫存在時才播放
        if (this.animations.Idle) {
          this.playAnimation('Idle');
        }
      }
      
      // 模型載入完成後將標記添加到地圖
      if (this.marker && this.map) {
        try {
          this.marker.addTo(this.map);
        } catch (error) {
          console.error('無法將標記添加到地圖:', error);
        }
      }
      
      this.startAnimation();
      
    } catch (error) {
      console.error('載入柴犬模型失敗:', error);
      
      // 模型載入失敗時使用替代標記
      this.createFallbackMarker();
      
      // 顯示替代標記
      if (this.marker && this.map) {
        try {
          this.marker.addTo(this.map);
        } catch (err) {
          console.error('無法添加替代標記到地圖:', err);
        }
      }
      
      this.startAnimation();
    }
  }
  
  createFallbackMarker() {
    const geometry = new THREE.BoxGeometry(1.8, 1.8, 1.8); // 從 1.2 放大到 1.8
    const material = new THREE.MeshLambertMaterial({ 
      color: 0x007cbf,
      transparent: false
    });
    this.model = new THREE.Mesh(geometry, material);
    this.model.position.set(0, -0.7, 0); // 調整位置以配合放大的尺寸
    this.scene.add(this.model);
    this.startAnimation();
  }
  
  startAnimation() {
    if (!this.isAnimating) {
      this.isAnimating = true;
      this.animate();
    }
  }
  
  animate() {
    if (!this.isAnimating) return;
    
    // 只更新動畫混合器，不做任何手動旋轉
    if (this.mixer) {
      this.mixer.update(0.016); // ~60fps
    }
    
    // 移除所有手動旋轉效果，只依賴動畫和 GPS 方向
    
    try {
      this.renderer.render(this.scene, this.camera);
    } catch (error) {
      console.error('渲染錯誤:', error);
    }
    
    requestAnimationFrame(() => this.animate());
  }
  
  updatePosition(coordinates) {
    this.coordinates = coordinates;
    if (this.marker) {
      this.marker.setLngLat([coordinates.lng, coordinates.lat]); // Mapbox 使用 [lng, lat] 格式
    }
  }
  
  updateRotation(heading) {
    // 儲存移動方向，但不直接應用到模型（由 updateMapRotation 統一處理）
    this.movingHeading = heading;
    this.updateModelRotation();
  }
  
  // 讓哈士奇跟著地圖旋轉 (Mapbox 版本)
  updateMapRotation(bearing) {
    console.log('HuskyMarker 接收到旋轉更新:', bearing);
    this.mapBearing = bearing || 0;
    this.updateModelRotation();
  }
  
  // 統一處理模型旋轉（結合地圖旋轉和移動方向）
  updateModelRotation() {
    if (!this.model) {
      console.log('模型不存在，無法旋轉');
      return;
    }
    
    // 修正旋轉方向，讓哈士奇與地圖旋轉方向一致
    const mapRotation = (this.mapBearing || 0) * Math.PI / 180;
    console.log('計算模型旋轉:', this.mapBearing, '度 =', mapRotation, '弧度');
    
    // 如果有移動方向，優先使用移動方向；否則跟隨地圖旋轉
    if (this.movingHeading !== null && this.movingHeading !== undefined) {
      // 移動方向相對於地圖旋轉的角度
      const movingRotation = ((this.movingHeading || 0) * Math.PI / 180) + Math.PI + mapRotation;
      this.model.rotation.y = movingRotation;
      console.log('使用移動方向旋轉:', movingRotation);
    } else {
      // 沒有移動時，跟隨地圖旋轉
      this.model.rotation.y = mapRotation;
      console.log('使用地圖旋轉:', mapRotation);
    }
  }
  
  // 播放指定動畫（只允許 Idle 和 Walk）
  playAnimation(state) {
    if (!this.mixer || !this.animations) return;
    
    // 嚴格限制只能播放 Idle 或 Walk
    if (state !== 'Idle' && state !== 'Walk') {
      return;
    }
    
    const targetAction = this.animations[state];
    if (!targetAction) {
      return;
    }
    
    // 如果已經在播放相同動畫，直接返回
    if (this.currentAction === targetAction && targetAction.isRunning()) {
      return;
    }
    
    // 停止當前動畫
    if (this.currentAction && this.currentAction.isRunning()) {
      this.currentAction.fadeOut(0.5);
    }
    
    // 開始新動畫
    targetAction.reset();
    targetAction.fadeIn(0.5);
    targetAction.play();
    
    this.currentAction = targetAction;
    this.currentState = state;
  }
  
  // 設定移動狀態並切換動畫（嚴格限制）
  setMovementState(isMoving) {
    const newState = isMoving ? 'Walk' : 'Idle';
    
    if (newState !== this.currentState) {
      this.playAnimation(newState);
    }
  }
  
  remove() {
    this.isAnimating = false;
    if (this.marker) {
      this.marker.remove();
    }
    if (this.renderer) {
      this.renderer.dispose();
    }
  }
}

export default HuskyMarker;