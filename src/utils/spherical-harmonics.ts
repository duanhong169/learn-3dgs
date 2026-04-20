/**
 * Real-valued Spherical Harmonics (SH) up to order L=2 (9 basis functions).
 *
 * For a unit direction d = (x, y, z) on the sphere, the 9 real SH basis are:
 *
 *   i  (l, m)   Y_i(d)
 *   ──────────────────────────────────────────────
 *   0  (0,  0)  C0                                 C0 = 1 / (2·√π)        ≈ 0.282095
 *   1  (1, −1)  C1 · y                              C1 = √(3 / (4π))       ≈ 0.488603
 *   2  (1,  0)  C1 · z
 *   3  (1,  1)  C1 · x
 *   4  (2, −2)  C2a · x · y                         C2a = √(15 / (4π))     ≈ 1.092548
 *   5  (2, −1)  C2a · y · z
 *   6  (2,  0)  C2b · (3·z² − 1)                    C2b = √(5 / (16π))     ≈ 0.315392
 *   7  (2,  1)  C2a · x · z
 *   8  (2,  2)  C2c · (x² − y²)                     C2c = √(15 / (16π))    ≈ 0.546274
 *
 * Each color channel is projected onto this 9-dim space independently, so a full
 * RGB splat stores 27 coefficients, laid out as [R0..R8, G0..G8, B0..B8] in a
 * single Float32Array (`shCoefficients`).
 *
 * Monte-Carlo projection: given N uniformly sampled directions ω on the sphere
 * and a target color function f(ω), the i-th coefficient is estimated as
 *   c_i ≈ (4π / N) · Σ f(ω_j) · Y_i(ω_j)
 * (The basis is orthonormal, so this is unbiased and numerically well-conditioned.)
 */

import type { Tuple3, ColorRGB } from '@/types/common';
import type { ReconGaussian } from '@/utils/reconstruction';

export const SH_ORDER = 2 as const;
export const SH_COEFFS = 9 as const;
export const SH_TOTAL_FLOATS = SH_COEFFS * 3; // 27 (R|G|B)

// Basis normalization constants
const C0 = 0.28209479177387814; // 1 / (2·√π)
const C1 = 0.4886025119029199; // √(3 / (4π))
const C2a = 1.0925484305920792; // √(15 / (4π))
const C2b = 0.31539156525252005; // √(5 / (16π))
const C2c = 0.5462742152960396; // √(15 / (16π))

/**
 * Evaluate all 9 SH basis functions at a unit direction.
 * Caller must pass a normalized vector; results are otherwise scaled incorrectly.
 */
export function evaluateSHBasis(d: Tuple3): number[] {
  const x = d[0];
  const y = d[1];
  const z = d[2];
  return [
    C0, // Y_0,0
    C1 * y, // Y_1,-1
    C1 * z, // Y_1,0
    C1 * x, // Y_1,1
    C2a * x * y, // Y_2,-2
    C2a * y * z, // Y_2,-1
    C2b * (3 * z * z - 1), // Y_2,0
    C2a * x * z, // Y_2,1
    C2c * (x * x - y * y), // Y_2,2
  ];
}

/**
 * Reconstruct an RGB color from SH coefficients for a given view direction.
 *
 * Coefficient layout (length 27):
 *   [R0..R8, G0..G8, B0..B8]
 *
 * Colors are not clamped — callers that render to a display should clamp/tone-map.
 */
export function evaluateSH(coeffs: Float32Array, d: Tuple3): ColorRGB {
  const basis = evaluateSHBasis(d);
  let r = 0;
  let g = 0;
  let b = 0;
  for (let i = 0; i < SH_COEFFS; i++) {
    const bi = basis[i]!;
    r += coeffs[i]! * bi;
    g += coeffs[SH_COEFFS + i]! * bi;
    b += coeffs[2 * SH_COEFFS + i]! * bi;
  }
  return [r, g, b];
}

/**
 * Project a set of direction-color samples onto the L=2 SH basis.
 *
 * Assumes samples are approximately uniform on the unit sphere (e.g., from a
 * Fibonacci lattice). Returns a Float32Array of 27 coefficients in the layout
 * [R0..R8, G0..G8, B0..B8].
 */
