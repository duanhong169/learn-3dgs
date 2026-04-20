import { describe, it, expect } from 'vitest';

import {
  evaluateSHBasis,
  evaluateSH,
  bakeSHFromSamples,
  fibonacciSphere,
  SH_COEFFS,
  SH_TOTAL_FLOATS,
} from '@/utils/spherical-harmonics';

import type { Tuple3, ColorRGB } from '@/types/common';

const C0 = 0.28209479177387814;
const C1 = 0.4886025119029199;

function maxAbsDiff(a: ArrayLike<number>, b: ArrayLike<number>): number {
  let m = 0;
  for (let i = 0; i < a.length; i++) m = Math.max(m, Math.abs(a[i]! - b[i]!));
  return m;
}

describe('evaluateSHBasis', () => {
  it('Y_0,0 is the constant C0', () => {
    const b = evaluateSHBasis([0, 1, 0]);
    expect(b[0]!).toBeCloseTo(C0, 10);
  });

  it('Y_1,-1 at +Y equals C1', () => {
    const b = evaluateSHBasis([0, 1, 0]);
    expect(b[1]!).toBeCloseTo(C1, 10);
    expect(b[2]!).toBeCloseTo(0, 10);
    expect(b[3]!).toBeCloseTo(0, 10);
  });

  it('Y_1,0 at +Z equals C1', () => {
    const b = evaluateSHBasis([0, 0, 1]);
    expect(b[2]!).toBeCloseTo(C1, 10);
  });

  it('Y_1,1 at +X equals C1', () => {
    const b = evaluateSHBasis([1, 0, 0]);
    expect(b[3]!).toBeCloseTo(C1, 10);
  });
});

describe('evaluateSH', () => {
  it('returns zero color for zero coefficients', () => {
    const coeffs = new Float32Array(SH_TOTAL_FLOATS);
    const [r, g, b] = evaluateSH(coeffs, [0, 1, 0]);
    expect(r).toBeCloseTo(0, 10);
    expect(g).toBeCloseTo(0, 10);
    expect(b).toBeCloseTo(0, 10);
  });

  it('DC term reconstructs a uniform color scaled by C0', () => {
    // If only the L=0 coefficient is non-zero, output = c_0 * C0 regardless of direction
    const coeffs = new Float32Array(SH_TOTAL_FLOATS);
    coeffs[0] = 1 / C0; // R_0
    coeffs[SH_COEFFS] = 2 / C0; // G_0
    coeffs[2 * SH_COEFFS] = 3 / C0; // B_0

    const dirs: Tuple3[] = [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
      [0.577, 0.577, 0.577],
    ];
    for (const d of dirs) {
      const [r, g, b] = evaluateSH(coeffs, d);
      // Float32 precision is ~1e-7; tighter bounds would be noise, not signal.
      expect(r).toBeCloseTo(1, 6);
      expect(g).toBeCloseTo(2, 6);
      expect(b).toBeCloseTo(3, 6);
    }
  });
});

describe('bakeSHFromSamples round-trip', () => {
  it('recovers a known constant color (DC only)', () => {
    const dirs = fibonacciSphere(512);
    const constantColor: ColorRGB = [0.4, 0.7, 0.2];
    const samples = dirs.map((dir) => ({ dir, color: constantColor }));

    const coeffs = bakeSHFromSamples(samples);

    // The DC coefficient should equal color * (1/C0) = color * 2√π
    const dcFactor = 1 / C0;
    expect(coeffs[0]!).toBeCloseTo(constantColor[0] * dcFactor, 3);
    expect(coeffs[SH_COEFFS]!).toBeCloseTo(constantColor[1] * dcFactor, 3);
    expect(coeffs[2 * SH_COEFFS]!).toBeCloseTo(constantColor[2] * dcFactor, 3);

    // Higher-order coefficients should be ~0
    for (let i = 1; i < SH_COEFFS; i++) {
      expect(Math.abs(coeffs[i]!)).toBeLessThan(0.02);
      expect(Math.abs(coeffs[SH_COEFFS + i]!)).toBeLessThan(0.02);
      expect(Math.abs(coeffs[2 * SH_COEFFS + i]!)).toBeLessThan(0.02);
    }
  });

  it('closure test: fit a synthesized SH function, recover coefficients', () => {
    // Start from a known coefficient vector
    const truth = new Float32Array(SH_TOTAL_FLOATS);
    for (let i = 0; i < SH_TOTAL_FLOATS; i++) {
      // Arbitrary pattern with a mix of low- and high-order terms
      truth[i] = Math.sin(i * 0.73) * 0.4 + 0.1;
    }

    // Synthesize samples on a dense Fibonacci grid
    const dirs = fibonacciSphere(4096);
    const samples = dirs.map((dir) => ({
      dir,
      color: evaluateSH(truth, dir) as ColorRGB,
    }));

    const fit = bakeSHFromSamples(samples);
    expect(maxAbsDiff(fit, truth)).toBeLessThan(5e-3);
  });
});

describe('fibonacciSphere', () => {
  it('produces unit-length vectors', () => {
    const pts = fibonacciSphere(128);
    for (const p of pts) {
      const len = Math.sqrt(p[0] * p[0] + p[1] * p[1] + p[2] * p[2]);
      expect(len).toBeCloseTo(1, 3);
    }
  });

  it('produces distinct points', () => {
    const pts = fibonacciSphere(64);
    expect(new Set(pts.map((p) => `${p[0].toFixed(5)},${p[1].toFixed(5)}`)).size).toBe(64);
  });
});
