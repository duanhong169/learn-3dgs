/** Linear interpolation between two values. */
export function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * t;
}

/** Clamp a value between min and max. */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Remap a value from one range to another. */
export function remap(
  value: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number,
): number {
  return outMin + ((value - inMin) / (inMax - inMin)) * (outMax - outMin);
}

/** Convert degrees to radians. */
export function degToRad(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/** Convert radians to degrees. */
export function radToDeg(radians: number): number {
  return (radians * 180) / Math.PI;
}

/** Euclidean distance between two 3D points. */
export function distance3(a: [number, number, number], b: [number, number, number]): number {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  const dz = a[2] - b[2];
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

// --- Matrix operations (row-major flat arrays) ---

import type { Matrix3, Matrix2 } from '@/types/gaussian';

/** Multiply two 3×3 matrices (row-major). */
export function multiply3x3(a: Matrix3, b: Matrix3): Matrix3 {
  return [
    a[0] * b[0] + a[1] * b[3] + a[2] * b[6],
    a[0] * b[1] + a[1] * b[4] + a[2] * b[7],
    a[0] * b[2] + a[1] * b[5] + a[2] * b[8],
    a[3] * b[0] + a[4] * b[3] + a[5] * b[6],
    a[3] * b[1] + a[4] * b[4] + a[5] * b[7],
    a[3] * b[2] + a[4] * b[5] + a[5] * b[8],
    a[6] * b[0] + a[7] * b[3] + a[8] * b[6],
    a[6] * b[1] + a[7] * b[4] + a[8] * b[7],
    a[6] * b[2] + a[7] * b[5] + a[8] * b[8],
  ];
}

/** Transpose a 3×3 matrix (row-major). */
export function transpose3x3(m: Matrix3): Matrix3 {
  return [
    m[0], m[3], m[6],
    m[1], m[4], m[7],
    m[2], m[5], m[8],
  ];
}

/**
 * Build a 3×3 rotation matrix from Euler angles (degrees), in XYZ order.
 * Returns row-major flat array.
 */
export function buildRotationMatrix(rx: number, ry: number, rz: number): Matrix3 {
  const cx = Math.cos(degToRad(rx));
  const sx = Math.sin(degToRad(rx));
  const cy = Math.cos(degToRad(ry));
  const sy = Math.sin(degToRad(ry));
  const cz = Math.cos(degToRad(rz));
  const sz = Math.sin(degToRad(rz));

  // R = Rz * Ry * Rx
  return [
    cy * cz, sx * sy * cz - cx * sz, cx * sy * cz + sx * sz,
    cy * sz, sx * sy * sz + cx * cz, cx * sy * sz - sx * cz,
    -sy,     sx * cy,                cx * cy,
  ];
}

/** Build a diagonal 3×3 scale matrix. */
export function buildScaleMatrix(sx: number, sy: number, sz: number): Matrix3 {
  return [
    sx, 0, 0,
    0, sy, 0,
    0, 0, sz,
  ];
}

/**
 * Build a 3×3 covariance matrix: Σ = R · S · Sᵀ · Rᵀ
 * where S is a diagonal scale matrix.
 */
export function buildCovarianceMatrix(
  scale: [number, number, number],
  rotation: [number, number, number],
): Matrix3 {
  const R = buildRotationMatrix(rotation[0], rotation[1], rotation[2]);
  const S = buildScaleMatrix(scale[0], scale[1], scale[2]);
  const RS = multiply3x3(R, S);
  const RSt = transpose3x3(RS);
  return multiply3x3(RS, RSt);
}

/** Multiply two 2×2 matrices (row-major). */
export function multiply2x2(a: Matrix2, b: Matrix2): Matrix2 {
  return [
    a[0] * b[0] + a[1] * b[2],
    a[0] * b[1] + a[1] * b[3],
    a[2] * b[0] + a[3] * b[2],
    a[2] * b[1] + a[3] * b[3],
  ];
}

/** Transpose a 2×2 matrix. */
export function transpose2x2(m: Matrix2): Matrix2 {
  return [m[0], m[2], m[1], m[3]];
}

/** Linearly interpolate between two Tuple3 values. */
export function lerpTuple3(
  a: [number, number, number],
  b: [number, number, number],
  t: number,
): [number, number, number] {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}
