/**
 * Helpers that support the Ch0 Intro visualizations. Kept in a non-component
 * file so HMR fast refresh stays happy, and so the overlay can compute the
 * "covering splat count" without rendering the scene.
 */

import { buildCovarianceMatrix } from '@/utils/math';
import {
  computeProjectionJacobian,
  projectCovariance3Dto2D,
  covarianceToEllipse,
} from '@/utils/projection';

import type { Tuple3 } from '@/types/common';

export const GRID_N = 6;
export const GRID_HALF = 1.2;
export const FX = 200;
export const FY = 200;
export const SPLAT_Z_FALLBACK = 3;

export interface SplatDef {
  pos: Tuple3;
  scale: Tuple3;
  rotation: Tuple3;
  color: string;
}

/** Deterministic RNG — shared across both vizzes so positions stay stable. */
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

/** 12 splats used by the Ch0 SplatProjectionViz — deterministic. */
export const INTRO_SPLATS: SplatDef[] = (() => {
  const rng = mulberry32(7777);
  const out: SplatDef[] = [];
  const palette = ['#ff6b35', '#f7c948', '#4ecdc4', '#a6cfe2', '#ffa07a', '#c9b8ff'];
  for (let i = 0; i < 12; i++) {
    out.push({
      pos: [
        (rng() - 0.5) * 1.8,
        (rng() - 0.5) * 1.8,
        1 + rng() * 2.5,
      ],
      scale: [0.22 + rng() * 0.22, 0.18 + rng() * 0.22, 0.18 + rng() * 0.22],
      rotation: [rng() * Math.PI, rng() * Math.PI, rng() * Math.PI],
      color: palette[Math.floor(rng() * palette.length)] ?? '#4ecdc4',
    });
  }
  return out;
})();

/**
 * Count how many intro splats cover the given pixel (approximated as
 * axis-aligned bbox coverage). Used by the overlay cost-counter badge.
 */
export function countCoveringSplats(selectedPixel: [number, number]): number {
  const step = (GRID_HALF * 2) / (GRID_N - 1);
  const px = (-GRID_HALF + selectedPixel[0] * step) * FX;
  const py = (-GRID_HALF + selectedPixel[1] * step) * FY;
  let covering = 0;
  for (const s of INTRO_SPLATS) {
    const cov3D = buildCovarianceMatrix(s.scale, s.rotation);
    const j = computeProjectionJacobian(s.pos[0], s.pos[1], s.pos[2] || SPLAT_Z_FALLBACK, FX, FY);
    const cov2D = projectCovariance3Dto2D(cov3D, j);
    const ell = covarianceToEllipse(cov2D);
    const sx = (FX * s.pos[0]) / s.pos[2];
    const sy = (FY * s.pos[1]) / s.pos[2];
    const dx = Math.abs(px - sx);
    const dy = Math.abs(py - sy);
    if (dx <= ell.radiusX * 2 && dy <= ell.radiusY * 2) covering++;
  }
  return covering;
}

/** Build the 6x6 pixel grid world-space positions. */
export function buildPixelGrid(): Tuple3[] {
  const out: Tuple3[] = [];
  const step = (GRID_HALF * 2) / (GRID_N - 1);
  for (let j = 0; j < GRID_N; j++) {
    for (let i = 0; i < GRID_N; i++) {
      out.push([-GRID_HALF + i * step, -GRID_HALF + j * step, 0]);
    }
  }
  return out;
}
