import { describe, it, expect } from 'vitest';

import {
  binSplatsToTiles,
  rasterizeTile,
  renderFrame,
  type ScreenSplat,
} from '@/utils/tileRaster';

import type { Matrix2 } from '@/types/gaussian';

/** Isotropic 2x2 covariance = σ²·I. */
function isoCov(sigma: number): Matrix2 {
  const v = sigma * sigma;
  return [v, 0, 0, v];
}

/** Default splat at given position with moderate scale. */
function splatAt(
  x: number,
  y: number,
  opts: Partial<ScreenSplat> = {},
): ScreenSplat {
  return {
    x,
    y,
    cov2D: opts.cov2D ?? isoCov(3),
    color: opts.color ?? [1, 0, 0],
    opacity: opts.opacity ?? 1,
    depth: opts.depth ?? 1,
    radius: opts.radius ?? 9,
    ...opts,
  };
}

describe('binSplatsToTiles', () => {
  it('bins a single splat at center of 64x64 image (tile=16, r=7) into 4 tiles', () => {
    // Splat at (32, 32), r=7. Covers x: [25, 39] → tiles 1,2 (floor(25/16)=1, floor(39/16)=2)
    //                              y: [25, 39] → tiles 1,2
    // Expected: 4 tiles (1,1), (2,1), (1,2), (2,2).
    const splats: ScreenSplat[] = [splatAt(32, 32, { radius: 7 })];
    const bins = binSplatsToTiles(splats, 64, 64, 16);
    expect(bins.length).toBe(4);
    const coords = bins.map((b) => `${b.tileX},${b.tileY}`).sort();
    expect(coords).toEqual(['1,1', '1,2', '2,1', '2,2']);
  });

  it('bins a single large splat into 9 tiles when r > tileSize', () => {
    // Splat at (32, 32), r=20. Covers x: [12, 52] → tiles 0..3 (floor(12/16)=0, floor(52/16)=3)
    // For a 64x64 image with tileSize=16, there are 4 tiles (0..3) in each dim.
    // x range [0,3] gives 4 tiles; same y → 16 tiles. Let's tighten:
    // Actually r=20 at x=32: [12, 52] → tile 0..3. So 4 tiles in x, 4 in y = 16.
    // To hit exactly 9, use a splat where bbox covers exactly 3 tiles in each dim.
    // Place splat at (24, 24), r=18 → x:[6,42] → tiles floor(6/16)=0, floor(42/16)=2 → 3 tiles.
    const splats: ScreenSplat[] = [splatAt(24, 24, { radius: 18 })];
    const bins = binSplatsToTiles(splats, 64, 64, 16);
    expect(bins.length).toBe(9);
  });

  it('clips tile indices to image bounds', () => {
    // Splat near edge: bbox extends off-screen, but binning should clip.
    const splats: ScreenSplat[] = [splatAt(2, 2, { radius: 5 })];
    const bins = binSplatsToTiles(splats, 64, 64, 16);
    // Splat at (2,2), r=5 → bbox [-3,7]×[-3,7] → after clip only tile (0,0).
    expect(bins.length).toBe(1);
    expect(bins[0]!.tileX).toBe(0);
    expect(bins[0]!.tileY).toBe(0);
  });

  it('sorts splats in each bin front-to-back by depth', () => {
    // Three splats entirely inside one tile (tile (1,1) = [16..31]×[16..31]).
    const splats: ScreenSplat[] = [
      splatAt(24, 24, { radius: 3, depth: 5 }),   // middle
      splatAt(24, 24, { radius: 3, depth: 1 }),   // front
      splatAt(24, 24, { radius: 3, depth: 10 }),  // back
    ];
    const bins = binSplatsToTiles(splats, 64, 64, 16);
    // All three land in one tile.
    expect(bins.length).toBe(1);
    expect(bins[0]!.splatIndices).toEqual([1, 0, 2]); // sorted ASC by depth
  });

  it('skips splats with non-positive radius', () => {
    const splats: ScreenSplat[] = [
      splatAt(32, 32, { radius: 0 }),
      splatAt(32, 32, { radius: -1 }),
    ];
    const bins = binSplatsToTiles(splats, 64, 64, 16);
    expect(bins.length).toBe(0);
  });

  it('throws on non-positive tileSize', () => {
    expect(() => binSplatsToTiles([], 64, 64, 0)).toThrow();
    expect(() => binSplatsToTiles([], 64, 64, -1)).toThrow();
  });
});

