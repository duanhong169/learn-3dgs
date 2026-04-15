import type { Tuple3 } from './common';

/** Parameters describing a single 3D Gaussian. */
export interface GaussianParams {
  position: Tuple3;
  scale: Tuple3;
  rotation: Tuple3;
  color: string;
  opacity: number;
}

/** A 3×3 matrix stored as a flat 9-element array (row-major). */
export type Matrix3 = [
  number, number, number,
  number, number, number,
  number, number, number,
];

/** A 2×2 matrix stored as a flat 4-element array (row-major). */
export type Matrix2 = [number, number, number, number];

/** Data for a single 2D splat used in alpha blending (Ch3). */
export interface SplatData {
  id: string;
  color: string;
  opacity: number;
  depth: number;
  positionX: number;
  scale: number;
}

/** A Gaussian in the optimization chapter (Ch4). */
export interface OptGaussian {
  id: string;
  position: Tuple3;
  scale: Tuple3;
  rotation: Tuple3;
  color: string;
  opacity: number;
  gradient: Tuple3;
  gradientMagnitude: number;
}
