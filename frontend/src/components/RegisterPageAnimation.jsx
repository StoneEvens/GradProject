import { useRef, useEffect } from "react";
import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useNotification } from '../context/NotificationContext';
import SpeechBubble from './SpeechBubble';

export default function RegisterPageAnimation() {
  const group = useRef();
  const { scene, animations } = useGLTF("/assets/models/Husky.glb");
  const mixer = useRef();
  const { isNotificationVisible } = useNotification();
  const currentActions = useRef({});

  const gallopClip = animations.find(a => a.name.toLowerCase().includes("gallop"));
  const walkClip = animations.find(a => a.name.toLowerCase().includes("walk"));

  useEffect(() => {
    if (!scene || !gallopClip || !walkClip) return;

    mixer.current = new THREE.AnimationMixer(scene);
    const gallopAction = mixer.current.clipAction(gallopClip);
    const walkAction = mixer.current.clipAction(walkClip);

    // 設置動作的循環模式和時間比例
    gallopAction.setLoop(THREE.LoopRepeat);
    walkAction.setLoop(THREE.LoopRepeat);
    gallopAction.timeScale = 1.2;
    walkAction.timeScale = 1.0;

    currentActions.current = { gallopAction, walkAction };

    // 初始播放 gallop 動畫
    gallopAction.play();

    return () => {
      if (mixer.current) mixer.current.stopAllAction();
    };
  }, [scene, gallopClip, walkClip]);

  useEffect(() => {
    if (!mixer.current || !currentActions.current.gallopAction || !currentActions.current.walkAction) return;

    const { gallopAction, walkAction } = currentActions.current;
    const transitionDuration = 1.2; // 過渡時間

    if (isNotificationVisible) {
      // 從 gallop 過渡到 walk
      gallopAction.crossFadeTo(walkAction, transitionDuration, true);
      walkAction.reset().play();
      walkAction.setEffectiveTimeScale(0.8); // 稍微放慢 walk 動畫
    } else {
      // 從 walk 過渡到 gallop
      walkAction.crossFadeTo(gallopAction, transitionDuration, true);
      gallopAction.reset().play();
      gallopAction.setEffectiveTimeScale(1.2); // 稍微加快 gallop 動畫
    }
  }, [isNotificationVisible]);

  useFrame((_, delta) => {
    if (mixer.current) {
      mixer.current.update(delta);
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