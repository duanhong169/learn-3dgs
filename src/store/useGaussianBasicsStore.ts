import { create } from 'zustand';

import { DEFAULT_GAUSSIAN } from '@/constants/gaussian';
import { SH_PRESETS } from '@/constants/gaussian';

import type { Tuple3 } from '@/types/common';

interface GaussianBasicsState {
  position: Tuple3;
  scale: Tuple3;
  rotation: Tuple3;
  color: string;
  opacity: number;
  showSamples: boolean;
  showAxes: boolean;
  showBoundingBox: boolean;
  /** Whether SH view-dependent coloring is enabled. */
  shEnabled: boolean;
  /** SH order (0-3). */
  shOrder: number;
  /** Active preset name. */
  shPreset: string;
  /** SH coefficients (16 x [r,g,b]). */
  shCoefficients: Array<[number, number, number]>;

  setPosition: (p: Tuple3) => void;
  setScale: (s: Tuple3) => void;
  setRotation: (r: Tuple3) => void;
  setColor: (c: string) => void;
  setOpacity: (a: number) => void;
  toggleSamples: () => void;
  toggleAxes: () => void;
  toggleBoundingBox: () => void;
  toggleSH: () => void;
  setSHOrder: (order: number) => void;
  setSHPreset: (name: string) => void;
  reset: () => void;
}

const defaultPreset = SH_PRESETS[0]!;

export const useGaussianBasicsStore = create<GaussianBasicsState>((set) => ({
  position: [...DEFAULT_GAUSSIAN.position],
  scale: [...DEFAULT_GAUSSIAN.scale],
  rotation: [...DEFAULT_GAUSSIAN.rotation],
  color: DEFAULT_GAUSSIAN.color,
  opacity: DEFAULT_GAUSSIAN.opacity,
  showSamples: false,
  showAxes: true,
  showBoundingBox: false,
  shEnabled: false,
  shOrder: defaultPreset.order,
  shPreset: defaultPreset.name,
  shCoefficients: defaultPreset.coeffs,

  setPosition: (p) => set({ position: p }),
  setScale: (s) => set({ scale: s }),
  setRotation: (r) => set({ rotation: r }),
  setColor: (c) => set({ color: c }),
  setOpacity: (a) => set({ opacity: a }),
  toggleSamples: () => set((s) => ({ showSamples: !s.showSamples })),
  toggleAxes: () => set((s) => ({ showAxes: !s.showAxes })),
  toggleBoundingBox: () => set((s) => ({ showBoundingBox: !s.showBoundingBox })),
  toggleSH: () => set((s) => ({ shEnabled: !s.shEnabled })),
  setSHOrder: (order) => set({ shOrder: order }),
  setSHPreset: (name) => {
    const preset = SH_PRESETS.find((p) => p.name === name);
    if (preset) {
      set({ shPreset: name, shOrder: preset.order, shCoefficients: preset.coeffs });
    }
  },
  reset: () =>
    set({
      position: [...DEFAULT_GAUSSIAN.position],
      scale: [...DEFAULT_GAUSSIAN.scale],
      rotation: [...DEFAULT_GAUSSIAN.rotation],
      color: DEFAULT_GAUSSIAN.color,
      opacity: DEFAULT_GAUSSIAN.opacity,
      showSamples: false,
      showAxes: true,
      showBoundingBox: false,
      shEnabled: false,
      shOrder: defaultPreset.order,
      shPreset: defaultPreset.name,
      shCoefficients: defaultPreset.coeffs,
    }),
}));
