/**
 * Tile-based 3DGS rasterizer (CPU reference implementation).
 *
 * Purpose: educational reproduction of the core rasterization loop from the
 * original 3D Gaussian Splatting paper. Demonstrates, in order:
 *   1. Axis-aligned bbox → tile binning.
 *   2. Per-tile (NOT global) depth sort.
 *   3. Per-pixel front-to-back alpha compositing.
 *   4. Early transmittance termination.
 *
 * The output is an RGBA `Uint8ClampedArray` ready to hand to a
 * `CanvasTexture` or `ImageData.putImageData`.
 */

import type { Matrix2 } from '@/types/gaussian';

/** A 2D splat in screen space, ready for rasterization. */
export interface ScreenSplat {
  /** Screen-space center x (px). */
  x: number;
  /** Screen-space center y (px). */
  y: number;
  /** 2D covariance (row-major: [a, b, c, d] meaning [[a,b],[c,d]]). */
  cov2D: Matrix2;
  /** RGB color in [0,1]. */
  color: [number, number, number];
  /** Overall opacity in [0,1]. */
  opacity: number;
  /** Camera-space z (smaller = closer to camera, sorted ascending). */
  depth: number;
  /** Conservative screen-space radius in px (typically 3σ). */
  radius: number;
}

/** A single tile's splat list after binning + depth sort. */
export interface TileBin {
  tileX: number;
  tileY: number;
  /** Indices into the original `splats` array, sorted front-to-back (depth ascending). */
  splatIndices: number[];
}

/** Result of `renderFrame`. */
export interface RenderFrameResult {
  /** RGBA buffer, length = imageWidth * imageHeight * 4. */
  buffer: Uint8ClampedArray;
  /** Every non-empty tile. */
  bins: TileBin[];
  stats: {
    /** Sum of splat-tile hits across all tiles (i.e. total binned splats). */
    totalTouched: number;
    /** Largest splatIndices.length across all bins. */
    maxSplatsPerTile: number;
    /** Pixels whose compositing loop hit the early-termination threshold. */
    earlyTerminatedPixels: number;
  };
}

/**
 * Bin splats into tiles by their axis-aligned screen bbox.
 * A splat at (x, y) with 3σ radius r overlaps tiles in
 * `[floor((x-r)/T), ceil((x+r)/T)) × [floor((y-r)/T), ceil((y+r)/T))`.
 *
 * Returned bins are sorted by depth (ascending = front-to-back).
 * Splats entirely off-screen contribute to no bins.
 */
export function binSplatsToTiles(
  splats: ScreenSplat[],
  imageWidth: number,
  imageHeight: number,
  tileSize: number,
): TileBin[] {
  if (tileSize <= 0) throw new Error('tileSize must be > 0');

  const tilesX = Math.ceil(imageWidth / tileSize);
  const tilesY = Math.ceil(imageHeight / tileSize);
  const binMap = new Map<number, number[]>(); // key = ty * tilesX + tx

  for (let i = 0; i < splats.length; i++) {
    const s = splats[i]!;
    // Reject degenerate / off-screen-by-a-lot splats cheaply.
    if (s.radius <= 0) continue;

    const minTx = Math.max(0, Math.floor((s.x - s.radius) / tileSize));
    const maxTx = Math.min(tilesX - 1, Math.floor((s.x + s.radius) / tileSize));
    const minTy = Math.max(0, Math.floor((s.y - s.radius) / tileSize));
    const maxTy = Math.min(tilesY - 1, Math.floor((s.y + s.radius) / tileSize));

    if (minTx > maxTx || minTy > maxTy) continue;

    for (let ty = minTy; ty <= maxTy; ty++) {
      for (let tx = minTx; tx <= maxTx; tx++) {
        const key = ty * tilesX + tx;
        let list = binMap.get(key);
        if (!list) {
          list = [];
          binMap.set(key, list);
        }
        list.push(i);
      }
    }
  }

  // Materialize bins + per-tile depth sort.
  const bins: TileBin[] = [];
  for (const [key, indices] of binMap) {
    indices.sort((a, b) => splats[a]!.depth - splats[b]!.depth);
    bins.push({
      tileX: key % tilesX,
      tileY: Math.floor(key / tilesX),
      splatIndices: indices,
    });
  }
  return bins;
}

