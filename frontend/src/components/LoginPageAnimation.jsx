import { useRef, useEffect } from "react";
import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useNotification } from '../context/NotificationContext';
import SpeechBubble from './SpeechBubble';

export default function LoginPageAnimation() {
  const group = useRef();
  const { scene, animations } = useGLTF("/assets/models/Shiba Inu.glb");
  const mixer = useRef();
  const { isNotificationVisible } = useNotification();
  const currentActions = useRef({});
  const isReverse = useRef(false);

  const eatingClip = animations.find(a => a.name.toLowerCase().includes("eating"));
  const idleClip = animations.find(a => a.name.toLowerCase().includes("idle_2"));

  useEffect(() => {
    if (!scene || !eatingClip || !idleClip) return;

    mixer.current = new THREE.AnimationMixer(scene);
    
    // 創建動畫動作
    const eatingAction = mixer.current.clipAction(eatingClip);
    const idleAction = mixer.current.clipAction(idleClip);

    // 設置動作的循環模式
    eatingAction.setLoop(THREE.LoopRepeat);
    idleAction.setLoop(THREE.LoopRepeat);

    // 設置吃東西動畫的時間偏移，讓它從吃東西的部分開始
    eatingAction.time = 0.8; // 跳過低頭動作，直接從吃東西開始
    
    // 設置播放速度
    eatingAction.timeScale = 1;

    currentActions.current = { 
      eating: eatingAction,
      idle: idleAction
    };

    // 初始播放吃東西動畫
    eatingAction.play();

    return () => {
      if (mixer.current) mixer.current.stopAllAction();
    };
  }, [scene, eatingClip, idleClip]);

  useEffect(() => {
    if (!mixer.current || !currentActions.current.eating || !currentActions.current.idle) return;

    const { eating, idle } = currentActions.current;
    const transitionDuration = 0.3;

    if (isNotificationVisible) {
      // 切換到idle動畫
      eating.fadeOut(transitionDuration);
      idle.reset().fadeIn(transitionDuration).play();
    } else {
      // 切換回eating動畫
      idle.fadeOut(transitionDuration);
      eating.reset().time = 0.8; // 從吃東西的部分開始
      eating.timeScale = 1; // 重置播放速度為正向
      isReverse.current = false; // 重置方向標記
      eating.fadeIn(transitionDuration).play();
    }
  }, [isNotificationVisible]);

  useFrame((_, delta) => {
    if (mixer.current) {
      mixer.current.update(delta);

      // 如果正在播放eating動畫且不是通知狀態，控制動畫時間
      if (!isNotificationVisible && currentActions.current.eating?.isRunning()) {
        const action = currentActions.current.eating;
        
        // 正向播放
        if (!isReverse.current) {
          if (action.time >= 2.0) { // 到達吃東西結束點
            isReverse.current = true;
            action.timeScale = -1; // 改為反向播放
          }
        }
        // 反向播放
        else {
          if (action.time <= 0.8) { // 回到吃東西起始點
            isReverse.current = false;
            action.timeScale = 1; // 改為正向播放
          }
        }
      }
    }
  });

  return (
    <group>
      <primitive
        ref={group}
        object={scene}
        position={[-0.1, -0.15, 0.35]}
        scale={0.1}
        rotation={[0, Math.PI / 2.05, 0]}
      />
      <SpeechBubble visible={isNotificationVisible} />
    </group>
  );
} 