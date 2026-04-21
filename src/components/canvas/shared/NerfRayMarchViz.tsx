import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

import { useIntroStore } from '@/store/useIntroStore';
import { GRID_N, GRID_HALF, buildPixelGrid } from './introShared';

import type { Group } from 'three';
import type { Tuple3 } from '@/types/common';

/** Where the volume starts along +Z (from the image plane). */
const VOL_START_Z = 0.5;
/** Volume extent along +Z. */
const VOL_DEPTH = 3;

/** Deterministic volume: 30 small boxes scattered inside the volume region. */
const VOLUME_BOXES: Array<{ pos: Tuple3; size: Tuple3; color: string }> = (() => {
  const rng = mulberry32(1337);
  const out: Array<{ pos: Tuple3; size: Tuple3; color: string }> = [];
  const palette = ['#ff6b35', '#f7c948', '#4ecdc4', '#a6cfe2', '#ffa07a'];
  for (let i = 0; i < 30; i++) {
    const px = (rng() - 0.5) * 1.8;
    const py = (rng() - 0.5) * 1.8;
    const pz = VOL_START_Z + 0.2 + rng() * (VOL_DEPTH - 0.4);
    const s = 0.15 + rng() * 0.2;
    out.push({
      pos: [px, py, pz],
      size: [s, s, s],
      color: palette[Math.floor(rng() * palette.length)] ?? '#4ecdc4',
    });
  }
  return out;
})();

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface NerfRayMarchVizProps {
  /** Horizontal offset applied to this whole viz (left half of screen). */
  offsetX: number;
}

/**
 * Left-panel NeRF visualization: animated ray marching from the selected pixel
 * through a scattered volume, with `samplesPerRay` sample points.
 */
export function NerfRayMarchViz({ offsetX }: NerfRayMarchVizProps) {
  const samplesPerRay = useIntroStore((s) => s.samplesPerRay);
  const selectedPixel = useIntroStore((s) => s.selectedPixel);
  const setSelectedPixel = useIntroStore((s) => s.setSelectedPixel);

  const sampleGroupRef = useRef<Group>(null);

  // Grid of pixel positions on the image plane (z = 0 in this group's local space).
  const pixelPositions = useMemo<Tuple3[]>(() => buildPixelGrid(), []);

  // Ray origin = selected pixel center.
  const rayOrigin = useMemo<Tuple3>(() => {
    const step = (GRID_HALF * 2) / (GRID_N - 1);
    const [i, j] = selectedPixel;
    return [-GRID_HALF + i * step, -GRID_HALF + j * step, 0];
  }, [selectedPixel]);

  // Sample point positions along the ray (+Z direction).
  const samplePositions = useMemo<Tuple3[]>(() => {
    const positions: Tuple3[] = [];
    const step = VOL_DEPTH / samplesPerRay;
    for (let k = 0; k < samplesPerRay; k++) {
      const z = VOL_START_Z + step * (k + 0.5);
      positions.push([rayOrigin[0], rayOrigin[1], z]);
    }
    return positions;
  }, [rayOrigin, samplesPerRay]);

  // Pulse the sample dots' scale for a "marching" animation.
  useFrame((state) => {
    if (!sampleGroupRef.current) return;
    const t = state.clock.elapsedTime;
    sampleGroupRef.current.children.forEach((child, k) => {
      const phase = (t * 1.5 - k * 0.08) % 2;
      const s = phase > 0 && phase < 0.5 ? 1.5 + phase : 0.9;
      child.scale.setScalar(s);
    });
  });

  return (
    <group position={[offsetX, 0, 0]}>
      {/* Label */}
      <mesh position={[0, GRID_HALF + 0.7, 0]}>
        <planeGeometry args={[2.2, 0.32]} />
        <meshBasicMaterial color="#2f81f7" transparent opacity={0.15} />
      </mesh>

      {/* Volume scatter (the thing the ray passes through) */}
      <group>
        {VOLUME_BOXES.map((b, i) => (
          <mesh key={i} position={b.pos}>
            <boxGeometry args={b.size} />
            <meshStandardMaterial color={b.color} transparent opacity={0.35} />
          </mesh>
        ))}
      </group>

      {/* Pixel grid on the image plane */}
      <group>
        {pixelPositions.map((p, idx) => {
          const i = idx % GRID_N;
          const j = Math.floor(idx / GRID_N);
          const isSelected = i === selectedPixel[0] && j === selectedPixel[1];
          return (
            <mesh
              key={idx}
              position={p}
              onClick={(e) => {
                e.stopPropagation();
                setSelectedPixel([i, j]);
              }}
              onPointerOver={(e) => {
                e.stopPropagation();
                document.body.style.cursor = 'pointer';
              }}
              onPointerOut={() => {
                document.body.style.cursor = 'default';
              }}
            >
              <sphereGeometry args={[isSelected ? 0.09 : 0.05, 12, 12]} />
              <meshStandardMaterial
                color={isSelected ? '#f7c948' : '#58a6ff'}
                emissive={isSelected ? '#f7c948' : '#000000'}
                emissiveIntensity={isSelected ? 0.6 : 0}
              />
            </mesh>
          );
        })}
      </group>

      {/* Ray line */}
      <RayLine
        from={rayOrigin}
        to={[rayOrigin[0], rayOrigin[1], VOL_START_Z + VOL_DEPTH]}
      />

      {/* Animated sample points */}
      <group ref={sampleGroupRef}>
        {samplePositions.map((p, k) => (
          <mesh key={k} position={p}>
            <sphereGeometry args={[0.04, 8, 8]} />
            <meshStandardMaterial color="#ff6b35" emissive="#ff6b35" emissiveIntensity={0.4} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

function RayLine({ from, to }: { from: Tuple3; to: Tuple3 }) {
  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute(
      'position',
      new THREE.Float32BufferAttribute([...from, ...to], 3),
    );
    return g;
  }, [from, to]);
  return (
    <line>
      <primitive object={geom} attach="geometry" />
      <lineBasicMaterial color="#f7c948" linewidth={2} transparent opacity={0.7} />
    </line>
  );
}