/** Invert a 2x2 matrix. Returns null on singular. */
function invert2x2(m: Matrix2): Matrix2 | null {
  const [a, b, c, d] = m;
  const det = a * d - b * c;
  if (Math.abs(det) < 1e-12) return null;
  const inv = 1 / det;
  return [d * inv, -b * inv, -c * inv, a * inv];
}

/**
 * Rasterize a single tile into the full image buffer.
 * Writes RGBA bytes in [0,255] to the pixels covered by the tile.
 *
 * @returns `touchedCount` = pixels whose loop actually updated the buffer.
 *          `earlyTerminatedPixels` = pixels that exited early on T threshold.
 */
export function rasterizeTile(
  bin: TileBin,
  splats: ScreenSplat[],
  imageBuffer: Uint8ClampedArray,
  imageWidth: number,
  imageHeight: number,
  tileSize: number,
  earlyTerminationT = 0.0001,
): { touchedCount: number; earlyTerminatedPixels: number } {
  const startX = bin.tileX * tileSize;
  const startY = bin.tileY * tileSize;
  const endX = Math.min(startX + tileSize, imageWidth);
  const endY = Math.min(startY + tileSize, imageHeight);

  // Precompute inverted covariances for splats in this tile — reused across pixels.
  const invCovs: (Matrix2 | null)[] = bin.splatIndices.map((idx) =>
    invert2x2(splats[idx]!.cov2D),
  );

  let touched = 0;
  let earlyTerm = 0;

  for (let py = startY; py < endY; py++) {
    for (let px = startX; px < endX; px++) {
      let T = 1;
      let r = 0;
      let g = 0;
      let b = 0;
      let pixelWasTouched = false;
      let pixelEarlyTerminated = false;

      for (let k = 0; k < bin.splatIndices.length; k++) {
        const idx = bin.splatIndices[k]!;
        const s = splats[idx]!;
        const invCov = invCovs[k];
        if (!invCov) continue;

        const dx = px - s.x;
        const dy = py - s.y;
        // Mahalanobis distance squared: d^T · Σ^-1 · d
        const m =
          dx * dx * invCov[0] +
          2 * dx * dy * invCov[1] +
          dy * dy * invCov[3];
        if (m < 0 || m > 40) continue; // >4σ: negligible contribution

        const gaussian = Math.exp(-0.5 * m);
        const alpha = Math.min(0.99, s.opacity * gaussian);
        if (alpha < 1 / 255) continue;

        const contribution = alpha * T;
        r += s.color[0] * contribution;
        g += s.color[1] * contribution;
        b += s.color[2] * contribution;
        T *= 1 - alpha;
        pixelWasTouched = true;

        if (T < earlyTerminationT) {
          pixelEarlyTerminated = true;
          break;
        }
      }

      if (pixelWasTouched) {
        const pi = (py * imageWidth + px) * 4;
        imageBuffer[pi] = Math.min(255, r * 255);
        imageBuffer[pi + 1] = Math.min(255, g * 255);
        imageBuffer[pi + 2] = Math.min(255, b * 255);
        imageBuffer[pi + 3] = Math.min(255, (1 - T) * 255);
        touched++;
        if (pixelEarlyTerminated) earlyTerm++;
      }
    }
  }

  return { touchedCount: touched, earlyTerminatedPixels: earlyTerm };
}

/**
 * Full-frame rasterizer: bin → sort → per-tile rasterize.
 * Returns the final RGBA buffer + the bin structure for visualization + stats.
 */
export function renderFrame(
  splats: ScreenSplat[],
  imageWidth: number,
  imageHeight: number,
  tileSize: number,
  earlyTerminationT = 0.0001,
): RenderFrameResult {
  const buffer = new Uint8ClampedArray(imageWidth * imageHeight * 4);
  const bins = binSplatsToTiles(splats, imageWidth, imageHeight, tileSize);

  let totalTouched = 0;
  let maxSplatsPerTile = 0;
  let earlyTerminatedPixels = 0;

  for (const bin of bins) {
    if (bin.splatIndices.length > maxSplatsPerTile) {
      maxSplatsPerTile = bin.splatIndices.length;
    }
    totalTouched += bin.splatIndices.length;
    const { earlyTerminatedPixels: et } = rasterizeTile(
      bin,
      splats,
      buffer,
      imageWidth,
      imageHeight,
      tileSize,
      earlyTerminationT,
    );
    earlyTerminatedPixels += et;
  }

  return {
    buffer,
    bins,
    stats: { totalTouched, maxSplatsPerTile, earlyTerminatedPixels },
  };
}
