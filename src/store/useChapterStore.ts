import { create } from 'zustand';

import { CHAPTERS } from '@/constants/chapters';
import type { ChapterId } from '@/types/chapters';

interface ChapterState {
  /** Currently active chapter. */
  activeChapter: ChapterId;
  /** Current instruction step index (0-based). */
  instructionStep: number;
  /** Whether the sidebar is collapsed. */
  sidebarCollapsed: boolean;

  /** Switch to a chapter and reset instruction step. */
  setChapter: (id: ChapterId) => void;
  /** Go to next instruction step if not at the end. */
  nextStep: () => void;
  /** Go to previous instruction step if not at the beginning. */
  prevStep: () => void;
  /** Toggle sidebar collapsed state. */
  toggleSidebar: () => void;
}

export const useChapterStore = create<ChapterState>((set, get) => ({
  activeChapter: 'intro',
  instructionStep: 0,
  sidebarCollapsed: false,

  setChapter: (id) => set({ activeChapter: id, instructionStep: 0 }),

  nextStep: () => {
    const { activeChapter, instructionStep } = get();
    const chapter = CHAPTERS.find((c) => c.id === activeChapter);
    if (chapter && instructionStep < chapter.totalSteps - 1) {
      set({ instructionStep: instructionStep + 1 });
    }
  },

  prevStep: () => {
    const { instructionStep } = get();
    if (instructionStep > 0) {
      set({ instructionStep: instructionStep - 1 });
    }
  },

  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
}));
