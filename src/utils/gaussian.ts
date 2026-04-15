import type { Matrix3 } from '@/types/gaussian';

/**
 * Evaluate a 3D Gaussian density at a point relative to the center.
 * Returns a value in [0, 1] where 1 = at the center.
 *
 * Note: for visualization purposes, we use the simplified isotropic
 * distance check with the scale as radii, ignoring full inverse covariance.
 */
export function evaluateGaussianDensity(
  dx: number,
  dy: number,
  dz: number,
  sx: number,
  sy: number,
  sz: number,
): number {
  const r2 = (dx * dx) / (sx * sx) + (dy * dy) / (sy * sy) + (dz * dz) / (sz * sz);
  return Math.exp(-0.5 * r2);
}

/**
 * Generate N random sample points from a 3D Gaussian distribution.
 * Uses Box-Muller transform for normal distribution sampling.
 */
export function sampleGaussian3D(
  scale: [number, number, number],
  count: number,
): Array<[number, number, number]> {
  const points: Array<[number, number, number]> = [];

  for (let i = 0; i < count; i++) {
    // Box-Muller for 3 independent normals
    const u1 = Math.random();
    const u2 = Math.random();
    const u3 = Math.random();
    const u4 = Math.random();
    const u5 = Math.random();
    const u6 = Math.random();

    const z1 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    const z2 = Math.sqrt(-2 * Math.log(u3)) * Math.cos(2 * Math.PI * u4);
    const z3 = Math.sqrt(-2 * Math.log(u5)) * Math.cos(2 * Math.PI * u6);

    points.push([z1 * scale[0], z2 * scale[1], z3 * scale[2]]);
  }

  return points;
}

/**
 * Format a 3×3 matrix as a 2D array of rounded strings for display.
 */
export function formatMatrix3(m: Matrix3, decimals = 2): string[][] {
  return [
    [m[0].toFixed(decimals), m[1].toFixed(decimals), m[2].toFixed(decimals)],
    [m[3].toFixed(decimals), m[4].toFixed(decimals), m[5].toFixed(decimals)],
    [m[6].toFixed(decimals), m[7].toFixed(decimals), m[8].toFixed(decimals)],
  ];
}
