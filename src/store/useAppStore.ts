import { create } from 'zustand';

interface AppState {
  /** Currently selected object ID, or null if nothing is selected. */
  selectedId: string | null;

  /** Select an object by ID, or null to deselect. */
  select: (id: string | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
  selectedId: null,
  select: (id) => set({ selectedId: id }),
}));
