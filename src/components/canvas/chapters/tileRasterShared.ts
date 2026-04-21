/**
 * Module-level shared refs used to pass per-frame rasterization results from
 * `TileRasterScene` to the UI overlay without going through React state.
 *
 * Why shared refs instead of Zustand? The raster output (bins + splat list) is
 * large and changes every frame — forcing React re-renders on every update
 * would tank perf. The overlay only reads these on user interaction (e.g.
 * clicking a tile), so a mutable module-level ref is the right trade-off.
 */

import type { ScreenSplat, TileBin } from '@/utils/tileRaster';

export const tileRasterSharedBins: { current: TileBin[] } = { current: [] };
export const tileRasterSharedSplats: { current: ScreenSplat[] } = { current: [] };
