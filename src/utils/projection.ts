import type { Matrix3, Matrix2 } from '@/types/gaussian';

/**
 * Compute the Jacobian of perspective projection at a given point.
 * Simplified: J = [[fx/z, 0, -fx*x/z²], [0, fy/z, -fy*y/z²]]
 * Returns a 2×3 matrix as flat 6 elements (row-major).
 */
export function computeProjectionJacobian(
  x: number,
  y: number,
  z: number,
  fx: number,
  fy: number,
): [number, number, number, number, number, number] {
  const z2 = z * z;
  return [
    fx / z, 0, -fx * x / z2,
    0, fy / z, -fy * y / z2,
  ];
}

/**
 * Project a 3D covariance matrix to 2D screen space.
 * Σ' = J · W · Σ · Wᵀ · Jᵀ
 *
 * For simplicity, we assume W (view matrix rotation part) = I,
 * so Σ' = J · Σ · Jᵀ
 *
 * J is 2×3, Σ is 3×3, result is 2×2.
 */
export function projectCovariance3Dto2D(
  cov3D: Matrix3,
  jacobian: [number, number, number, number, number, number],
): Matrix2 {
  // J (2×3) × Σ (3×3) = T (2×3)
  const j = jacobian;
  const s = cov3D;

  const t00 = j[0] * s[0] + j[1] * s[3] + j[2] * s[6];
  const t01 = j[0] * s[1] + j[1] * s[4] + j[2] * s[7];
  const t02 = j[0] * s[2] + j[1] * s[5] + j[2] * s[8];
  const t10 = j[3] * s[0] + j[4] * s[3] + j[5] * s[6];
  const t11 = j[3] * s[1] + j[4] * s[4] + j[5] * s[7];
  const t12 = j[3] * s[2] + j[4] * s[5] + j[5] * s[8];

  // T (2×3) × Jᵀ (3×2) = result (2×2)
  return [
    t00 * j[0] + t01 * j[1] + t02 * j[2],
    t00 * j[3] + t01 * j[4] + t02 * j[5],
    t10 * j[0] + t11 * j[1] + t12 * j[2],
    t10 * j[3] + t11 * j[4] + t12 * j[5],
  ];
}

/**
 * Decompose a 2×2 covariance matrix into ellipse parameters.
 * Returns { radiusX, radiusY, angle } where angle is in radians.
 */
export function covarianceToEllipse(cov: Matrix2): {
  radiusX: number;
  radiusY: number;
  angle: number;
} {
  const a = cov[0];
  const b = cov[1];
  const d = cov[3];

  // Eigenvalues via quadratic formula
  const trace = a + d;
  const det = a * d - b * b;
  const disc = Math.sqrt(Math.max(0, trace * trace / 4 - det));
  const lambda1 = trace / 2 + disc;
  const lambda2 = trace / 2 - disc;

  // Eigenvector angle
  const angle = Math.atan2(2 * b, a - d) / 2;

  // Radii = 2σ (95% confidence)
  return {
    radiusX: 2 * Math.sqrt(Math.max(0, lambda1)),
    radiusY: 2 * Math.sqrt(Math.max(0, lambda2)),
    angle,
  };
}

/**
 * Format a 2×2 matrix for display.
 */
export function formatMatrix2(m: Matrix2, decimals = 2): string[][] {
  return [
    [m[0].toFixed(decimals), m[1].toFixed(decimals)],
    [m[2].toFixed(decimals), m[3].toFixed(decimals)],
  ];
}