describe('rasterizeTile', () => {
  it('writes red pixels for a single opaque red splat at tile center', () => {
    const splats: ScreenSplat[] = [splatAt(8, 8, { cov2D: isoCov(2), radius: 6 })];
    const buffer = new Uint8ClampedArray(16 * 16 * 4);
    const { touchedCount } = rasterizeTile(
      { tileX: 0, tileY: 0, splatIndices: [0] },
      splats,
      buffer,
      16,
      16,
      16,
    );
    expect(touchedCount).toBeGreaterThan(0);
    // Pixel (8,8) lies at the splat center — should be strong red.
    const centerIdx = (8 * 16 + 8) * 4;
    expect(buffer[centerIdx]).toBeGreaterThanOrEqual(128);
    expect(buffer[centerIdx + 3]).toBeGreaterThan(0);
  });

  it('early-terminates when transmittance drops below threshold', () => {
    // Two highly opaque splats stacked at the same pixel, different depths.
    const cov = isoCov(1.2);
    const splats: ScreenSplat[] = [
      splatAt(8, 8, { cov2D: cov, color: [1, 0, 0], opacity: 0.99, depth: 1, radius: 4 }),
      splatAt(8, 8, { cov2D: cov, color: [0, 1, 0], opacity: 0.99, depth: 2, radius: 4 }),
    ];
    const buffer = new Uint8ClampedArray(16 * 16 * 4);
    const { earlyTerminatedPixels } = rasterizeTile(
      { tileX: 0, tileY: 0, splatIndices: [0, 1] },
      splats,
      buffer,
      16,
      16,
      16,
      0.05, // generous threshold → many pixels will hit it
    );
    expect(earlyTerminatedPixels).toBeGreaterThan(0);
    // At the center, front (red) splat should dominate the color.
    const centerIdx = (8 * 16 + 8) * 4;
    expect(buffer[centerIdx]).toBeGreaterThan(buffer[centerIdx + 1]!);
  });

  it('writes nothing when splat list is empty', () => {
    const buffer = new Uint8ClampedArray(16 * 16 * 4);
    const { touchedCount } = rasterizeTile(
      { tileX: 0, tileY: 0, splatIndices: [] },
      [],
      buffer,
      16,
      16,
      16,
    );
    expect(touchedCount).toBe(0);
    expect(Array.from(buffer).every((v) => v === 0)).toBe(true);
  });
});

describe('renderFrame', () => {
  it('returns an all-zero buffer for an empty splat list', () => {
    const { buffer, bins, stats } = renderFrame([], 32, 32, 16);
    expect(buffer.length).toBe(32 * 32 * 4);
    expect(Array.from(buffer).every((v) => v === 0)).toBe(true);
    expect(bins.length).toBe(0);
    expect(stats.totalTouched).toBe(0);
    expect(stats.maxSplatsPerTile).toBe(0);
    expect(stats.earlyTerminatedPixels).toBe(0);
  });

  it('respects per-tile depth ordering (front splat dominates)', () => {
    // Front-red, back-green at same pixel center.
    const splats: ScreenSplat[] = [
      splatAt(16, 16, {
        cov2D: isoCov(2),
        color: [1, 0, 0],
        opacity: 0.95,
        depth: 1,
        radius: 6,
      }),
      splatAt(16, 16, {
        cov2D: isoCov(2),
        color: [0, 1, 0],
        opacity: 0.95,
        depth: 2,
        radius: 6,
      }),
    ];
    const { buffer, stats } = renderFrame(splats, 32, 32, 16);
    expect(stats.maxSplatsPerTile).toBeGreaterThanOrEqual(2);
    const centerIdx = (16 * 32 + 16) * 4;
    // Red (front) should dominate over green (back).
    expect(buffer[centerIdx]).toBeGreaterThan(buffer[centerIdx + 1]!);
  });

  it('accumulates stats across all tiles', () => {
    const splats: ScreenSplat[] = [
      splatAt(8, 8, { radius: 3 }),
      splatAt(24, 24, { radius: 3 }),
    ];
    const { bins, stats } = renderFrame(splats, 32, 32, 16);
    expect(bins.length).toBe(2); // two independent tiles
    expect(stats.totalTouched).toBe(2);
    expect(stats.maxSplatsPerTile).toBe(1);
  });
});
