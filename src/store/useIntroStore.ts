import { create } from 'zustand';

export type RenderMethod = 'nerf' | 'splat' | 'both';

interface IntroState {
  /** Currently visualized method. */
  method: RenderMethod;
  /** How many ray samples per pixel for the NeRF-side visualization. */
  samplesPerRay: number;
  /** Which pixel (grid coord 0..5) is currently selected. */
  selectedPixel: [number, number];
  /** Show the "cost per pixel" counter badge. */
  showCostCounter: boolean;

  setMethod: (m: RenderMethod) => void;
  setSamplesPerRay: (n: number) => void;
  setSelectedPixel: (p: [number, number]) => void;
  toggleCostCounter: () => void;
  reset: () => void;
}

const INITIAL_STATE = {
  method: 'both' as RenderMethod,
  samplesPerRay: 32,
  selectedPixel: [3, 3] as [number, number],
  showCostCounter: true,
};

export const useIntroStore = create<IntroState>((set) => ({
  ...INITIAL_STATE,
  setMethod: (m) => set({ method: m }),
  setSamplesPerRay: (n) => set({ samplesPerRay: n }),
  setSelectedPixel: (p) => set({ selectedPixel: p }),
  toggleCostCounter: () => set((s) => ({ showCostCounter: !s.showCostCounter })),
  reset: () => set({ ...INITIAL_STATE }),
}));
