import { create } from 'zustand';

import { SH_TOTAL_FLOATS } from '@/utils/spherical-harmonics';

import type { SHMaterialId } from '@/utils/sh-scene';

export type SHViewMode = 'sh' | 'groundTruth' | 'overlay' | 'cameraRender';

interface BakingState {
  running: boolean;
  iter: number;
  totalIters: number;
  residual: number;
  coeffs: Float32Array;
}

interface SHState {
  /** Splats per sphere — controls visual quality and CPU baking cost. */
  splatDensity: number;
  /** Display mode. */
  viewMode: SHViewMode;
  /** Highlight a single SH basis function (step 2). null = show all. */
  highlightBasisIndex: number | null;
  /** Focus on a single material (step 4). 'all' = show all three spheres. */
  selectedMaterial: SHMaterialId | 'all';
  /** Live baking animation state (step 5). */
  baking: BakingState;

  // Camera-view controls (mirror of reconstruction-chapter controls)
  cameraAzimuth: number;
  cameraElevation: number;
  cameraDistance: number;
  cameraFocalLength: number;
  useCameraPixelEvaluation: boolean;
  showCameraPreview: boolean;

  // Actions
  setSplatDensity: (n: number) => void;
  setViewMode: (m: SHViewMode) => void;
  setHighlightBasisIndex: (i: number | null) => void;
  setSelectedMaterial: (id: SHMaterialId | 'all') => void;
  startBaking: (totalIters: number) => void;
  setBakingProgress: (iter: number, residual: number, coeffs: Float32Array) => void;
  stopBaking: () => void;
  resetBaking: () => void;

  setCameraAzimuth: (a: number) => void;
  setCameraElevation: (a: number) => void;
  setCameraDistance: (d: number) => void;
  setCameraFocalLength: (f: number) => void;
  toggleCameraPixelEvaluation: () => void;
  toggleCameraPreview: () => void;

  reset: () => void;
}

const INITIAL_BAKING: BakingState = {
  running: false,
  iter: 0,
  totalIters: 0,
  residual: 0,
  coeffs: new Float32Array(SH_TOTAL_FLOATS),
};

const INITIAL_STATE = {
  splatDensity: 400,
  // Default to "overlay" so step 1 (motivation) shows both the SH cloud and
  // the ground-truth spheres side-by-side without an extra click.
  viewMode: 'overlay' as SHViewMode,
  highlightBasisIndex: null as number | null,
  selectedMaterial: 'all' as SHMaterialId | 'all',
  baking: INITIAL_BAKING,

  cameraAzimuth: 30,
  cameraElevation: 15,
  cameraDistance: 5,
  cameraFocalLength: 400,
  useCameraPixelEvaluation: true,
  showCameraPreview: true,
};

export const useSHStore = create<SHState>((set) => ({
  ...INITIAL_STATE,

  setSplatDensity: (n) => set({ splatDensity: n }),
  setViewMode: (m) => set({ viewMode: m }),
  setHighlightBasisIndex: (i) => set({ highlightBasisIndex: i }),
  setSelectedMaterial: (id) => set({ selectedMaterial: id }),

  startBaking: (totalIters) =>
    set({
      baking: {
        running: true,
        iter: 0,
        totalIters,
        residual: 0,
        coeffs: new Float32Array(SH_TOTAL_FLOATS),
      },
    }),
  setBakingProgress: (iter, residual, coeffs) =>
    set((s) => ({ baking: { ...s.baking, iter, residual, coeffs } })),
  stopBaking: () => set((s) => ({ baking: { ...s.baking, running: false } })),
  resetBaking: () => set({ baking: INITIAL_BAKING }),

  setCameraAzimuth: (a) => set({ cameraAzimuth: a }),
  setCameraElevation: (a) => set({ cameraElevation: a }),
  setCameraDistance: (d) => set({ cameraDistance: d }),
  setCameraFocalLength: (f) => set({ cameraFocalLength: f }),
  toggleCameraPixelEvaluation: () =>
    set((s) => ({ useCameraPixelEvaluation: !s.useCameraPixelEvaluation })),
  toggleCameraPreview: () => set((s) => ({ showCameraPreview: !s.showCameraPreview })),

  reset: () => set(INITIAL_STATE),
}));
