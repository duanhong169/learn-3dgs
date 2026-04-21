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

/** Interval (in steps) between automatic adaptive density control. */
const DENSIFY_INTERVAL = 10;
/** Max number of Gaussians to prevent runaway growth. */
const MAX_GAUSSIANS = 60;

interface OptimizationState {
  gaussians: OptGaussian[];
  step: number;
  /** Total combined loss history (backwards-compatible — still provided for existing callers). */
  loss: number[];
  /** L1 loss component history. */
  l1Loss: number[];
  /** D-SSIM loss component history. */
  dssimLoss: number[];
  /** Weighting between L1 and D-SSIM: total = (1-λ)·L1 + λ·D-SSIM. Paper default 0.2. */
  lambdaDssim: number;
  /** Iteration interval between automatic opacity resets. Paper uses 3000; demo-friendly default is 300. */
  resetInterval: number;
  /** Remaining steps until the next automatic opacity reset. */
  opacityResetCountdown: number;
  /** How many opacity resets have been triggered (manual + automatic). */
  opacityResetsTriggered: number;

  isAutoRunning: boolean;
  autoRunSpeed: number;
  showGradients: boolean;
  pruneThreshold: number;
  /** Whether auto density control runs during optimization. */
  autoDensify: boolean;

  runStep: () => void;
  toggleAutoRun: () => void;
  setAutoRunSpeed: (s: number) => void;
  triggerSplit: () => void;
  triggerClone: () => void;
  triggerPrune: () => void;
  /** Reset every gaussian's opacity to ~0.01. Increments `opacityResetsTriggered`. */
  triggerOpacityReset: () => void;
  toggleGradients: () => void;
  toggleAutoDensify: () => void;
  setPruneThreshold: (t: number) => void;
  setLambdaDssim: (v: number) => void;
  setResetInterval: (n: number) => void;
  reset: () => void;
}

const INITIAL_LAMBDA = 0.2;
const INITIAL_RESET_INTERVAL = 300;
const OPACITY_RESET_VALUE = 0.01;

