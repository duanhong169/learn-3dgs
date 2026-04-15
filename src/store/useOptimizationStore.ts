import { create } from 'zustand';

import { OPTIMIZATION_TARGETS, INITIAL_GAUSSIAN_COUNT, DEFAULT_PRUNE_THRESHOLD } from '@/constants/gaussian';
import { lerp } from '@/utils/math';

import type { Tuple3 } from '@/types/common';
import type { OptGaussian } from '@/types/gaussian';

function randomInRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function createRandomGaussians(count: number): OptGaussian[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `gaussian-${i}`,
    position: [randomInRange(-4, 4), randomInRange(-1, 2), randomInRange(-4, 4)] as Tuple3,
    scale: [randomInRange(0.3, 1.5), randomInRange(0.3, 1.5), randomInRange(0.3, 1.5)] as Tuple3,
    rotation: [randomInRange(0, 360), randomInRange(0, 360), randomInRange(0, 360)] as Tuple3,
    color: `#${Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0')}`,
    opacity: randomInRange(0.3, 0.9),
    gradient: [0, 0, 0] as Tuple3,
    gradientMagnitude: 0,
  }));
}

/** Compute a mock gradient for a Gaussian toward the nearest target. */
function computeMockGradient(g: OptGaussian): { gradient: Tuple3; magnitude: number } {
  let nearestDist = Infinity;
  let nearestTarget = OPTIMIZATION_TARGETS[0]!;

  for (const target of OPTIMIZATION_TARGETS) {
    const dx = target.position[0] - g.position[0];
    const dy = target.position[1] - g.position[1];
    const dz = target.position[2] - g.position[2];
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (dist < nearestDist) {
      nearestDist = dist;
      nearestTarget = target;
    }
  }

  const dx = nearestTarget.position[0] - g.position[0];
  const dy = nearestTarget.position[1] - g.position[1];
  const dz = nearestTarget.position[2] - g.position[2];
  const magnitude = Math.sqrt(dx * dx + dy * dy + dz * dz);

  if (magnitude < 0.01) return { gradient: [0, 0, 0], magnitude: 0 };

  return {
    gradient: [dx / magnitude, dy / magnitude, dz / magnitude] as Tuple3,
    magnitude,
  };
}

interface OptimizationState {
  gaussians: OptGaussian[];
  step: number;
  loss: number[];
  isAutoRunning: boolean;
  autoRunSpeed: number;
  showGradients: boolean;
  pruneThreshold: number;

  runStep: () => void;
  toggleAutoRun: () => void;
  setAutoRunSpeed: (s: number) => void;
  triggerSplit: () => void;
  triggerClone: () => void;
  triggerPrune: () => void;
  toggleGradients: () => void;
  setPruneThreshold: (t: number) => void;
  reset: () => void;
}

