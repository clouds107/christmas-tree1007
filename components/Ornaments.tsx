import React, { useMemo, useRef, useLayoutEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { TreeMode } from '../types';

interface OrnamentsProps {
  mode: TreeMode;
  count: number;
}

type OrnamentType = 'ball' | 'gift' | 'light';

interface InstanceData {
  chaosPos: THREE.Vector3;
  targetPos: THREE.Vector3;
  type: OrnamentType;
  color: THREE.Color;
  scale: number;
  speed: number;
  rotationOffset: THREE.Euler;
}

export const Ornaments: React.FC<OrnamentsProps> = ({ mode, count }) => {
  // 1. 明确 Ref 类型，允许为 null 以匹配 React 的初始状态
  const ballsRef = useRef<THREE.InstancedMesh>(null);
  const giftsRef = useRef<THREE.InstancedMesh>(null);
  const lightsRef = useRef<THREE.InstancedMesh>(null);
  
  const dummy = useMemo(() => new THREE.Object3D(), []);

  // 2. 静态数据生成逻辑
  const { ballsData, giftsData, lightsData } = useMemo(() => {
    const _balls: InstanceData[] = [];
    const _gifts: InstanceData[] = [];
    const _lights: InstanceData[] = [];

    const height = 11;
    const maxRadius = 4.5;
    
    const palette = [
      new THREE.Color("#D4AF37"), // Gold
      new THREE.Color("#8B0000"), // Red
      new THREE.Color("#F5E6BF")  // White Gold
    ];

    for (let i = 0; i < count; i++) {
      const rnd = Math.random();
      let type: OrnamentType = 'ball';
      if (rnd > 0.8) type = 'gift';
      if (rnd > 0.95) type = 'light';

      const yNorm = Math.pow(Math.random(), 2.5);
      const y = yNorm * height + 0.5;
      const rScale = (1 - yNorm);
      const theta = y * 10 + Math.random() * Math.PI * 2;
      const r = maxRadius * rScale + (Math.random() * 0.5);
      
      const targetPos = new THREE.Vector3(r * Math.cos(theta), y, r * Math.sin(theta));

      const cR = 15 + Math.random() * 15;
      const cTheta = Math.random() * Math.PI * 2;
      const cPhi = Math.acos(2 * Math.random() - 1);
      const chaosPos = new THREE.Vector3(
        cR * Math.sin(cPhi) * Math.cos(cTheta),
        cR * Math.sin(cPhi) * Math.sin(cTheta) + 5,
        cR * Math.cos(cPhi)
      );

      const scale = type === 'light' ? 0.15 : (0.2 + Math.random() * 0.25);
      const color = type === 'light' ? new THREE.Color("#FFFFAA") : palette[Math.floor(Math.random() * palette.length)];

      const data: InstanceData = {
        chaosPos,
        targetPos,
        type,
        color,
        scale,
        speed: 0.5 + Math.random() * 1.5,
        rotationOffset: new THREE.Euler(Math.random() * Math.PI, Math.random() * Math.PI, 0)
      };

      if (type === 'ball') _balls.push(data);
      else if (type === 'gift') _gifts.push(data);
      else _lights.push(data);
    }

    return { ballsData: _balls, giftsData: _gifts, lightsData: _lights };
  }, [count]);

  // 3. 初始颜色设置
  useLayoutEffect(() => {
    const groups = [
      { ref: ballsRef, data: ballsData },
      { ref: giftsRef, data: giftsData },
      { ref: lightsRef, data: lightsData }
    ];

    groups.forEach(({ ref, data }) => {
      if (ref.current) {
        data.forEach((d, i) => ref.current!.setColorAt(i, d.color));
        if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true;
      }
    });
  }, [ballsData, giftsData, lightsData]);

  // 4. 抽取更新函数，解决 TS 报错
  const updateMeshInstances = (
    ref: React.RefObject<THREE.InstancedMesh | null>, 
    data: InstanceData[],
    isFormed: boolean,
    time: number,
    delta: number
  ) => {
    if (!ref.current) return;

    data.forEach((d, i) => {
      const dest = isFormed ? d.targetPos : d.chaosPos;
      
      // 获取当前矩阵并分解
      ref.current!.getMatrixAt(i, dummy.matrix);
      dummy.matrix.decompose(dummy.position, dummy.quaternion, dummy.scale);
      
      // 插值移动
      dummy.position.lerp(dest, delta * d.speed);

      // 形成后的细节动画
      if (isFormed && dummy.position.distanceTo(d.targetPos) < 0.5) {
        dummy.position.y += Math.sin(time * 2 + d.chaosPos.x) * 0.002;
      }

      // 旋转逻辑
      if (d.type === 'gift') {
        dummy.rotation.x += delta * 0.5;
        dummy.rotation.y += delta * 0.2;
      } else {
        dummy.lookAt(0, dummy.position.y, 0);
      }

      // 缩放逻辑
      let currentScale = d.scale;
      if (d.type === 'light') {
        currentScale *= (1 + Math.sin(time * 5 + d.chaosPos.y) * 0.3);
      }
      dummy.scale.setScalar(currentScale);

      dummy.updateMatrix();
      ref.current!.setMatrixAt(i, dummy.matrix);
    });

    ref.current.instanceMatrix.needsUpdate = true;
  };

  // 5. 帧动画循环
  useFrame((state, delta) => {
    const isFormed = mode === TreeMode.FORMED;
    const time = state.clock.elapsedTime;

    updateMeshInstances(ballsRef, ballsData, isFormed, time, delta);
    updateMeshInstances(giftsRef, giftsData, isFormed, time, delta);
    updateMeshInstances(lightsRef, lightsData, isFormed, time, delta);
  });

  return (
    <>
      <instancedMesh ref={ballsRef} args={[undefined, undefined, ballsData.length]}>
        <sphereGeometry args={[1, 32, 32]} />
        <meshStandardMaterial roughness={0.1} metalness={0.9} envMapIntensity={1.5} />
      </instancedMesh>

      <instancedMesh ref={giftsRef} args={[undefined, undefined, giftsData.length]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial roughness={0.3} metalness={0.5} color="white" />
      </instancedMesh>

      <instancedMesh ref={lightsRef} args={[undefined, undefined, lightsData.length]}>
        <sphereGeometry args={[1, 8, 8]} />
        <meshStandardMaterial emissive="white" emissiveIntensity={2} toneMapped={false} color="white" />
      </instancedMesh>
    </>
  );
};
