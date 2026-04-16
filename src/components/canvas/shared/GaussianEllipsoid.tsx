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
  /** SH order (0-3). Only used when useSH is true. */
  shOrder?: number;
  /** SH coefficients as array of [r,g,b] triplets (up to 16). */
  shCoefficients?: Array<[number, number, number]>;
  /** Whether to use SH view-dependent coloring instead of fixed color. */
  useSH?: boolean;
}

/**
 * Renders a 3D Gaussian as a semi-transparent ellipsoid with density falloff.
 * Supports optional Spherical Harmonics (SH) for view-dependent coloring.
 */
export function GaussianEllipsoid({
  position = [0, 0, 0],
  scale = [1, 1, 1],
  rotation = [0, 0, 0],
  color = '#4ecdc4',
  opacity = 0.7,
  segments = 32,
  shOrder = 0,
  shCoefficients,
  useSH = false,
}: GaussianEllipsoidProps) {
  const meshRef = useRef<Mesh>(null);

  // Convert SH coefficients to THREE.Vector3 array
  const shCoeffs = useMemo(() => {
    const coeffs: THREE.Vector3[] = [];
    for (let i = 0; i < 16; i++) {
      const c = shCoefficients?.[i];
      coeffs.push(c ? new THREE.Vector3(c[0], c[1], c[2]) : new THREE.Vector3(0, 0, 0));
    }
    return coeffs;
  }, [shCoefficients]);

  // Recreate material when visual params change
  const material = useMemo(
    () => createGaussianMaterial(
      new THREE.Color(color),
      opacity,
      new THREE.Vector3(...scale),
      shOrder,
      shCoeffs,
      useSH,
    ),
    [color, opacity, scale, shOrder, shCoeffs, useSH],
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
