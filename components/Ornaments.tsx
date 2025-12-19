import React, { useMemo, useRef, useLayoutEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { TreeMode } from '../types';

interface OrnamentsProps {
  mode: TreeMode;
  count: number;
}

// 恢复原版类型：圆球、礼物盒、灯光
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
  // 定义 3 个实例化网格引用
  const ballsRef = useRef<THREE.InstancedMesh>(null);
  const giftsRef = useRef<THREE.InstancedMesh>(null);
  const lightsRef = useRef<THREE.InstancedMesh>(null);
  
  const dummy = useMemo(() => new THREE.Object3D(), []);

  // 1. 生成数据逻辑（保持原版）
  const { ballsData, giftsData, lightsData } = useMemo(() => {
    const _balls: InstanceData[] = [];
    const _gifts: InstanceData[] = [];
    const _lights: InstanceData[] = [];

    const height = 11;
    const maxRadius = 4.5;
    const palette = [new THREE.Color("#ff0000"), new THREE.Color("#ffd700"), new THREE.Color("#ffffff")];

    for (let i = 0; i < count; i++) {
      const rnd = Math.random();
      let type: OrnamentType = 'ball';
      if (rnd > 0.8 && rnd <= 0.9) type = 'gift';
      else if (rnd > 0.9) type = 'light';

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

      const color = type === 'light' ? new THREE.Color("#FFFFAA") : palette[Math.floor(Math.random() * palette.length)];
      const scale = type === 'light' ? 0.15 : 0.2 + Math.random() * 0.2;

      const data: InstanceData = { chaosPos, targetPos, type, color, scale, speed: 0.5 + Math.random() * 1.5 };

      if (type === 'ball') _balls.push(data);
      else if (type === 'gift') _gifts.push(data);
      else _lights.push(data);
    }
    return { ballsData: _balls, giftsData: _gifts, lightsData: _lights };
  }, [count]);

  // 2. 初始颜色设置（修复了属性访问报错）
  useLayoutEffect(() => {
    [
      { ref: ballsRef, data: ballsData },
      { ref: giftsRef, data: giftsData },
      { ref: lightsRef, data: lightsData }
    ].forEach(({ ref, data }) => {
      if (ref.current) {
        data.forEach((d, i) => ref.current!.setColorAt(i, d.color));
        if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true;
      }
    });
  }, [ballsData, giftsData, lightsData]);

  // 3. 动画循环逻辑（核心报错修复点）
  useFrame((state, delta) => {
    const isFormed = mode === TreeMode.FORMED;
    const time = state.clock.elapsedTime;

    // 修改：将第一个参数类型定义为 InstancedMesh | null，并增加空值检查
    const updateMesh = (mesh: THREE.InstancedMesh | null, data: InstanceData[]) => {
      if (!mesh) return; // 只有当 mesh 存在时才执行更新
      
      data.forEach((d, i) => {
        mesh.getMatrixAt(i, dummy.matrix);
        dummy.matrix.decompose(dummy.position, dummy.quaternion, dummy.scale);
        
        const dest = isFormed ? d.targetPos : d.chaosPos;
        dummy.position.lerp(dest, delta * d.speed);

        if (d.type === 'gift') {
           dummy.rotation.x += delta;
           dummy.rotation.y += delta * 0.5;
        } else {
           dummy.lookAt(0, dummy.position.y, 0);
        }

        dummy.scale.setScalar(d.scale);
        if (d.type === 'light') {
           dummy.scale.multiplyScalar(1 + Math.sin(time * 5 + d.chaosPos.y) * 0.3);
        }

        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
    };

    // 修复：传入 .current 实例，而不是整个 RefObject 对象
    updateMesh(ballsRef.current, ballsData);
    updateMesh(giftsRef.current, giftsData);
    updateMesh(lightsRef.current, lightsData);
  });

  return (
    <>
      <instancedMesh ref={ballsRef} args={[undefined, undefined, ballsData.length]}>
        <sphereGeometry args={[1, 16, 16]} />
        <meshStandardMaterial roughness={0.1} metalness={0.9} />
      </instancedMesh>
      
      <instancedMesh ref={giftsRef} args={[undefined, undefined, giftsData.length]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial roughness={0.3} metalness={0.5} />
      </instancedMesh>

      <instancedMesh ref={lightsRef} args={[undefined, undefined, lightsData.length]}>
        <sphereGeometry args={[1, 8, 8]} />
        <meshStandardMaterial emissive="#FFFFAA" emissiveIntensity={2} toneMapped={false} />
      </instancedMesh>
    </>
  );
};
