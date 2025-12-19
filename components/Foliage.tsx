import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { TreeMode } from '../types';

interface FoliageProps {
  mode: TreeMode;
  count: number;
}

const vertexShader = `
  uniform float uTime;
  uniform float uProgress;
  
  attribute vec3 aChaosPos;
  attribute vec3 aTargetPos;
  attribute float aRandom;
  
  varying vec3 vColor;
  varying float vAlpha;

  float cubicInOut(float t) {
    return t < 0.5
      ? 4.0 * t * t * t
      : 1.0 - pow(-2.0 * t + 2.0, 3.0) / 2.0;
  }

  void main() {
    float localProgress = clamp(uProgress * 1.2 - aRandom * 0.2, 0.0, 1.0);
    float easedProgress = cubicInOut(localProgress);

    vec3 newPos = mix(aChaosPos, aTargetPos, easedProgress);
    
    if (easedProgress > 0.9) {
      newPos.x += sin(uTime * 2.0 + newPos.y) * 0.05;
      newPos.z += cos(uTime * 1.5 + newPos.y) * 0.05;
    }

    vec4 mvPosition = modelViewMatrix * vec4(newPos, 1.0);
    gl_PointSize = (4.0 * aRandom + 2.0) * (20.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;

    // --- 颜色逻辑：紫色渐变变换 ---
    vec3 chaosPurple = vec3(0.541, 0.169, 0.886); 
    vec3 formedPurple = vec3(0.75, 0.35, 1.0);
    float sparkle = sin(uTime * 5.0 + aRandom * 100.0);
    
    vColor = mix(chaosPurple, formedPurple, easedProgress);
    
    if (sparkle > 0.9) {
      vColor += vec3(0.35, 0.2, 0.4); 
    }
    
    vColor = min(vColor, vec3(1.0));
    vAlpha = 1.0;
  }
`;

const fragmentShader = `
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    float r = distance(gl_PointCoord, vec2(0.5));
    if (r > 0.5) discard;
    float glow = 1.0 - (r * 2.0);
    glow = pow(glow, 1.5);
    gl_FragColor = vec4(vColor, vAlpha * glow);
  }
`;

export const Foliage: React.FC<FoliageProps> = ({ mode, count }) => {
  const meshRef = useRef<THREE.Points>(null);
  const progressRef = useRef(0);

  const { chaosPositions, targetPositions, randoms } = useMemo(() => {
    const chaos = new Float32Array(count * 3);
    const target = new Float32Array(count * 3);
    const rnd = new Float32Array(count);
    const goldenRatio = (1 + Math.sqrt(5)) / 2;
    const height = 12;
    const maxRadius = 5;

    for (let i = 0; i < count; i++) {
      const r = 25 * Math.cbrt(Math.random());
      const theta = Math.random() * 2 * Math.PI;
      const phi = Math.acos(2 * Math.random() - 1);
      chaos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      chaos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta) + 5;
      chaos[i * 3 + 2] = r * Math.cos(phi);

      const yNorm = i / count; 
      const y = yNorm * height;
      const currentRadius = maxRadius * (1 - yNorm);
      const angle = 2 * Math.PI * goldenRatio * i;
      target[i * 3] = Math.cos(angle) * currentRadius;
      target[i * 3 + 1] = y;
      target[i * 3 + 2] = Math.sin(angle) * currentRadius;
      rnd[i] = Math.random();
    }
    return { chaosPositions: chaos, targetPositions: target, randoms: rnd };
  }, [count]);

  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uProgress: { value: 0 },
  }), []);

  useFrame((state, delta) => {
    if (meshRef.current) {
      const material = meshRef.current.material as THREE.ShaderMaterial;
      material.uniforms.uTime.value = state.clock.elapsedTime;
      const target = mode === TreeMode.FORMED ? 1 : 0;
      progressRef.current = THREE.MathUtils.lerp(progressRef.current, target, delta * 1.5);
      material.uniforms.uProgress.value = progressRef.current;
    }
  });

  return (
  <points ref={meshRef}>
    <bufferGeometry>
      <bufferAttribute
        attach="attributes-position"
        count={count}
        array={chaosPositions}
        itemSize={3}
        args={[chaosPositions, 3]} // 修复位置
      />
      <bufferAttribute
        attach="attributes-aChaosPos"
        count={count}
        array={chaosPositions}
        itemSize={3}
        args={[chaosPositions, 3]} // 修复位置
      />
      <bufferAttribute
        attach="attributes-aTargetPos"
        count={count}
        array={targetPositions}
        itemSize={3}
        args={[targetPositions, 3]} // 修复位置
      />
      <bufferAttribute
        attach="attributes-aRandom"
        count={count}
        array={randoms}
        itemSize={1}
        args={[randoms, 1]} // 修复位置
      />
    </bufferGeometry>
    {/* @ts-ignore */}
    <shaderMaterial
      vertexShader={vertexShader}
      fragmentShader={fragmentShader}
      uniforms={uniforms}
      transparent
      depthWrite={false}
      blending={THREE.AdditiveBlending}
    />
  </points>
  );
};