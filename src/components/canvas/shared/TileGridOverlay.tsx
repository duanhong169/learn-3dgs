import { useMemo } from 'react';
import * as THREE from 'three';

import { useTileRasterStore } from '@/store/useTileRasterStore';
import { tileRasterSharedBins } from '@/components/canvas/chapters/tileRasterShared';

export interface TileGridOverlayProps {
  /** World-space edge length of the image plane. */
  planeSize: number;
  /** Pixel dimensions of the rasterized image. */
  imageWidth: number;
  imageHeight: number;
  /** Tile edge in px. */
  tileSize: number;
  showGrid: boolean;
  showHeatmap: boolean;
}

/**
 * Overlays the tile grid + optional per-tile heatmap on top of the raster plane.
 * Clicks on a tile update `selectedTile` in the store.
 *
 * NOTE: This reads `tileRasterSharedBins` (module-level shared reference) from
 * the scene. This coupling exists because binning runs inside an effect in
 * `TileRasterScene` and recomputing it here would double the cost per frame.
 */
export function TileGridOverlay({
  planeSize,
  imageWidth,
  imageHeight,
  tileSize,
  showGrid,
  showHeatmap,
}: TileGridOverlayProps) {
  const selectedTile = useTileRasterStore((s) => s.selectedTile);
  const setSelectedTile = useTileRasterStore((s) => s.setSelectedTile);
  // Subscribe to `stats` as a cheap "bins were refreshed" trigger. setStats is
  // called once per rasterize pass with a new object reference, so including
  // it in useMemo deps forces heatmap recomputation whenever bins change —
  // without putting the (potentially large) bins array itself in the store.
  const stats = useTileRasterStore((s) => s.stats);

  const tilesX = Math.ceil(imageWidth / tileSize);
  const tilesY = Math.ceil(imageHeight / tileSize);

  // World-space tile edge length.
  const tileWorldX = (planeSize * tileSize) / imageWidth;
  const tileWorldY = (planeSize * tileSize) / imageHeight;

  /** Convert tile (tx, ty) to its world-space center on the plane (z=0). */
  const tileCenter = (tx: number, ty: number): [number, number, number] => {
    const px = (tx + 0.5) * tileSize;
    const py = (ty + 0.5) * tileSize;
    // Map px in [0, imageWidth] to world in [-planeSize/2, planeSize/2].
    const wx = (px / imageWidth - 0.5) * planeSize;
    const wy = -(py / imageHeight - 0.5) * planeSize;
    return [wx, wy, 0];
  };

  // Grid line geometry.
  const gridGeometry = useMemo(() => {
    if (!showGrid) return null;
    const pts: number[] = [];
    const half = planeSize / 2;
    for (let i = 1; i < tilesX; i++) {
      const x = -half + i * tileWorldX;
      pts.push(x, -half, 0.002, x, half, 0.002);
    }
    for (let j = 1; j < tilesY; j++) {
      const y = half - j * tileWorldY;
      pts.push(-half, y, 0.002, half, y, 0.002);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    return g;
  }, [showGrid, planeSize, tilesX, tilesY, tileWorldX, tileWorldY]);

  // Heatmap cells (one per tile with at least 1 splat).
  // Deps include `stats` so this recomputes whenever the scene finishes a new
  // rasterize pass (stats is replaced with a new object ref each time).
  const heatmapTiles = useMemo(() => {
    if (!showHeatmap) return [];
    const bins = tileRasterSharedBins.current;
    if (bins.length === 0) return [];
    let maxCount = 0;
    for (const b of bins) {
      if (b.splatIndices.length > maxCount) maxCount = b.splatIndices.length;
    }
    if (maxCount === 0) return [];
    return bins.map((b) => ({
      tx: b.tileX,
      ty: b.tileY,
      count: b.splatIndices.length,
      intensity: b.splatIndices.length / maxCount,
    }));
  }, [showHeatmap, tilesX, tilesY, tileSize, stats]);

  return (
    <group position={[0, 0, 0.01]}>
      {/* Grid lines */}
      {gridGeometry && (
        <lineSegments>
          <primitive object={gridGeometry} attach="geometry" />
          <lineBasicMaterial color="#58a6ff" transparent opacity={0.35} />
        </lineSegments>
      )}

      {/* Heatmap quads + click targets */}
      {heatmapTiles.map((t) => {
        const center = tileCenter(t.tx, t.ty);
        const isSelected = selectedTile && selectedTile[0] === t.tx && selectedTile[1] === t.ty;
        // Color gradient from cool blue (low) to hot red (high).
        const hue = (1 - t.intensity) * 0.66; // 0.66 = blue → 0 = red
        const color = new THREE.Color().setHSL(hue, 0.8, 0.5);
        return (
          <mesh
            key={`${t.tx}-${t.ty}`}
            position={center}
            onClick={(e) => {
              e.stopPropagation();
              setSelectedTile([t.tx, t.ty]);
            }}
            onPointerOver={(e) => {
              e.stopPropagation();
              document.body.style.cursor = 'pointer';
            }}
            onPointerOut={() => {
              document.body.style.cursor = 'default';
            }}
          >
            <planeGeometry args={[tileWorldX * 0.9, tileWorldY * 0.9]} />
            <meshBasicMaterial
              color={color}
              transparent
              opacity={isSelected ? 0.75 : 0.35 * t.intensity + 0.1}
              toneMapped={false}
            />
          </mesh>
        );
      })}
    </group>
  );
}
