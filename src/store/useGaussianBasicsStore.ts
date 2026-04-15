import { create } from 'zustand';

import { DEFAULT_GAUSSIAN } from '@/constants/gaussian';

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

  setPosition: (p: Tuple3) => void;
  setScale: (s: Tuple3) => void;
  setRotation: (r: Tuple3) => void;
  setColor: (c: string) => void;
  setOpacity: (a: number) => void;
  toggleSamples: () => void;
  toggleAxes: () => void;
  toggleBoundingBox: () => void;
  reset: () => void;
}

export const useGaussianBasicsStore = create<GaussianBasicsState>((set) => ({
  position: [...DEFAULT_GAUSSIAN.position],
  scale: [...DEFAULT_GAUSSIAN.scale],
  rotation: [...DEFAULT_GAUSSIAN.rotation],
  color: DEFAULT_GAUSSIAN.color,
  opacity: DEFAULT_GAUSSIAN.opacity,
  showSamples: false,
  showAxes: true,
  showBoundingBox: false,

  setPosition: (p) => set({ position: p }),
  setScale: (s) => set({ scale: s }),
  setRotation: (r) => set({ rotation: r }),
  setColor: (c) => set({ color: c }),
  setOpacity: (a) => set({ opacity: a }),
  toggleSamples: () => set((s) => ({ showSamples: !s.showSamples })),
  toggleAxes: () => set((s) => ({ showAxes: !s.showAxes })),
  toggleBoundingBox: () => set((s) => ({ showBoundingBox: !s.showBoundingBox })),
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
    }),
}));