export const useOptimizationStore = create<OptimizationState>((set, get) => ({
  gaussians: createRandomGaussians(INITIAL_GAUSSIAN_COUNT),
  step: 0,
  loss: [1.0],
  l1Loss: [1.0],
  dssimLoss: [1.0],
  lambdaDssim: INITIAL_LAMBDA,
  resetInterval: INITIAL_RESET_INTERVAL,
  opacityResetCountdown: INITIAL_RESET_INTERVAL,
  opacityResetsTriggered: 0,
  isAutoRunning: false,
  autoRunSpeed: 1,
  showGradients: true,
  pruneThreshold: DEFAULT_PRUNE_THRESHOLD,
  autoDensify: true,

  runStep: () => {
    const { gaussians, step, loss, l1Loss, dssimLoss, lambdaDssim } = get();
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

    // Mock L1 loss component = mean distance to nearest target (drops quickly early on).
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
    const newL1 = Math.max(0, avgDist / 5);

    // Mock D-SSIM component = variance of per-splat residuals (drops slower).
    const mean = updated.reduce((sum, g) => sum + g.gradientMagnitude, 0) / updated.length;
    const variance =
      updated.reduce((sum, g) => sum + (g.gradientMagnitude - mean) ** 2, 0) /
      Math.max(1, updated.length);
    // Scale to a similar magnitude to L1 but with a different decay curve.
    const newDssim = Math.max(0, Math.min(1, 0.2 + variance * 0.5));

    const newTotal = (1 - lambdaDssim) * newL1 + lambdaDssim * newDssim;
    const newStep = step + 1;

    let finalGaussians = updated;
    let newResetsTriggered = get().opacityResetsTriggered;
    let newCountdown = get().opacityResetCountdown - 1;

    // Auto opacity reset every `resetInterval` steps (paper: 3000; demo default 300).
    if (newCountdown <= 0) {
      finalGaussians = finalGaussians.map((g) => ({ ...g, opacity: OPACITY_RESET_VALUE }));
      newResetsTriggered += 1;
      newCountdown = get().resetInterval;
    }

    // Auto adaptive density control every DENSIFY_INTERVAL steps
    if (get().autoDensify && newStep % DENSIFY_INTERVAL === 0 && newStep > 0) {
      const { pruneThreshold } = get();

      // 1. Prune: remove near-transparent Gaussians
      finalGaussians = finalGaussians.filter((g) => g.opacity > pruneThreshold);

      // 2. Split: large Gaussians with high gradient → split into 2 smaller ones
      const toSplit: OptGaussian[] = [];
      const afterSplit: OptGaussian[] = [];
      for (const g of finalGaussians) {
        if (g.gradientMagnitude > 0.3 && Math.max(...g.scale) > 0.5 && finalGaussians.length + afterSplit.length < MAX_GAUSSIANS) {
          toSplit.push(g);
          const offset = 0.25;
          const newScale: Tuple3 = [g.scale[0] * 0.7, g.scale[1] * 0.7, g.scale[2] * 0.7];
          afterSplit.push({
            ...g,
            id: `g-${newStep}-s1-${g.id}`,
            position: [g.position[0] - g.gradient[0] * offset, g.position[1] - g.gradient[1] * offset, g.position[2] - g.gradient[2] * offset] as Tuple3,
            scale: newScale,
          });
          afterSplit.push({
            ...g,
            id: `g-${newStep}-s2-${g.id}`,
            position: [g.position[0] + g.gradient[0] * offset, g.position[1] + g.gradient[1] * offset, g.position[2] + g.gradient[2] * offset] as Tuple3,
            scale: newScale,
          });
        }
      }
      if (toSplit.length > 0) {
        const splitIds = new Set(toSplit.map((g) => g.id));
        finalGaussians = finalGaussians.filter((g) => !splitIds.has(g.id)).concat(afterSplit);
      }

      // 3. Clone: small Gaussians with high gradient → duplicate nearby
      const toClone: OptGaussian[] = [];
      for (const g of finalGaussians) {
        if (g.gradientMagnitude > 0.4 && Math.max(...g.scale) < 0.6 && finalGaussians.length + toClone.length < MAX_GAUSSIANS) {
          toClone.push({
            ...g,
            id: `g-${newStep}-c-${g.id}`,
            position: [
              g.position[0] + g.gradient[0] * 0.2,
              g.position[1] + g.gradient[1] * 0.2,
              g.position[2] + g.gradient[2] * 0.2,
            ] as Tuple3,
          });
        }
      }
      finalGaussians = finalGaussians.concat(toClone);
    }

    set({
      gaussians: finalGaussians,
      step: newStep,
      loss: [...loss, newTotal],
      l1Loss: [...l1Loss, newL1],
      dssimLoss: [...dssimLoss, newDssim],
      opacityResetCountdown: newCountdown,
      opacityResetsTriggered: newResetsTriggered,
    });
  },

  toggleAutoRun: () => set((s) => ({ isAutoRunning: !s.isAutoRunning })),
  setAutoRunSpeed: (speed) => set({ autoRunSpeed: speed }),

  triggerSplit: () => {
    const { gaussians } = get();
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

  triggerOpacityReset: () => {
    const { gaussians, opacityResetsTriggered } = get();
    set({
      gaussians: gaussians.map((g) => ({ ...g, opacity: OPACITY_RESET_VALUE })),
      opacityResetsTriggered: opacityResetsTriggered + 1,
      opacityResetCountdown: get().resetInterval,
    });
  },

  toggleGradients: () => set((s) => ({ showGradients: !s.showGradients })),
  toggleAutoDensify: () => set((s) => ({ autoDensify: !s.autoDensify })),
  setPruneThreshold: (t) => set({ pruneThreshold: t }),
  setLambdaDssim: (v) => set({ lambdaDssim: Math.min(1, Math.max(0, v)) }),
  setResetInterval: (n) =>
    set({ resetInterval: Math.max(10, Math.round(n)), opacityResetCountdown: Math.max(10, Math.round(n)) }),

  reset: () =>
    set({
      gaussians: createRandomGaussians(INITIAL_GAUSSIAN_COUNT),
      step: 0,
      loss: [1.0],
      l1Loss: [1.0],
      dssimLoss: [1.0],
      lambdaDssim: INITIAL_LAMBDA,
      resetInterval: INITIAL_RESET_INTERVAL,
      opacityResetCountdown: INITIAL_RESET_INTERVAL,
      opacityResetsTriggered: 0,
      isAutoRunning: false,
      showGradients: true,
      autoDensify: true,
    }),
}));