export function bakeSHFromSamples(
  samples: Array<{ dir: Tuple3; color: ColorRGB }>,
): Float32Array {
  const coeffs = new Float32Array(SH_TOTAL_FLOATS);
  if (samples.length === 0) return coeffs;

  const weight = (4 * Math.PI) / samples.length;
  for (const { dir, color } of samples) {
    const basis = evaluateSHBasis(dir);
    for (let i = 0; i < SH_COEFFS; i++) {
      const yi = basis[i]! * weight;
      coeffs[i]! += color[0] * yi;
      coeffs[SH_COEFFS + i]! += color[1] * yi;
      coeffs[2 * SH_COEFFS + i]! += color[2] * yi;
    }
  }
  return coeffs;
}

/**
 * Iterative variant of SH projection used for the baking animation. Splits the
 * work into `maxIters` chunks; after each chunk `onStep` is called with the
 * current coefficient estimate and the residual (mean-squared reconstruction
 * error over the consumed samples).
 *
 * Because Monte-Carlo projection is already a single-pass algorithm, this
 * simply reveals the partial sum progressively — intuition for "more data →
 * better estimate", not a gradient descent.
 */
export function bakeSHIterative(
  samples: Array<{ dir: Tuple3; color: ColorRGB }>,
  maxIters: number,
  onStep?: (iter: number, residual: number, coeffs: Float32Array) => void,
): Float32Array {
  const coeffs = new Float32Array(SH_TOTAL_FLOATS);
  if (samples.length === 0 || maxIters <= 0) return coeffs;

  const total = 4 * Math.PI;
  const iters = Math.min(maxIters, samples.length);
  const chunkSize = Math.max(1, Math.floor(samples.length / iters));

  let consumed = 0;
  for (let iter = 0; iter < iters; iter++) {
    const end = iter === iters - 1 ? samples.length : Math.min(samples.length, consumed + chunkSize);
    const newWeight = total / (end > 0 ? end : 1);

    // Rescale existing partial sum to the new (larger) denominator, then add
    // contributions from the newly consumed samples at the same weight.
    if (consumed > 0) {
      const oldWeight = total / consumed;
      const rescale = newWeight / oldWeight;
      for (let i = 0; i < SH_TOTAL_FLOATS; i++) coeffs[i]! *= rescale;
    }

    for (let s = consumed; s < end; s++) {
      const { dir, color } = samples[s]!;
      const basis = evaluateSHBasis(dir);
      for (let i = 0; i < SH_COEFFS; i++) {
        const yi = basis[i]! * newWeight;
        coeffs[i]! += color[0] * yi;
        coeffs[SH_COEFFS + i]! += color[1] * yi;
        coeffs[2 * SH_COEFFS + i]! += color[2] * yi;
      }
    }
    consumed = end;

    // Residual = mean-squared error between observed and reconstructed color
    let errSum = 0;
    for (let s = 0; s < consumed; s++) {
      const { dir, color } = samples[s]!;
      const [rr, gg, bb] = evaluateSH(coeffs, dir);
      const dr = rr - color[0];
      const dg = gg - color[1];
      const db = bb - color[2];
      errSum += dr * dr + dg * dg + db * db;
    }
    const residual = Math.sqrt(errSum / (consumed * 3));
    onStep?.(iter, residual, coeffs);
  }
  return coeffs;
}

/**
 * Generate `n` directions approximately uniformly distributed on the unit
 * sphere using the Fibonacci lattice (golden-angle spiral). Deterministic and
 * low-discrepancy, useful for both baking and quality-control tests.
 */
export function fibonacciSphere(n: number): Tuple3[] {
  const out: Tuple3[] = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const z = 1 - (2 * (i + 0.5)) / n;
    const r = Math.sqrt(Math.max(0, 1 - z * z));
    const theta = golden * i;
    out.push([Math.cos(theta) * r, Math.sin(theta) * r, z]);
  }
  return out;
}

/**
 * A Gaussian carrying SH-encoded view-dependent color. Extends the reconstruction
 * chapter's Gaussian with a surface normal and per-channel SH coefficients so
 * the same instancing / projection infrastructure can be reused.
 */
export interface SHGaussian extends ReconGaussian {
  /** Unit surface normal at the splat position (world space). */
  normal: Tuple3;
  /** 27 floats: [R0..R8, G0..G8, B0..B8]. */
  shCoefficients: Float32Array;
  /** Material id this splat was baked from. */
  materialId: 'diffuse' | 'glossy' | 'metallic';
}
