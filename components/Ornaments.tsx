import React, { useMemo, useRef, useLayoutEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { TreeMode } from '../types';

interface OrnamentsProps {
  mode: TreeMode;
  count: number;
}

// 定义装饰物类型，增加了 shell (贝壳)
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
  // 定义 4 个实例化网格引用
  const ballsRef = useRef<THREE.InstancedMesh>(null);
  const giftsRef = useRef<THREE.InstancedMesh>(null);
  const lightsRef = useRef<THREE.InstancedMesh>(null);
  const shellsRef = useRef<THREE.InstancedMesh>(null);
  
  const dummy = useMemo(() => new THREE.Object3D(), []);

  // 生成装饰物数据
  const { ballsData, giftsData, lightsData, shellsData } = useMemo(() => {
    const _balls: InstanceData[] = [];
    const _gifts: InstanceData[] = [];
    const _lights: InstanceData[] = [];
    const _shells: InstanceData[] = [];

    const height = 11;
    const maxRadius = 4.5;
    
    // 豪华紫色调色板
    const purple = new THREE.Color("#8A2BE2"); 
    const lavender = new THREE.Color("#E6E6FA");
    const gold = new THREE.Color("#D4AF37");

    for (let i = 0; i < count; i++) {
      const rnd = Math.random();
      let type: OrnamentType = 'ball';
      // 分配概率：增加贝壳比例
      if (rnd > 0.6 && rnd <= 0.8) type = 'shell';
      else if (rnd > 0.8 && rnd <= 0.9) type = 'gift';
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

      // 贝壳固定为紫色系，其他随机
      const color = type === 'shell' ? (Math.random() > 0.5 ? purple : lavender) : 
                    type === 'light' ? new THREE.Color("#FFFFAA") : 
                    (Math.random() > 0.6 ? gold : purple);

      const scale = type === 'light' ? 0.15 : (0.2 + Math.random() * 0.25);

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

  // 设置初始颜色并修复 instanceColor 属性检查
  useLayoutEffect(() => {
    [
      { ref: ballsRef, data: ballsData },
      { ref: giftsRef, data: giftsData },
      { ref: lightsRef, data: lightsData },
      { ref: shellsRef, data: shellsData }
    ].forEach(({ ref, data }) => {
      if (ref.current) {
        data.forEach((d, i) => ref.current!.setColorAt(i, d.color));
        if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true;
      }
    });
  }, [ballsData, giftsData, lightsData, shellsData]);

  // 动画循环：修复了 Ref 传递给函数的类型错误
  useFrame((state, delta) => {
    const isFormed = mode === TreeMode.FORMED;
    const time = state.clock.elapsedTime;

    const updateMesh = (mesh: THREE.InstancedMesh | null, data: InstanceData[]) => {
      if (!mesh) return;
      data.forEach((d, i) => {
        mesh.getMatrixAt(i, dummy.matrix);
        dummy.matrix.decompose(dummy.position, dummy.quaternion, dummy.scale);
        
        const dest = isFormed ? d.targetPos : d.chaosPos;
        dummy.position.lerp(dest, delta * d.speed);
        
        if (d.type === 'gift' || d.type === 'shell') {
           dummy.rotation.x += delta * 0.5;
           dummy.rotation.y += delta * 0.2;
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

    // 直接传入 .current 解决 RefObject 报错
    updateMesh(ballsRef.current, ballsData);
    updateMesh(giftsRef.current, giftsData);
    updateMesh(lightsRef.current, lightsData);
    updateMesh(shellsRef.current, shellsData);
  });

  return (
    <>
      <instancedMesh ref={ballsRef} args={[undefined, undefined, ballsData.length]}>
        <sphereGeometry args={[1, 32, 32]} />
        <meshStandardMaterial roughness={0.1} metalness={0.9} />
      </instancedMesh>
      
      <instancedMesh ref={giftsRef} args={[undefined, undefined, giftsData.length]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial roughness={0.3} metalness={0.5} />
      </instancedMesh>

      {/* 紫色贝壳：使用半球几何体模拟 */}
      <instancedMesh ref={shellsRef} args={[undefined, undefined, shellsData.length]}>
        <sphereGeometry args={[1, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2.2]} />
        <meshStandardMaterial roughness={0.2} metalness={0.7} side={THREE.DoubleSide} />
      </instancedMesh>

      <instancedMesh ref={lightsRef} args={[undefined, undefined, lightsData.length]}>
        <sphereGeometry args={[1, 8, 8]} />
        <meshStandardMaterial emissive="#FFFFAA" emissiveIntensity={2} toneMapped={false} />
      </instancedMesh>
    </>
  );
};