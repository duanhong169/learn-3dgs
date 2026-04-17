import { create } from 'zustand';

export type ViewMode = 'gaussian' | 'groundTruth' | 'overlay' | 'cameraRender';

interface ReconstructionState {
  /** Display mode: gaussian reconstruction, ground truth, overlay comparison, or camera render. */
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
  showCameraView: boolean;
  
  // Camera render view controls
  /** Camera azimuth angle in degrees (around Y axis). */
  cameraAzimuth: number;
  /** Camera elevation angle in degrees (above X-Z plane). */
  cameraElevation: number;
  /** Camera distance from scene center. */
  cameraDistance: number;
  /** Camera focal length in pixels. */
  cameraFocalLength: number;
  /** Use per-pixel Gaussian evaluation (true) vs simple ellipse bounds (false). */
  useCameraPixelEvaluation: boolean;

  setViewMode: (mode: ViewMode) => void;
  setDensityLevel: (level: number) => void;
  toggleAnimation: () => void;
  setAnimationProgress: (progress: number) => void;
  toggleWireframe: () => void;
  toggleGaussianCenters: () => void;
  
  setCameraAzimuth: (angle: number) => void;
  setCameraElevation: (angle: number) => void;
  setCameraDistance: (distance: number) => void;
  setCameraFocalLength: (length: number) => void;
  toggleCameraPixelEvaluation: () => void;
  
  reset: () => void;
}

const INITIAL_STATE = {
  viewMode: 'gaussian' as ViewMode,
  densityLevel: 3,
  isAnimating: false,
  animationProgress: 1,
  showWireframe: false,
  showGaussianCenters: false,
  showCameraView: false,
  
  cameraAzimuth: 45,
  cameraElevation: 30,
  cameraDistance: 5,
  cameraFocalLength: 500,
  useCameraPixelEvaluation: true,
};

export const useReconstructionStore = create<ReconstructionState>((set) => ({
  ...INITIAL_STATE,

  setViewMode: (mode) => set({ viewMode: mode }),
  setDensityLevel: (level) => set({ densityLevel: level }),
  toggleAnimation: () =>
    set((s) => {
      if (!s.isAnimating) {
        return { isAnimating: true, animationProgress: 0 };
      }
      return { isAnimating: false };
    }),
  setAnimationProgress: (progress) => set({ animationProgress: progress }),
  toggleWireframe: () => set((s) => ({ showWireframe: !s.showWireframe })),
  toggleGaussianCenters: () => set((s) => ({ showGaussianCenters: !s.showGaussianCenters })),
  toggleCameraView: () => set((s) => ({ showCameraView: !s.showCameraView })),
  
  setCameraAzimuth: (angle) => set({ cameraAzimuth: angle }),
  setCameraElevation: (angle) => set({ cameraElevation: angle }),
  setCameraDistance: (distance) => set({ cameraDistance: distance }),
  setCameraFocalLength: (length) => set({ cameraFocalLength: length }),
  toggleCameraPixelEvaluation: () => set((s) => ({ useCameraPixelEvaluation: !s.useCameraPixelEvaluation })),
  
  reset: () => set(INITIAL_STATE),
}));
