import React, { useMemo, useRef, useLayoutEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { TreeMode } from '../types';

interface OrnamentsProps {
  mode: TreeMode;
  count: number;
}

type OrnamentType = 'ball' | 'gift' | 'light' | 'shell';

interface InstanceData {
  chaosPos: THREE.Vector3;
  targetPos: THREE.Vector3;
  type: OrnamentType;
  color: THREE.Color;
  scale: number;
  speed: number;
}

export const Ornaments: React.FC<OrnamentsProps> = ({ mode, count }) => {
  const ballsRef = useRef<THREE.InstancedMesh>(null);
  const giftsRef = useRef<THREE.InstancedMesh>(null);
  const lightsRef = useRef<THREE.InstancedMesh>(null);
  const shellsRef = useRef<THREE.InstancedMesh>(null);
  
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const { ballsData, giftsData, lightsData, shellsData } = useMemo(() => {
    const _balls: InstanceData[] = [];
    const _gifts: InstanceData[] = [];
    const _lights: InstanceData[] = [];
    const _shells: InstanceData[] = [];

    const height = 11;
    const maxRadius = 4.5;
    
    const purple = new THREE.Color("#A020F0"); 
    const lavender = new THREE.Color("#E6E6FA");
    const gold = new THREE.Color("#D4AF37");

    for (let i = 0; i < count; i++) {
      const rnd = Math.random();
      let type: OrnamentType = 'ball';
      // 概率权重：贝壳 25%，礼盒 15%，灯光 10%，普通球 50%
      if (rnd > 0.5 && rnd <= 0.75) type = 'shell';
      else if (rnd > 0.75 && rnd <= 0.9) type = 'gift';
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

      const color = type === 'shell' ? (Math.random() > 0.5 ? purple : lavender) : 
                    type === 'light' ? new THREE.Color("#FFFFAA") : 
                    (Math.random() > 0.6 ? gold : purple);

      // 贝壳和礼盒稍微大一点，方便观察
      const scale = type === 'light' ? 0.15 : (type === 'shell' ? 0.4 : 0.3) + Math.random() * 0.15;

      const data: InstanceData = {
        chaosPos, targetPos, type, color, scale,
        speed: 0.5 + Math.random() * 1.5
      };

      if (type === 'ball') _balls.push(data);
      else if (type === 'gift') _gifts.push(data);
      else if (type === 'light') _lights.push(data);
      else _shells.push(data);
    }
    return { ballsData: _balls, giftsData: _gifts, lightsData: _lights, shellsData: _shells };
  }, [count]);

  useLayoutEffect(() => {
    const sets = [
      { ref: ballsRef, data: ballsData },
      { ref: giftsRef, data: giftsData },
      { ref: lightsRef, data: lightsData },
      { ref: shellsRef, data: shellsData }
    ];
    sets.forEach(({ ref, data }) => {
      if (ref.current) {
        data.forEach((d, i) => ref.current!.setColorAt(i, d.color));
        if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true;
      }
    });
  }, [ballsData, giftsData, lightsData, shellsData]);

  useFrame((state, delta) => {
    const isFormed = mode === TreeMode.FORMED;
    const time = state.clock.elapsedTime;

    const updateMesh = (mesh: THREE.InstancedMesh | null, data: InstanceData[]) => {
      if (!mesh) return;
      data.forEach((d, i) => {
        mesh.getMatrixAt(i, dummy.matrix);
        dummy.matrix.decompose(dummy.position, dummy.quaternion, dummy.scale);
        
        const dest = isFormed ? d.targetPos : d.chaosPos;
        dummy.position.lerp(dest, delta * d.speed * 2.0);
        
        if (isFormed && dummy.position.distanceTo(d.targetPos) < 0.2) {
          dummy.position.y += Math.sin(time * 2 + d.chaosPos.x) * 0.005;
        }

        if (d.type === 'gift' || d.type === 'shell') {
           // 旋转动画
           dummy.rotation.x += delta * 0.5;
           dummy.rotation.y += delta * 0.3;
        } else {
           dummy.lookAt(0, dummy.position.y, 0);
        }

        // 核心修改：如果是贝壳，在保持总缩放的同时压扁 X 轴
        if (d.type === 'shell') {
          dummy.scale.set(d.scale, d.scale * 0.2, d.scale * 1.2); 
        } else {
          dummy.scale.setScalar(d.scale);
        }

        if (d.type === 'light') {
           dummy.scale.multiplyScalar(1 + Math.sin(time * 5 + d.chaosPos.y) * 0.3);
        }

        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
    };

    updateMesh(ballsRef.current, ballsData);
    updateMesh(giftsRef.current, giftsData);
    updateMesh(lightsRef.current, lightsData);
    updateMesh(shellsRef.current, shellsData);
  });

  return (
    <>
      <instancedMesh ref={ballsRef} args={[undefined, undefined, ballsData.length]}>
        <sphereGeometry args={[1, 24, 24]} />
        <meshStandardMaterial roughness={0.1} metalness={0.9} />
      </instancedMesh>
      
      <instancedMesh ref={giftsRef} args={[undefined, undefined, giftsData.length]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial roughness={0.4} metalness={0.4} />
      </instancedMesh>

      {/* 贝壳几何体优化：使用切角球体并开启双面渲染 */}
      <instancedMesh ref={shellsRef} args={[undefined, undefined, shellsData.length]}>
        <sphereGeometry args={[1, 20, 20, 0, Math.PI, 0, Math.PI]} />
        <meshStandardMaterial 
          roughness={0.2} 
          metalness={0.8} 
          side={THREE.DoubleSide} 
          flatShading={true} // 增加棱角感更像贝壳
        />
      </instancedMesh>

      <instancedMesh ref={lightsRef} args={[undefined, undefined, lightsData.length]}>
        <sphereGeometry args={[1, 8, 8]} />
        <meshStandardMaterial emissive="#FFFFAA" emissiveIntensity={2} toneMapped={false} />
      </instancedMesh>
    </>
  );
};
