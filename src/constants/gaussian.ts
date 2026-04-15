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
