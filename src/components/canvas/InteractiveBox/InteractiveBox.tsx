import { useRef, useState } from 'react';

import { useFrame } from '@react-three/fiber';
import { useControls } from 'leva';

import { useAppStore } from '@/store/useAppStore';
import { lerp } from '@/utils/math';

import type { Mesh } from 'three';
import type { Tuple3 } from '@/types/common';

export interface InteractiveBoxProps {
  id: string;
  position?: Tuple3;
  color?: string;
}

export function InteractiveBox({ id, position = [0, 0, 0], color = '#ff6b35' }: InteractiveBoxProps) {
  const meshRef = useRef<Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const selectedId = useAppStore((s) => s.selectedId);
  const select = useAppStore((s) => s.select);

  const isSelected = selectedId === id;

  const { speed } = useControls('Objects', {
    speed: { value: 1, min: 0, max: 5, step: 0.1 },
  });

  // Animate: hover scale + selection bounce
  useFrame((_, delta) => {
    if (!meshRef.current) return;

    // Rotation
    meshRef.current.rotation.y += delta * speed * 0.5;

    // Scale animation
    const targetScale = hovered ? 1.15 : isSelected ? 1.1 : 1;
    const currentScale = meshRef.current.scale.x;
    const newScale = lerp(currentScale, targetScale, delta * 8);
    meshRef.current.scale.setScalar(newScale);

    // Bounce when selected
    if (isSelected) {
      meshRef.current.position.y =
        position[1] + Math.sin(Date.now() * 0.003) * 0.15;
    } else {
      meshRef.current.position.y = lerp(meshRef.current.position.y, position[1], delta * 5);
    }
  });

  const handleClick = () => {
    select(isSelected ? null : id);
  };

  return (
    <mesh
      ref={meshRef}
      position={position}
      onClick={handleClick}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
    >
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial
        color={isSelected ? '#ffffff' : color}
        roughness={0.4}
        metalness={0.3}
        emissive={hovered ? color : '#000000'}
        emissiveIntensity={hovered ? 0.3 : 0}
      />
    </mesh>
  );
}
