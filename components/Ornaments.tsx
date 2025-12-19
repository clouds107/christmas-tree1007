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
}

export const Ornaments: React.FC<OrnamentsProps> = ({ mode, count }) => {
  const ballsRef = useRef<THREE.InstancedMesh>(null!);
  const giftsRef = useRef<THREE.InstancedMesh>(null!);
  const lightsRef = useRef<THREE.InstancedMesh>(null!);
  
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const { ballsData, giftsData, lightsData } = useMemo(() => {
    const _balls: InstanceData[] = [];
    const _gifts: InstanceData[] = [];
    const _lights: InstanceData[] = [];

    const height = 11; 
    const maxRadius = 4.5;
    
    const gold = new THREE.Color("#D4AF37");
    const red = new THREE.Color("#8B0000"); 
    const whiteGold = new THREE.Color("#F5E6BF");
    const palette = [gold, red, gold, whiteGold, red]; // 增加红色权重

    for (let i = 0; i < count; i++) {
      const rnd = Math.random();
      let type: OrnamentType = 'ball';
      if (rnd > 0.7) type = 'gift';
      if (rnd > 0.85) type = 'light'; 

      // --- 关键点 1：调整 y 轴权重 ---
      // 使用 1.8 次幂，让中段（树腰）分配到更多的装饰物，不再只堆在底部
      const yNorm = Math.pow(Math.random(), 1.8); 
      const y = yNorm * height + 0.6;
      
      const rScale = (1 - yNorm);
      
      // --- 关键点 2：增强螺旋覆盖 ---
      // 增加旋转圈数 (y * 18)，让螺旋排列更紧凑，不留垂直缝隙
      const theta = y * 18 + Math.random() * Math.PI * 2; 
      
      // --- 关键点 3：深度随机分布 (解决“空”的感觉) ---
      // r 不再是一个固定表面，而是在 0.7 到 1.1 之间波动，填补内层空间
      const depth = 0.7 + Math.random() * 0.4;
      const r = maxRadius * rScale * depth;
      
      const targetPos = new THREE.Vector3(r * Math.cos(theta), y, r * Math.sin(theta));

      const cR = 15 + Math.random() * 15;
      const cTheta = Math.random() * Math.PI * 2;
      const cPhi = Math.acos(2 * Math.random() - 1);
      const chaosPos = new THREE.Vector3(
        cR * Math.sin(cPhi) * Math.cos(cTheta),
        cR * Math.sin(cPhi) * Math.sin(cTheta) + 5,
        cR * Math.cos(cPhi)
      );

      // --- 关键点 4：略微增大体积 ---
      const scale = type === 'light' ? 0.16 : (0.28 + Math.random() * 0.25);
      const color = type === 'light' ? new THREE.Color("#FFDD88") : palette[Math.floor(Math.random() * palette.length)].clone();

      const data: InstanceData = { chaosPos, targetPos, type, color, scale, speed: 0.7 + Math.random() * 1.3 };

      if (type === 'ball') _balls.push(data);
      else if (type === 'gift') _gifts.push(data);
      else _lights.push(data);
    }
    return { ballsData: _balls, giftsData: _gifts, lightsData: _lights };
  }, [count]);

  useLayoutEffect(() => {
    [
      { ref: ballsRef, data: ballsData },
      { ref: giftsRef, data: giftsData },
      { ref: lightsRef, data: lightsData }
    ].forEach(({ ref, data }) => {
      if (ref.current) {
        data.forEach((d, i) => ref.current.setColorAt(i, d.color));
        if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true;
      }
    });
  }, [ballsData, giftsData, lightsData]);

  useFrame((state, delta) => {
    const isFormed = mode === TreeMode.FORMED;
    const time = state.clock.elapsedTime;

    const updateMesh = (ref: React.RefObject<THREE.InstancedMesh>, data: InstanceData[]) => {
      if (!ref.current) return;
      data.forEach((d, i) => {
        const dest = isFormed ? d.targetPos : d.chaosPos;
        ref.current.getMatrixAt(i, dummy.matrix);
        dummy.matrix.decompose(dummy.position, dummy.quaternion, dummy.scale);
        
        dummy.position.lerp(dest, delta * d.speed * 2.5);

        if (isFormed) {
          dummy.position.y += Math.sin(time * 1.5 + d.chaosPos.x) * 0.001;
          if (d.type === 'gift') {
            dummy.rotation.y += delta * 0.4;
          } else {
            dummy.lookAt(0, dummy.position.y, 0);
          }
        }

        let s = d.scale;
        if (d.type === 'light') s *= (1 + Math.sin(time * 4 + d.chaosPos.y) * 0.2);
        dummy.scale.setScalar(s);

        dummy.updateMatrix();
        ref.current.setMatrixAt(i, dummy.matrix);
      });
      ref.current.instanceMatrix.needsUpdate = true;
    };

    updateMesh(ballsRef, ballsData);
    updateMesh(giftsRef, giftsData);
    updateMesh(lightsRef, lightsData);
  });

  return (
    <>
      <instancedMesh ref={ballsRef} args={[null as any, null as any, ballsData.length]}>
        <sphereGeometry args={[1, 24, 24]} />
        <meshStandardMaterial roughness={0.1} metalness={0.9} />
      </instancedMesh>

      <instancedMesh ref={giftsRef} args={[null as any, null as any, giftsData.length]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial roughness={0.4} metalness={0.4} color="white" />
      </instancedMesh>

      <instancedMesh ref={lightsRef} args={[null as any, null as any, lightsData.length]}>
        <sphereGeometry args={[1, 8, 8]} />
        <meshStandardMaterial emissive="#FFDD88" emissiveIntensity={1.8} toneMapped={false} color="#FFDD88" />
      </instancedMesh>
    </>
  );
};
