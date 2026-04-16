import type { Tuple3 } from '@/types/common';
import type { GaussianParams } from '@/types/gaussian';

/** Default parameters for a single 3D Gaussian. */
export const DEFAULT_GAUSSIAN: GaussianParams = {
  position: [0, 0, 0],
  scale: [1.5, 0.6, 1],
  rotation: [0, 0, 0],
  color: '#4ecdc4',
  opacity: 0.7,
};

/** Slider bounds for Gaussian scale axes. */
export const SCALE_RANGE = { min: 0.1, max: 3.0, step: 0.05 } as const;

/** Slider bounds for Gaussian rotation axes (degrees). */
export const ROTATION_RANGE = { min: 0, max: 360, step: 1 } as const;

/** Slider bounds for opacity. */
export const OPACITY_RANGE = { min: 0, max: 1, step: 0.01 } as const;

/** Default splat colors for Ch3 alpha blending. */
export const SPLAT_COLORS = ['#ff6b35', '#4ecdc4', '#a855f7', '#ffe66d', '#f43f5e', '#3fb950', '#58a6ff'] as const;

/** Initial splat depths for Ch3. */
export const INITIAL_SPLAT_DEPTHS = [1, 2, 3, 4, 5] as const;

/** Target shapes for Ch4 optimization ground truth. */
export const OPTIMIZATION_TARGETS: Array<{
  position: Tuple3;
  scale: Tuple3;
  color: string;
  type: 'sphere' | 'box' | 'cylinder';
}> = [
  { position: [-2, 0, 0], scale: [1, 1, 1], color: '#f85149', type: 'sphere' },
  { position: [0, 0, 0], scale: [0.8, 0.8, 0.8], color: '#58a6ff', type: 'box' },
  { position: [2, 0, 0], scale: [0.6, 1.2, 0.6], color: '#3fb950', type: 'cylinder' },
];

/** Number of initial random Gaussians for Ch4. */
export const INITIAL_GAUSSIAN_COUNT = 20;

/** Opacity threshold below which Gaussians get pruned in Ch4. */
export const DEFAULT_PRUNE_THRESHOLD = 0.05;

/**
 * SH coefficient presets for demonstrating view-dependent color.
 * Each preset is an array of 16 [r, g, b] triplets (one per SH basis function).
 * Values are in "logit" space — the shader applies sigmoid to map to [0,1].
 */
export interface SHPreset {
  name: string;
  label: string;
  description: string;
  order: number;
  coeffs: Array<[number, number, number]>;
}

function pad16(coeffs: Array<[number, number, number]>): Array<[number, number, number]> {
  const result = [...coeffs];
  while (result.length < 16) result.push([0, 0, 0]);
  return result;
}

export const SH_PRESETS: SHPreset[] = [
  {
    name: 'metallic',
    label: '金属光泽',
    description: '正面暖色，侧面冷色',
    order: 1,
    coeffs: pad16([
      [1.5, 0.8, 0.2],   // DC: warm base
      [0.0, 0.0, 0.0],   // Y
      [0.8, -0.5, 1.5],  // Z: blue shift when viewed from top/bottom
      [-1.0, 0.5, 1.2],  // X: cool shift from side
    ]),
  },
  {
    name: 'rainbow',
    label: '彩虹',
    description: '各方向不同色相',
    order: 2,
    coeffs: pad16([
      [0.5, 0.5, 0.5],   // DC: neutral
      [2.0, -1.0, 0.0],  // Y: red-cyan gradient vertical
      [0.0, 1.5, -1.5],  // Z: green-magenta gradient depth
      [-1.5, 0.0, 2.0],  // X: blue-yellow gradient horizontal
      [0.8, 0.8, -0.8],  // XY
      [-0.5, 0.8, 0.5],  // YZ
      [0.0, 0.0, 0.0],   // 3Z²-1
      [0.5, -0.5, 0.8],  // XZ
      [0.8, -0.8, 0.0],  // X²-Y²
    ]),
  },
  {
    name: 'backlit',
    label: '背光效果',
    description: '前亮后暗，模拟单向光照',
    order: 1,
    coeffs: pad16([
      [0.8, 0.9, 1.0],   // DC: cool white base
      [0.0, 0.0, 0.0],   // Y
      [2.0, 1.8, 1.5],   // Z: bright facing camera, dark away
      [0.0, 0.0, 0.0],   // X
    ]),
  },
  {
    name: 'iridescent',
    label: '虹彩',
    description: '类似肥皂泡的角度依赖色彩',
    order: 3,
    coeffs: pad16([
      [0.6, 0.6, 0.6],   // DC
      [1.2, -0.8, 0.3],  // l=1
      [-0.3, 1.0, -0.8],
      [0.5, 0.3, 1.5],
      [0.6, -0.6, 0.4],  // l=2
      [-0.4, 0.7, -0.3],
      [0.2, -0.2, 0.5],
      [0.5, 0.3, -0.7],
      [-0.3, 0.5, 0.6],
      [0.4, -0.3, 0.2],  // l=3
      [-0.2, 0.4, -0.3],
      [0.3, -0.2, 0.4],
      [0.0, 0.3, -0.2],
      [-0.3, 0.0, 0.3],
      [0.2, -0.3, 0.0],
      [0.1, 0.2, -0.1],
    ]),
  },
];
