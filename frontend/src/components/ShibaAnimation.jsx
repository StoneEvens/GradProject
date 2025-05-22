import { useRef, useEffect } from "react";
import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

export default function ShibaAnimation() {
  const group = useRef();
  const { scene, animations } = useGLTF("/assets/models/Shiba Inu.glb");
  const mixer = useRef();
  const currentAction = useRef(null); // 追蹤當前動畫 action

  const eatingClip = animations.find(a => a.name.toLowerCase().includes("eating"));
  const idleClip = animations.find(a => a.name.toLowerCase().includes("idle_2"));

  const fadeDuration = 0.4; // 過渡時長

  useEffect(() => {
    if (!scene || !eatingClip || !idleClip) return;

    mixer.current = new THREE.AnimationMixer(scene);

    const playAction = (clip, duration, nextFn) => {
      const nextAction = mixer.current.clipAction(clip);

      // 淡出前一個動畫（若存在）
      if (currentAction.current && currentAction.current !== nextAction) {
        currentAction.current.crossFadeTo(nextAction, fadeDuration, false);
      }

      nextAction.reset().play();
      currentAction.current = nextAction;

      setTimeout(nextFn, duration);
    };

    const playEating = () => {
      playAction(eatingClip, 1800, playIdle); // 吃 1.8 秒
    };

    const playIdle = () => {
      playAction(idleClip, 4000, playEating); // 發呆 4 秒
    };

    playEating(); // 開始播放

    return () => {
      if (mixer.current) mixer.current.stopAllAction();
    };
  }, [scene, eatingClip, idleClip]);

  useFrame((_, delta) => {
    if (mixer.current) {
      mixer.current.update(delta);
    }
  });

  return (
    <primitive
      ref={group}
      object={scene}
      position={[-0.095, 0.05, 1.1]}
      scale={0.15}
      rotation={[0, -Math.PI / 2, 0]}
    />
  );
}
