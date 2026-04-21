import { create } from 'zustand';

export type TileSize = 8 | 16 | 32 | 64;

interface TileRasterState {
  /** Tile edge length in px. */
  tileSize: TileSize;
  /** Show tile-borders wireframe on the image plane. */
  showTileGrid: boolean;
  /** Color tiles by how many splats they contain (per-tile overdraw heatmap). */
  showHeatmap: boolean;
  /** Early-termination T threshold. 0 = off, typical 0.0001. */
  earlyTerminationT: number;
  /** Currently selected tile (tx, ty) for the "show me its splats" side panel. */
  selectedTile: [number, number] | null;
  /** Image size (px) the CPU rasterizer renders at. Fixed for the demo. */
  imageWidth: number;
  imageHeight: number;
  /** Stats from the latest renderFrame() call. Updated by the scene outside useFrame. */
  stats: {
    totalSplats: number;
    renderedSplats: number;
    totalBins: number;
    maxSplatsPerTile: number;
    earlyTerminatedPixels: number;
    renderMs: number;
  };

  setTileSize: (s: TileSize) => void;
  toggleTileGrid: () => void;
  toggleHeatmap: () => void;
  setEarlyTerminationT: (v: number) => void;
  setSelectedTile: (t: [number, number] | null) => void;
  setStats: (s: TileRasterState['stats']) => void;
  reset: () => void;
}

const INITIAL_STATE = {
  tileSize: 16 as TileSize,
  showTileGrid: true,
  showHeatmap: true,
  earlyTerminationT: 0.0001,
  selectedTile: null,
  imageWidth: 256,
  imageHeight: 256,
  stats: {
    totalSplats: 0,
    renderedSplats: 0,
    totalBins: 0,
    maxSplatsPerTile: 0,
    earlyTerminatedPixels: 0,
    renderMs: 0,
  },
};

export const useTileRasterStore = create<TileRasterState>((set) => ({
  ...INITIAL_STATE,
  setTileSize: (s) => set({ tileSize: s, selectedTile: null }),
  toggleTileGrid: () => set((s) => ({ showTileGrid: !s.showTileGrid })),
  toggleHeatmap: () => set((s) => ({ showHeatmap: !s.showHeatmap })),
  setEarlyTerminationT: (v) => set({ earlyTerminationT: v }),
  setSelectedTile: (t) => set({ selectedTile: t }),
  setStats: (s) => set({ stats: s }),
  reset: () => set({ ...INITIAL_STATE }),
}));
