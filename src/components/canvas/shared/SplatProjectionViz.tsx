import { useMemo } from 'react';
import * as THREE from 'three';

import { GaussianEllipsoid } from '@/components/canvas/shared/GaussianEllipsoid';
import { useIntroStore } from '@/store/useIntroStore';
import { computeProjectionJacobian, projectCovariance3Dto2D, covarianceToEllipse } from '@/utils/projection';
import { buildCovarianceMatrix } from '@/utils/math';
import {
  INTRO_SPLATS,
  FX,
  FY,
  SPLAT_Z_FALLBACK,
  GRID_HALF,
  GRID_N,
  buildPixelGrid,
} from './introShared';

import type { Tuple3 } from '@/types/common';

export interface SplatProjectionVizProps {
  offsetX: number;
}

/**
 * Right-panel 3DGS visualization: 12 ellipsoids + pixel grid.
 * The selected pixel draws highlight lines only to the splats whose 2D
 * projection covers that pixel — showing the O(overlapping splat) cost
 * instead of O(samples per ray).
 */
export function SplatProjectionViz({ offsetX }: SplatProjectionVizProps) {
  const selectedPixel = useIntroStore((s) => s.selectedPixel);
  const setSelectedPixel = useIntroStore((s) => s.setSelectedPixel);

  const pixelPositions = useMemo<Tuple3[]>(() => buildPixelGrid(), []);

  // Selected pixel in world coords on the image plane.
  const selectedPixelWorld = useMemo<[number, number]>(() => {
    const step = (GRID_HALF * 2) / (GRID_N - 1);
    return [
      -GRID_HALF + selectedPixel[0] * step,
      -GRID_HALF + selectedPixel[1] * step,
    ];
  }, [selectedPixel]);

  // For each splat: compute its 2D ellipse (via J + Σ3D → Σ2D), then check
  // whether the selected pixel lies within ~3σ (in world units).
  const coveringMask = useMemo(() => {
    return INTRO_SPLATS.map((s) => {
      const cov3D = buildCovarianceMatrix(s.scale, s.rotation);
      const j = computeProjectionJacobian(s.pos[0], s.pos[1], s.pos[2] || SPLAT_Z_FALLBACK, FX, FY);
      const cov2D = projectCovariance3Dto2D(cov3D, j);
      const ell = covarianceToEllipse(cov2D);
      const sx = (FX * s.pos[0]) / s.pos[2];
      const sy = (FY * s.pos[1]) / s.pos[2];
      const px = selectedPixelWorld[0] * FX;
      const py = selectedPixelWorld[1] * FY;
      const dx = Math.abs(px - sx);
      const dy = Math.abs(py - sy);
      return dx <= ell.radiusX * 2 && dy <= ell.radiusY * 2;
    });
  }, [selectedPixelWorld]);

  return (
    <group position={[offsetX, 0, 0]}>
      {/* Label backdrop */}
      <mesh position={[0, GRID_HALF + 0.7, 0]}>
        <planeGeometry args={[2.2, 0.32]} />
        <meshBasicMaterial color="#f78166" transparent opacity={0.15} />
      </mesh>

      {/* Splats */}
      {INTRO_SPLATS.map((s, i) => (
        <GaussianEllipsoid
          key={i}
          position={s.pos}
          scale={s.scale}
          rotation={s.rotation}
          color={s.color}
          opacity={coveringMask[i] ? 0.85 : 0.35}
        />
      ))}

      {/* Highlight lines from covering splats to the selected pixel */}
      {INTRO_SPLATS.map((s, i) =>
        coveringMask[i] ? (
          <HighlightLine
            key={`line-${i}`}
            from={s.pos}
            to={[selectedPixelWorld[0], selectedPixelWorld[1], 0]}
          />
        ) : null,
      )}

      {/* Pixel grid */}
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
  );
}

function HighlightLine({ from, to }: { from: Tuple3; to: Tuple3 }) {
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
      <lineBasicMaterial color="#f7c948" transparent opacity={0.8} />
    </line>
  );
}
