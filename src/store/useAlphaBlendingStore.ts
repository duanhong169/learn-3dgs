import { create } from 'zustand';

import { SPLAT_COLORS } from '@/constants/gaussian';

import type { SplatData } from '@/types/gaussian';

function createDefaultSplats(): SplatData[] {
  return [
    { id: 'splat-1', color: SPLAT_COLORS[0], opacity: 0.8, depth: 1, positionX: -0.5, scale: 1.2 },
    { id: 'splat-2', color: SPLAT_COLORS[1], opacity: 0.6, depth: 2, positionX: 0, scale: 1.0 },
    { id: 'splat-3', color: SPLAT_COLORS[2], opacity: 0.7, depth: 3, positionX: 0.3, scale: 1.1 },
    { id: 'splat-4', color: SPLAT_COLORS[3], opacity: 0.5, depth: 4, positionX: -0.2, scale: 0.9 },
  ];
}

interface AlphaBlendingState {
  splats: SplatData[];
  probeX: number;
  stepThroughMode: boolean;
  currentStepIndex: number;

  setSplats: (s: SplatData[]) => void;
  updateSplat: (id: string, patch: Partial<SplatData>) => void;
  addSplat: () => void;
  removeSplat: (id: string) => void;
  setProbeX: (x: number) => void;
  toggleStepThrough: () => void;
  nextBlendStep: () => void;
  prevBlendStep: () => void;
  reset: () => void;
}

export const useAlphaBlendingStore = create<AlphaBlendingState>((set, get) => ({
  splats: createDefaultSplats(),
  probeX: 0,
  stepThroughMode: false,
  currentStepIndex: 0,

  setSplats: (s) => set({ splats: s }),

  updateSplat: (id, patch) =>
    set((state) => ({
      splats: state.splats.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    })),

  addSplat: () => {
    const { splats } = get();
    if (splats.length >= 7) return;
    const index = splats.length;
    const colorIndex = index % SPLAT_COLORS.length;
    const splatColor = SPLAT_COLORS[colorIndex] ?? '#ffffff';
    set({
      splats: [
        ...splats,
        {
          id: `splat-${Date.now()}`,
          color: splatColor,
          opacity: 0.6,
          depth: splats.length + 1,
          positionX: (Math.random() - 0.5) * 2,
          scale: 0.8 + Math.random() * 0.4,
        },
      ],
    });
  },

  removeSplat: (id) =>
    set((state) => ({
      splats: state.splats.filter((s) => s.id !== id),
    })),

  setProbeX: (x) => set({ probeX: x }),

  toggleStepThrough: () =>
    set((state) => ({
      stepThroughMode: !state.stepThroughMode,
      currentStepIndex: 0,
    })),

  nextBlendStep: () => {
    const { currentStepIndex, splats } = get();
    if (currentStepIndex < splats.length - 1) {
      set({ currentStepIndex: currentStepIndex + 1 });
    }
  },

  prevBlendStep: () => {
    const { currentStepIndex } = get();
    if (currentStepIndex > 0) {
      set({ currentStepIndex: currentStepIndex - 1 });
    }
  },

  reset: () =>
    set({
      splats: createDefaultSplats(),
      probeX: 0,
      stepThroughMode: false,
      currentStepIndex: 0,
    }),
}));
