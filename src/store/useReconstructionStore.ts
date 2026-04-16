import { create } from 'zustand';

export type ViewMode = 'gaussian' | 'groundTruth' | 'overlay';

interface ReconstructionState {
  /** Display mode: gaussian reconstruction, ground truth, or overlay comparison. */
  viewMode: ViewMode;
  /** Gaussian density level (1-5). Higher = more gaussians, finer quality. */
  densityLevel: number;
  /** Whether the reconstruction animation is playing. */
  isAnimating: boolean;
  /** Animation progress from random init to converged (0-1). */
  animationProgress: number;
  /** Show wireframe on ground truth meshes. */
  showWireframe: boolean;
  /** Show small dots at Gaussian center positions. */
  showGaussianCenters: boolean;

  setViewMode: (mode: ViewMode) => void;
  setDensityLevel: (level: number) => void;
  toggleAnimation: () => void;
  setAnimationProgress: (progress: number) => void;
  toggleWireframe: () => void;
  toggleGaussianCenters: () => void;
  reset: () => void;
}

const INITIAL_STATE = {
  viewMode: 'gaussian' as ViewMode,
  densityLevel: 3,
  isAnimating: false,
  animationProgress: 1,
  showWireframe: false,
  showGaussianCenters: false,
};

export const useReconstructionStore = create<ReconstructionState>((set) => ({
  ...INITIAL_STATE,

  setViewMode: (mode) => set({ viewMode: mode }),
  setDensityLevel: (level) => set({ densityLevel: level }),
  toggleAnimation: () =>
    set((s) => {
      if (!s.isAnimating) {
        // Starting animation — reset progress to 0
        return { isAnimating: true, animationProgress: 0 };
      }
      return { isAnimating: false };
    }),
  setAnimationProgress: (progress) => set({ animationProgress: progress }),
  toggleWireframe: () => set((s) => ({ showWireframe: !s.showWireframe })),
  toggleGaussianCenters: () => set((s) => ({ showGaussianCenters: !s.showGaussianCenters })),
  reset: () => set(INITIAL_STATE),
}));
