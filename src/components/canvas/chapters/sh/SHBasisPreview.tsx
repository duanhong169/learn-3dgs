import { useMemo } from 'react';
import * as THREE from 'three';

import { evaluateSHBasis } from '@/utils/spherical-harmonics';
import { fibonacciSphere } from '@/utils/spherical-harmonics';

import type { Tuple3 } from '@/types/common';

/**
 * Bipolar colorizer: red for positive values, blue for negative, brighter with
 * magnitude. Used to visualize a single SH basis function's directional lobe.
 */
function basisToColor(v: number, maxAbs: number): [number, number, number] {
  const t = maxAbs > 0 ? Math.max(-1, Math.min(1, v / maxAbs)) : 0;
  if (t >= 0) return [t, 0.15 * (1 - t), 0.15 * (1 - t)];
  return [0.15 * (1 + t), 0.15 * (1 + t), -t];
}

/**
 * Build a sphere whose per-vertex color encodes the sign and magnitude of the
 * specified SH basis function. Vertex-colored BufferGeometry + basic material
 * so it reads the same regardless of scene lighting.
 */
function buildBasisSphereGeometry(basisIndex: number, resolution: number): THREE.BufferGeometry {
  const geo = new THREE.SphereGeometry(1, resolution, resolution);
  const positions = geo.attributes.position!;
  const count = positions.count;
  const values: number[] = [];
  for (let i = 0; i < count; i++) {
    const x = positions.getX(i);
    const y = positions.getY(i);
    const z = positions.getZ(i);
    const basis = evaluateSHBasis([x, y, z] as Tuple3);
    values.push(basis[basisIndex]!);
  }
  const maxAbs = values.reduce((m, v) => Math.max(m, Math.abs(v)), 0);

  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const c = basisToColor(values[i]!, maxAbs);
    colors[i * 3] = c[0];
    colors[i * 3 + 1] = c[1];
    colors[i * 3 + 2] = c[2];
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geo;
}

// Lobe shapes (magnitude-warped spheres) for an even more visual representation.
function buildBasisLobeGeometry(basisIndex: number, resolution: number): THREE.BufferGeometry {
  const geo = new THREE.SphereGeometry(1, resolution, resolution);
  const positions = geo.attributes.position!;
  const count = positions.count;
  const values: number[] = [];
  for (let i = 0; i < count; i++) {
    const x = positions.getX(i);
    const y = positions.getY(i);
    const z = positions.getZ(i);
    values.push(evaluateSHBasis([x, y, z] as Tuple3)[basisIndex]!);
  }
  const maxAbs = values.reduce((m, v) => Math.max(m, Math.abs(v)), 0);

  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const x = positions.getX(i);
    const y = positions.getY(i);
    const z = positions.getZ(i);
    const v = values[i]!;
    const rScale = Math.abs(v) / (maxAbs + 1e-6);
    positions.setXYZ(i, x * rScale, y * rScale, z * rScale);
    const c = basisToColor(v, maxAbs);
    colors[i * 3] = c[0];
    colors[i * 3 + 1] = c[1];
    colors[i * 3 + 2] = c[2];
  }
  positions.needsUpdate = true;
  geo.computeVertexNormals();
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geo;
}

const BASIS_LABELS = [
  'Y₀₀ (DC)',
  'Y₁₋₁',
  'Y₁₀',
  'Y₁₁',
  'Y₂₋₂',
  'Y₂₋₁',
  'Y₂₀',
  'Y₂₁',
  'Y₂₂',
];

export interface SHBasisPreviewProps {
  /** Grid origin in world space. */
  origin?: Tuple3;
  /** Spacing between basis spheres. */
  spacing?: number;
  /** Sphere radius. */
  radius?: number;
  /** Highlight a single basis function; dim the rest. */
  highlightIndex?: number | null;
}

/**
 * Renders the 9 SH basis functions as a 3×3 grid of colored "lobe" spheres.
 * Rows correspond to L=0 (1 function), L=1 (3 functions), L=2 (5 functions);
 * to keep the layout tidy we fill a 3×3 grid with the 9 functions laid out
 * left-to-right, top-to-bottom.
 */
export function SHBasisPreview({
  origin = [0, 2.5, -2],
  spacing = 0.9,
  radius = 0.3,
  highlightIndex = null,
}: SHBasisPreviewProps) {
  const lobes = useMemo(
    () =>
      Array.from({ length: 9 }, (_, i) => ({
        index: i,
        geometry: buildBasisLobeGeometry(i, 32),
      })),
    [],
  );

  // Avoid unused-import lint — fibonacciSphere is exported by shared module but
  // not needed here; keep the import slot occupied for future sample overlays.
  void fibonacciSphere;

  return (
    <group position={origin}>
      {lobes.map(({ index, geometry }) => {
        const col = index % 3;
        const row = Math.floor(index / 3);
        const x = (col - 1) * spacing;
        const y = -row * spacing;
        const dim = highlightIndex !== null && highlightIndex !== index;
        return (
          <group key={index} position={[x, y, 0]}>
            <mesh geometry={geometry} scale={[radius, radius, radius]}>
              <meshBasicMaterial
                vertexColors
                transparent
                opacity={dim ? 0.2 : 1}
              />
            </mesh>
            {/* Thin ring to frame each lobe */}
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <ringGeometry args={[radius * 1.05, radius * 1.1, 64]} />
              <meshBasicMaterial
                color={dim ? '#333' : '#58a6ff'}
                side={THREE.DoubleSide}
                transparent
                opacity={dim ? 0.3 : 0.8}
              />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

// Keep labels exported for overlay UI
export { BASIS_LABELS };

// Keep helper exported for test/debug scenarios
// eslint-disable-next-line react-refresh/only-export-components
export { buildBasisSphereGeometry };
