import { useMemo, useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

import { useTileRasterStore } from '@/store/useTileRasterStore';
import { generateSceneGaussians } from '@/utils/reconstruction';
import { buildCovarianceMatrix } from '@/utils/math';
import {
  computeProjectionJacobian,
  projectCovariance3Dto2D,
  covarianceToEllipse,
  rotateCovariance3D,
} from '@/utils/projection';
import { renderFrame } from '@/utils/tileRaster';
import { TileGridOverlay } from '@/components/canvas/shared/TileGridOverlay';
import { tileRasterSharedBins, tileRasterSharedSplats } from './tileRasterShared';

import type { ScreenSplat } from '@/utils/tileRaster';
import type { Mesh } from 'three';

// Fixed virtual camera parameters for the CPU rasterizer.
const CAMERA_POS: [number, number, number] = [3.5, 2, 4];
const CAMERA_TARGET: [number, number, number] = [0, 0, 0];
const FX = 280;
const FY = 280;
/** World-unit size of the image plane. */
const PLANE_SIZE = 5;

/** Module-level canvas — one texture shared across re-renders. */
const rasterCanvas = (() => {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  return c;
})();
const rasterTexture = new THREE.CanvasTexture(rasterCanvas);
rasterTexture.minFilter = THREE.LinearFilter;
rasterTexture.magFilter = THREE.NearestFilter;

/** Cached ImageData reused each frame (avoid GC churn in useFrame). */
let sharedImageData: ImageData | null = null;

export function TileRasterScene() {
  const tileSize = useTileRasterStore((s) => s.tileSize);
  const showTileGrid = useTileRasterStore((s) => s.showTileGrid);
  const showHeatmap = useTileRasterStore((s) => s.showHeatmap);
  const earlyTerminationT = useTileRasterStore((s) => s.earlyTerminationT);
  const imageWidth = useTileRasterStore((s) => s.imageWidth);
  const imageHeight = useTileRasterStore((s) => s.imageHeight);
  const setStats = useTileRasterStore((s) => s.setStats);

  const planeRef = useRef<Mesh>(null);

  // Generate scene gaussians once (density level 3 → ~80 splats).
  const scene = useMemo(() => generateSceneGaussians(3), []);

  // Camera basis (for world→camera covariance rotation).
  const cameraBasis = useMemo(() => {
    const forward = new THREE.Vector3(
      CAMERA_TARGET[0] - CAMERA_POS[0],
      CAMERA_TARGET[1] - CAMERA_POS[1],
      CAMERA_TARGET[2] - CAMERA_POS[2],
    ).normalize();
    const worldUp = new THREE.Vector3(0, 1, 0);
    const right = new THREE.Vector3().crossVectors(worldUp, forward).normalize();
    if (right.lengthSq() < 1e-6) right.set(1, 0, 0);
    const up = new THREE.Vector3().crossVectors(forward, right).normalize();
    return {
      right: [right.x, right.y, right.z] as [number, number, number],
      up: [up.x, up.y, up.z] as [number, number, number],
      forward: [forward.x, forward.y, forward.z] as [number, number, number],
    };
  }, []);

  /** Project scene gaussians → ScreenSplat list (in screen px coords). */
  const screenSplats = useMemo<ScreenSplat[]>(() => {
    const out: ScreenSplat[] = [];
    for (const g of scene) {
      // World-space position relative to camera.
      const dx = g.position[0] - CAMERA_POS[0];
      const dy = g.position[1] - CAMERA_POS[1];
      const dz = g.position[2] - CAMERA_POS[2];
      // Camera-space coords: x=right·d, y=up·d, z=forward·d.
      const cx = dx * cameraBasis.right[0] + dy * cameraBasis.right[1] + dz * cameraBasis.right[2];
      const cy = dx * cameraBasis.up[0] + dy * cameraBasis.up[1] + dz * cameraBasis.up[2];
      const cz =
        dx * cameraBasis.forward[0] + dy * cameraBasis.forward[1] + dz * cameraBasis.forward[2];
      if (cz <= 0.1) continue; // behind camera

      const sxPx = imageWidth / 2 + (FX * cx) / cz;
      const syPx = imageHeight / 2 - (FY * cy) / cz;

      // World-space covariance, rotated into camera space, then projected to 2D.
      const rotDeg = g.rotation;
      const cov3DWorld = buildCovarianceMatrix(g.scale, rotDeg);
      const cov3DCam = rotateCovariance3D(
        cov3DWorld,
        cameraBasis.right,
        cameraBasis.up,
        cameraBasis.forward,
      );
      const jac = computeProjectionJacobian(cx, cy, cz, FX, FY);
      const cov2D = projectCovariance3Dto2D(cov3DCam, jac);
      // Add a small regularization to avoid degenerate covariances
      // (EWA low-pass filter from the 3DGS paper — 0.3 in pixel units).
      cov2D[0] += 0.3;
      cov2D[3] += 0.3;

      const ell = covarianceToEllipse(cov2D);
      const radius = Math.ceil(Math.max(ell.radiusX, ell.radiusY) * 3);
      if (radius <= 0) continue;

      out.push({
        x: sxPx,
        y: syPx,
        cov2D,
        color: g.color,
        opacity: g.opacity,
        depth: cz,
        radius,
      });
    }
    return out;
  }, [scene, cameraBasis, imageWidth, imageHeight]);

  // Sync selected splats for overlay access.
  useEffect(() => {
    tileRasterSharedSplats.current = screenSplats;
  }, [screenSplats]);

  // Run the CPU rasterizer every frame params change.
  useEffect(() => {
    const t0 = performance.now();
    const result = renderFrame(
      screenSplats,
      imageWidth,
      imageHeight,
      tileSize,
      earlyTerminationT,
    );
    const renderMs = performance.now() - t0;

    const ctx = rasterCanvas.getContext('2d');
    if (!ctx) return;

    // Resize canvas to match store dims (if changed externally).
    if (rasterCanvas.width !== imageWidth || rasterCanvas.height !== imageHeight) {
      rasterCanvas.width = imageWidth;
      rasterCanvas.height = imageHeight;
      sharedImageData = null;
    }
    if (!sharedImageData || sharedImageData.width !== imageWidth) {
      sharedImageData = ctx.createImageData(imageWidth, imageHeight);
    }

    // Paint background dark-blue, then splats on top.
    ctx.fillStyle = '#0d1117';
    ctx.fillRect(0, 0, imageWidth, imageHeight);
    sharedImageData.data.set(result.buffer);
    ctx.putImageData(sharedImageData, 0, 0);

    tileRasterSharedBins.current = result.bins;
    rasterTexture.needsUpdate = true;

    // Count non-zero-contribution splats (those that were binned).
    setStats({
      totalSplats: screenSplats.length,
      renderedSplats: result.stats.totalTouched,
      totalBins: result.bins.length,
      maxSplatsPerTile: result.stats.maxSplatsPerTile,
      earlyTerminatedPixels: result.stats.earlyTerminatedPixels,
      renderMs,
    });
  }, [screenSplats, tileSize, earlyTerminationT, imageWidth, imageHeight, setStats]);

  // Gently pulse the plane so users notice it's the live-rendered output.
  useFrame((state) => {
    if (!planeRef.current) return;
    const t = state.clock.elapsedTime;
    const s = 1 + Math.sin(t * 0.6) * 0.005;
    planeRef.current.scale.set(s, s, 1);
  });

  return (
    <group>
      {/* The CPU-rasterized frame, displayed on a plane. */}
      <mesh ref={planeRef} position={[0, 0, 0]}>
        <planeGeometry args={[PLANE_SIZE, PLANE_SIZE]} />
        <meshBasicMaterial map={rasterTexture} toneMapped={false} />
      </mesh>

      {/* Tile grid + heatmap overlay on top of the raster plane. */}
      {(showTileGrid || showHeatmap) && (
        <TileGridOverlay
          planeSize={PLANE_SIZE}
          imageWidth={imageWidth}
          imageHeight={imageHeight}
          tileSize={tileSize}
          showGrid={showTileGrid}
          showHeatmap={showHeatmap}
        />
      )}
    </group>
  );
}