export const useOptimizationStore = create<OptimizationState>((set, get) => ({
  gaussians: createRandomGaussians(INITIAL_GAUSSIAN_COUNT),
  step: 0,
  loss: [1.0],
  isAutoRunning: false,
  autoRunSpeed: 1,
  showGradients: true,
  pruneThreshold: DEFAULT_PRUNE_THRESHOLD,

  runStep: () => {
    const { gaussians, step, loss } = get();
    const learningRate = 0.08;

    const updated = gaussians.map((g) => {
      const { gradient, magnitude } = computeMockGradient(g);

      // Find nearest target for color/opacity interpolation
      let nearestTarget = OPTIMIZATION_TARGETS[0]!;
      let nearestDist = Infinity;
      for (const target of OPTIMIZATION_TARGETS) {
        const d = Math.sqrt(
          (target.position[0] - g.position[0]) ** 2 +
          (target.position[1] - g.position[1]) ** 2 +
          (target.position[2] - g.position[2]) ** 2,
        );
        if (d < nearestDist) {
          nearestDist = d;
          nearestTarget = target;
        }
      }

      return {
        ...g,
        position: [
          g.position[0] + gradient[0] * learningRate * Math.min(magnitude, 2),
          g.position[1] + gradient[1] * learningRate * Math.min(magnitude, 2),
          g.position[2] + gradient[2] * learningRate * Math.min(magnitude, 2),
        ] as Tuple3,
        scale: [
          lerp(g.scale[0], nearestTarget.scale[0], 0.02),
          lerp(g.scale[1], nearestTarget.scale[1], 0.02),
          lerp(g.scale[2], nearestTarget.scale[2], 0.02),
        ] as Tuple3,
        opacity: lerp(g.opacity, nearestDist < 2 ? 0.8 : 0.1, 0.03),
        gradient,
        gradientMagnitude: magnitude,
      };
    });

    // Compute mock loss
    const avgDist = updated.reduce((sum, g) => {
      let minDist = Infinity;
      for (const t of OPTIMIZATION_TARGETS) {
        const d = Math.sqrt(
          (t.position[0] - g.position[0]) ** 2 +
          (t.position[1] - g.position[1]) ** 2 +
          (t.position[2] - g.position[2]) ** 2,
        );
        minDist = Math.min(minDist, d);
      }
      return sum + minDist;
    }, 0) / updated.length;

    const newLoss = Math.max(0, avgDist / 5);

    set({
      gaussians: updated,
      step: step + 1,
      loss: [...loss, newLoss],
    });
  },

  toggleAutoRun: () => set((s) => ({ isAutoRunning: !s.isAutoRunning })),
  setAutoRunSpeed: (speed) => set({ autoRunSpeed: speed }),

  triggerSplit: () => {
    const { gaussians } = get();
    // Find the largest Gaussian with high gradient
    const candidates = gaussians
      .filter((g) => g.gradientMagnitude > 0.5 && Math.max(...g.scale) > 0.5)
      .sort((a, b) => Math.max(...b.scale) - Math.max(...a.scale));

    const target = candidates[0];
    if (!target) return;

    const offset = 0.3;
    const newScale: Tuple3 = [target.scale[0] * 0.7, target.scale[1] * 0.7, target.scale[2] * 0.7];

    const gaussian1: OptGaussian = {
      ...target,
      id: `gaussian-${Date.now()}-a`,
      position: [target.position[0] - offset, target.position[1], target.position[2]] as Tuple3,
      scale: newScale,
    };
    const gaussian2: OptGaussian = {
      ...target,
      id: `gaussian-${Date.now()}-b`,
      position: [target.position[0] + offset, target.position[1], target.position[2]] as Tuple3,
      scale: newScale,
    };

    set({
      gaussians: gaussians.filter((g) => g.id !== target.id).concat([gaussian1, gaussian2]),
    });
  },

  triggerClone: () => {
    const { gaussians } = get();
    const candidates = gaussians
      .filter((g) => g.gradientMagnitude > 0.3 && Math.max(...g.scale) < 1.0)
      .sort((a, b) => b.gradientMagnitude - a.gradientMagnitude);

    const target = candidates[0];
    if (!target) return;

    const clone: OptGaussian = {
      ...target,
      id: `gaussian-${Date.now()}-clone`,
      position: [
        target.position[0] + target.gradient[0] * 0.3,
        target.position[1] + target.gradient[1] * 0.3,
        target.position[2] + target.gradient[2] * 0.3,
      ] as Tuple3,
    };

    set({ gaussians: [...gaussians, clone] });
  },

  triggerPrune: () => {
    const { gaussians, pruneThreshold } = get();
    set({
      gaussians: gaussians.filter((g) => g.opacity > pruneThreshold),
    });
  },

  toggleGradients: () => set((s) => ({ showGradients: !s.showGradients })),
  setPruneThreshold: (t) => set({ pruneThreshold: t }),

  reset: () =>
    set({
      gaussians: createRandomGaussians(INITIAL_GAUSSIAN_COUNT),
      step: 0,
      loss: [1.0],
      isAutoRunning: false,
      showGradients: true,
    }),
}));
