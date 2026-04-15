import { create } from 'zustand';

import type { Tuple3 } from '@/types/common';
import type { Matrix3, Matrix2 } from '@/types/gaussian';

interface SplattingState {
  gaussianScale: Tuple3;
  gaussianRotation: Tuple3;
  cameraAzimuth: number;
  cameraElevation: number;
  cameraDistance: number;
  showProjectionLines: boolean;
  showCovarianceMatrices: boolean;
  covariance3D: Matrix3;
  covariance2D: Matrix2;

  setGaussianScale: (s: Tuple3) => void;
  setGaussianRotation: (r: Tuple3) => void;
  setCameraAzimuth: (a: number) => void;
  setCameraElevation: (e: number) => void;
  setCameraDistance: (d: number) => void;
  setCovariance3D: (m: Matrix3) => void;
  setCovariance2D: (m: Matrix2) => void;
  toggleProjectionLines: () => void;
  toggleCovarianceMatrices: () => void;
  reset: () => void;
}

const INITIAL_STATE = {
  gaussianScale: [1, 0.6, 0.8] as Tuple3,
  gaussianRotation: [0, 0, 0] as Tuple3,
  cameraAzimuth: 45,
  cameraElevation: 30,
  cameraDistance: 5,
  showProjectionLines: true,
  showCovarianceMatrices: true,
  covariance3D: [1, 0, 0, 0, 0.36, 0, 0, 0, 0.64] as Matrix3,
  covariance2D: [1, 0, 0, 1] as Matrix2,
};

export const useSplattingStore = create<SplattingState>((set) => ({
  ...INITIAL_STATE,

  setGaussianScale: (s) => set({ gaussianScale: s }),
  setGaussianRotation: (r) => set({ gaussianRotation: r }),
  setCameraAzimuth: (a) => set({ cameraAzimuth: a }),
  setCameraElevation: (e) => set({ cameraElevation: e }),
  setCameraDistance: (d) => set({ cameraDistance: d }),
  setCovariance3D: (m) => set({ covariance3D: m }),
  setCovariance2D: (m) => set({ covariance2D: m }),
  toggleProjectionLines: () => set((s) => ({ showProjectionLines: !s.showProjectionLines })),
  toggleCovarianceMatrices: () => set((s) => ({ showCovarianceMatrices: !s.showCovarianceMatrices })),
  reset: () => set({ ...INITIAL_STATE }),
}));
