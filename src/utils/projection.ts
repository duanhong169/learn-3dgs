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
 * Project a 3D covariance matrix (in CAMERA space) to 2D screen space.
 * Σ_screen = J · Σ_cam · Jᵀ
 *
 * IMPORTANT: `cov3D` MUST already be expressed in camera space. If you have a
 * world-space covariance Σ_world, first rotate it into camera space with the
 * world→camera rotation W: Σ_cam = W · Σ_world · Wᵀ. See
 * {@link rotateCovariance3D} for a helper.
 *
 * Skipping the W rotation only works when the camera looks straight down the
 * world −Z axis; otherwise every Gaussian gets its depth axis confused with the
 * world Z axis and the reconstruction looks distorted (pancaked, sheared, etc).
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

/**
 * Rotate a world-space 3×3 covariance into camera space.
 * Σ_cam = W · Σ_world · Wᵀ
 *
 * W is the world→camera rotation. Its rows are the camera basis vectors
 * expressed in world coordinates: row0 = right, row1 = up, row2 = forward.
 * (This matches the convention used by `worldToCamera` elsewhere.)
 */
export function rotateCovariance3D(
  cov3DWorld: Matrix3,
  right: [number, number, number],
  up: [number, number, number],
  forward: [number, number, number],
): Matrix3 {
  // W (3×3, row-major): rows = right, up, forward
  const w00 = right[0],   w01 = right[1],   w02 = right[2];
  const w10 = up[0],      w11 = up[1],      w12 = up[2];
  const w20 = forward[0], w21 = forward[1], w22 = forward[2];

  const s = cov3DWorld;

  // T = W · Σ (3×3)
  const t00 = w00 * s[0] + w01 * s[3] + w02 * s[6];
  const t01 = w00 * s[1] + w01 * s[4] + w02 * s[7];
  const t02 = w00 * s[2] + w01 * s[5] + w02 * s[8];
  const t10 = w10 * s[0] + w11 * s[3] + w12 * s[6];
  const t11 = w10 * s[1] + w11 * s[4] + w12 * s[7];
  const t12 = w10 * s[2] + w11 * s[5] + w12 * s[8];
  const t20 = w20 * s[0] + w21 * s[3] + w22 * s[6];
  const t21 = w20 * s[1] + w21 * s[4] + w22 * s[7];
  const t22 = w20 * s[2] + w21 * s[5] + w22 * s[8];

  // Σ_cam = T · Wᵀ (3×3). Wᵀ columns = rows of W.
  return [
    t00 * w00 + t01 * w01 + t02 * w02,
    t00 * w10 + t01 * w11 + t02 * w12,
    t00 * w20 + t01 * w21 + t02 * w22,
    t10 * w00 + t11 * w01 + t12 * w02,
    t10 * w10 + t11 * w11 + t12 * w12,
    t10 * w20 + t11 * w21 + t12 * w22,
    t20 * w00 + t21 * w01 + t22 * w02,
    t20 * w10 + t21 * w11 + t22 * w12,
    t20 * w20 + t21 * w21 + t22 * w22,
  ];
}
