import { useRef, useMemo } from 'react';
import * as THREE from 'three';

import { createGaussianMaterial } from '@/components/canvas/materials/gaussianMaterial';

import type { Mesh } from 'three';

export interface GaussianEllipsoidProps {
  position?: [number, number, number];
  scale?: [number, number, number];
  rotation?: [number, number, number];
  color?: string;
  opacity?: number;
  /** Resolution of the sphere geometry. Higher = smoother. */
  segments?: number;
}

/**
 * Renders a 3D Gaussian as a semi-transparent ellipsoid with density falloff.
 * The ellipsoid's shape is controlled by scale (σx, σy, σz) and rotation (Euler degrees).
 */
export function GaussianEllipsoid({
  position = [0, 0, 0],
  scale = [1, 1, 1],
  rotation = [0, 0, 0],
  color = '#4ecdc4',
  opacity = 0.7,
  segments = 32,
}: GaussianEllipsoidProps) {
  const meshRef = useRef<Mesh>(null);

  // Recreate material when visual params change
  const material = useMemo(
    () => createGaussianMaterial(
      new THREE.Color(color),
      opacity,
      new THREE.Vector3(...scale),
    ),
    [color, opacity, scale],
  );

  // Convert rotation from degrees to radians for the mesh
  const rotRad: [number, number, number] = useMemo(
    () => [
      (rotation[0] * Math.PI) / 180,
      (rotation[1] * Math.PI) / 180,
      (rotation[2] * Math.PI) / 180,
    ],
    [rotation],
  );

  return (
    <mesh
      ref={meshRef}
      position={position}
      scale={scale}
      rotation={rotRad}
      material={material}
    >
      <sphereGeometry args={[1, segments, segments]} />
    </mesh>
  );
}
