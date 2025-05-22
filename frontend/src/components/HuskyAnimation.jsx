import { useRef, useEffect, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";

export default function HuskyAnimation() {
  const group = useRef();
  const targetQuaternion = useRef(new THREE.Quaternion()); // 🔄 用來做轉向慣性

  const { scene, animations } = useGLTF("/assets/models/Husky.glb");
  const mixer = useRef();

  const [state, setState] = useState("walkOut"); // walkOut, idle1, walkBack, idle2
  const [t, setT] = useState(0);
  const [direction, setDirection] = useState(1);
  const [interrupted, setInterrupted] = useState(false);

  const walkClip = animations.find(a => a.name.toLowerCase().includes("walk"));
  const idle1Clip = animations.find(a => a.name.toLowerCase().includes("idle_2"));
  const idle2Clip = animations.find(a => a.name.toLowerCase().includes("idle_2_headlow"));
  const hitLeftClip = animations.find(a => a.name.toLowerCase().includes("hitreact_left"));
  const hitRightClip = animations.find(a => a.name.toLowerCase().includes("hitreact_right"));

  const start = new THREE.Vector3(0.9, 0.05, -0.45);
  const end = new THREE.Vector3(-0.75, 0.05, -0.9);
  const control = new THREE.Vector3(0.3, 0.05, -1.2);

  const duration = 4;

  useEffect(() => {
    mixer.current = new THREE.AnimationMixer(scene);
    if (walkClip) mixer.current.clipAction(walkClip).play();
  }, [scene]);

  useFrame((_, delta) => {
    if (!group.current || !mixer.current) return;
    mixer.current.update(delta);
    if (interrupted) return;

    if (state === "walkOut" || state === "walkBack") {
      const newT = Math.min(t + delta / duration, 1);
      setT(newT);

      const curve = new THREE.QuadraticBezierCurve3(
        direction === 1 ? start : end,
        control,
        direction === 1 ? end : start
      );

      const currentPos = curve.getPoint(newT);
      const nextPos = curve.getPoint(Math.min(newT + 0.01, 1));
      group.current.position.copy(currentPos);

      // 🔄 更自然的轉向：兩層 quaternion slerp 緩衝
      const look = new THREE.Object3D();
      look.position.copy(currentPos);
      look.lookAt(nextPos);

      // 慢慢更新目標方向
      targetQuaternion.current.slerp(look.quaternion, 0.1);
      // 模型再慢慢轉向這個方向
      group.current.quaternion.slerp(targetQuaternion.current, 0.02);

      if (newT >= 1) {
        setT(0);
        mixer.current.stopAllAction();

        if (direction === 1) {
          mixer.current.clipAction(idle1Clip).reset().play();
          setState("idle1");
          setTimeout(() => {
            if (!interrupted) {
              mixer.current.stopAllAction();
              mixer.current.clipAction(walkClip).play();
              setDirection(-1);
              setState("walkBack");
            }
          }, 5000);
        } else {
          mixer.current.clipAction(idle2Clip).reset().play();
          setState("idle2");
          setTimeout(() => {
            if (!interrupted) {
              mixer.current.stopAllAction();
              mixer.current.clipAction(walkClip).play();
              setDirection(1);
              setState("walkOut");
            }
          }, 5000);
        }
      }
    }
  });

  // 🐾 點擊播放 HitReact
  const handleClick = () => {
    const clip = direction === 1 ? hitLeftClip : hitRightClip;
    if (!clip || !mixer.current || interrupted) return;

    setInterrupted(true);
    mixer.current.stopAllAction();

    const action = mixer.current.clipAction(clip);
    action.reset().play();

    setTimeout(() => {
      action.stop();
      setInterrupted(false);

      // 回到原本狀態
      if (state.startsWith("walk")) {
        mixer.current.clipAction(walkClip).play();
      } else if (state === "idle1") {
        mixer.current.clipAction(idle1Clip).play();
      } else if (state === "idle2") {
        mixer.current.clipAction(idle2Clip).play();
      }
    }, 500); // 動畫長度
  };

  return (
    <primitive
      ref={group}
      object={scene}
      scale={0.12}
      position={start.toArray()}
      rotation={[0, -Math.PI / 1.25, 0]}
      onClick={handleClick}
    />
  );
}

