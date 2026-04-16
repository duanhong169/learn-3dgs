import { useMemo } from 'react';
import { Line } from '@react-three/drei';
import * as THREE from 'three';

import type { Tuple3 } from '@/types/common';

export interface GradientArrowProps {
  position: Tuple3;
  direction: Tuple3;
  magnitude: number;
  color?: string;
  visible?: boolean;
}

/**
 * An arrow showing the gradient direction on a Gaussian.
 */
export function GradientArrow({
  position,
  direction,
  magnitude,
  color = '#d29922',
  visible = true,
}: GradientArrowProps) {
  // Rotate cone from default Y+ to the gradient direction
  const quaternion = useMemo(() => {
    const dir = new THREE.Vector3(...direction).normalize();
    const quat = new THREE.Quaternion();
    quat.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    return quat;
  }, [direction]);

  if (!visible || magnitude < 0.05) return null;

  const length = Math.min(magnitude * 0.5, 1.5);
  const end: Tuple3 = [
    position[0] + direction[0] * length,
    position[1] + direction[1] * length,
    position[2] + direction[2] * length,
  ];

  return (
    <group>
      <Line
        points={[position, end]}
        color={color}
        lineWidth={2}
        transparent
        opacity={0.8}
      />
      <mesh position={end} quaternion={quaternion}>
        <coneGeometry args={[0.04, 0.12, 6]} />
        <meshBasicMaterial color={color} />
      </mesh>
    </group>
  );
}
