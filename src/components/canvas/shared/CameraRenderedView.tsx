import { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import * as THREE from 'three';

import { buildCovarianceMatrix } from '@/utils/math';
import {
  computeProjectionJacobian,
  projectCovariance3Dto2D,
  rotateCovariance3D,
  covarianceToEllipse,
} from '@/utils/projection';
import { alphaComposite } from '@/utils/blending';

import type { ReconGaussian } from '@/utils/reconstruction';
import type { Tuple3 } from '@/types/common';
import type { Matrix2 } from '@/types/gaussian';

export interface CameraRenderedViewProps {
  gaussians: ReconGaussian[];
  cameraPos: Tuple3;
  cameraLookAt: Tuple3;
  focalLength?: number;
  usePixelEvaluation?: boolean;
  /** Where to place the rendered plane in 3D space. */
  displayPosition?: Tuple3;
  /** Quaternion [x, y, z, w] for display plane orientation. */
  displayQuaternion?: [number, number, number, number];
  /** Size of the display plane [width, height]. */
  displaySize?: [number, number];
}

// Resolution constants (16:9 aspect ratio)
const ASPECT = 16 / 9;
export const HI_W = 288;
export const HI_H = Math.round(HI_W / ASPECT); // 162
const LO_W = 80;
const LO_H = Math.round(LO_W / ASPECT); // 45
const DEBOUNCE_MS = 300;

// Two canvases: one for quick low-res preview, one for final high-res
const loCanvas = (() => {
  const c = document.createElement('canvas');
  c.width = LO_W;
  c.height = LO_H;
  return c;
})();

export const hiCanvas = (() => {
  const c = document.createElement('canvas');
  c.width = HI_W;
  c.height = HI_H;
  return c;
})();

const renderTexture = new THREE.CanvasTexture(hiCanvas);
renderTexture.minFilter = THREE.LinearFilter;
renderTexture.magFilter = THREE.LinearFilter;

// Loading indicator texture
const loadingTexture = (() => {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 48;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = 'rgba(13, 17, 23, 0.75)';
  ctx.roundRect(0, 0, 256, 48, 8);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 20px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('渲染中...', 128, 24);
  const tex = new THREE.CanvasTexture(c);
  tex.minFilter = THREE.LinearFilter;
  return tex;
})();

// ─── View basis computation ───────────────────────────────────────────────────

function computeViewBasis(
  cameraPos: Tuple3,
  lookAt: Tuple3,
): { right: Tuple3; up: Tuple3; forward: Tuple3; pos: Tuple3 } {
  const dx = lookAt[0] - cameraPos[0];
  const dy = lookAt[1] - cameraPos[1];
  const dz = lookAt[2] - cameraPos[2];
  const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
  const forward: Tuple3 = [dx / len, dy / len, dz / len];

  const upVec: Tuple3 = [0, 1, 0];
  const rx = forward[1] * upVec[2] - forward[2] * upVec[1];
  const ry = forward[2] * upVec[0] - forward[0] * upVec[2];
  const rz = forward[0] * upVec[1] - forward[1] * upVec[0];
  const rlen = Math.sqrt(rx * rx + ry * ry + rz * rz);
  const right: Tuple3 = [rx / rlen, ry / rlen, rz / rlen];

  const ux = right[1] * forward[2] - right[2] * forward[1];
  const uy = right[2] * forward[0] - right[0] * forward[2];
  const uz = right[0] * forward[1] - right[1] * forward[0];
  const up: Tuple3 = [ux, uy, uz];

  return { right, up, forward, pos: cameraPos };
}

function worldToCamera(
  worldPos: Tuple3,
  viewBasis: ReturnType<typeof computeViewBasis>,
): Tuple3 {
  const px = worldPos[0] - viewBasis.pos[0];
  const py = worldPos[1] - viewBasis.pos[1];
  const pz = worldPos[2] - viewBasis.pos[2];
  return [
    px * viewBasis.right[0] + py * viewBasis.right[1] + pz * viewBasis.right[2],
    px * viewBasis.up[0] + py * viewBasis.up[1] + pz * viewBasis.up[2],
    px * viewBasis.forward[0] + py * viewBasis.forward[1] + pz * viewBasis.forward[2],
  ];
}

function projectToScreen(
  camPos: Tuple3,
  focalLength: number,
  width: number,
  height: number,
): [number, number, number] {
  const depth = Math.max(0.01, camPos[2]);
  // Scale focal length relative to the shorter dimension (height) for consistency
  const fx = focalLength * (height / 512);
  const pixelX = (camPos[0] * fx) / depth + width / 2;
  const pixelY = -(camPos[1] * fx) / depth + height / 2;
  return [pixelX, pixelY, depth];
}

function evaluateGaussian2D(
  px: number,
  py: number,
  cx: number,
  cy: number,
  cov2D: Matrix2,
): number {
  const dx = px - cx;
  const dy = py - cy;
  const a = cov2D[0], b = cov2D[1], c = cov2D[3];
  const det = a * c - b * b;
  if (det <= 0) return 0;
  const inv_a = c / det;
  const inv_b = -b / det;
  const inv_c = a / det;
  const dist2 = dx * (dx * inv_a + dy * inv_b) + dy * (dx * inv_b + dy * inv_c);
  return Math.exp(-0.5 * dist2);
}

// ─── CPU splatting renderer ───────────────────────────────────────────────────

type ProjectedSplat = {
  centerX: number;
  centerY: number;
  radiusX: number;
  radiusY: number;
  angle: number;
  color: Tuple3;
  opacity: number;
  depth: number;
  cov2D: Matrix2;
};

function renderGaussianCameraView(
  canvas: HTMLCanvasElement,
  gaussians: ReconGaussian[],
  cameraPos: Tuple3,
  cameraLookAt: Tuple3,
  focalLength: number,
  usePixelEvaluation: boolean,
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const w = canvas.width;
  const h = canvas.height;
  const viewBasis = computeViewBasis(cameraPos, cameraLookAt);

  const fx = focalLength * (h / 512);

  // Project all gaussians to screen space
  const projected: ProjectedSplat[] = [];

  for (const g of gaussians) {
    const camCoord = worldToCamera(g.position, viewBasis);
    if (camCoord[2] < 0.01) continue;

    const [pixelX, pixelY, depth] = projectToScreen(camCoord, focalLength, w, h);
    const margin = 100;
    if (pixelX < -margin || pixelX > w + margin || pixelY < -margin || pixelY > h + margin) continue;

    // Σ_world → Σ_cam via W (world→camera rotation), then Σ_cam → Σ_screen via J.
    // Skipping the W rotation is only correct when the camera looks down −Z
    // in world space; for an orbit camera it produces severe distortion
    // (ground flattens into a cone, spheres become pancakes, etc).
    const cov3DWorld = buildCovarianceMatrix(g.scale, g.rotation);
    const cov3DCam = rotateCovariance3D(
      cov3DWorld,
      viewBasis.right,
      viewBasis.up,
      viewBasis.forward,
    );
    const jacobian = computeProjectionJacobian(camCoord[0], camCoord[1], camCoord[2], fx, fx);
    const cov2D = projectCovariance3Dto2D(cov3DCam, jacobian);
    const ellipse = covarianceToEllipse(cov2D);

    projected.push({
      centerX: pixelX,
      centerY: pixelY,
      radiusX: ellipse.radiusX,
      radiusY: ellipse.radiusY,
      angle: ellipse.angle,
      color: g.color,
      opacity: g.opacity,
      depth,
      cov2D,
    });
  }

  // Sort front-to-back (nearest first) for proper alpha compositing
  projected.sort((a, b) => a.depth - b.depth);

  // Render to pixel buffer
  const imageData = ctx.createImageData(w, h);
  const data = imageData.data;

  // Background color (dark) — filled first; composited pixels will blend onto it.
  const BG_R = 13;
  const BG_G = 17;
  const BG_B = 23;
  for (let i = 0; i < data.length; i += 4) {
    data[i] = BG_R; data[i + 1] = BG_G; data[i + 2] = BG_B; data[i + 3] = 255;
  }

  // Per-pixel splatting — sample at pixel CENTER (px + 0.5, py + 0.5) rather
  // than the pixel corner. This matches the convention used by drawImage's
  // bilinear interpolation and WebGL's LinearFilter, so the low-res preview
  // (later upscaled via drawImage) lines up with the native high-res render
  // and avoids a visible sub-pixel jump when the debounced hi-res pass
  // replaces the quick preview.
  for (let py = 0; py < h; py++) {
    const sy = py + 0.5;
    for (let px = 0; px < w; px++) {
      const sx = px + 0.5;
      const pixelIdx = (py * w + px) * 4;
      const colors: Tuple3[] = [];
      const opacities: number[] = [];

      for (const splat of projected) {
        let alpha = 0;

        if (usePixelEvaluation) {
          alpha = evaluateGaussian2D(sx, sy, splat.centerX, splat.centerY, splat.cov2D);
        } else {
          const dx = sx - splat.centerX;
          const dy = sy - splat.centerY;
          const cosA = Math.cos(splat.angle);
          const sinA = Math.sin(splat.angle);
          const lx = dx * cosA + dy * sinA;
          const ly = -dx * sinA + dy * cosA;
          const ex = lx / (splat.radiusX * 2);
          const ey = ly / (splat.radiusY * 2);
          const dist2 = ex * ex + ey * ey;
          if (dist2 < 1) {
            alpha = Math.exp(-0.5 * dist2 * 9);
          }
        }

        if (alpha > 0.001) {
          colors.push(splat.color);
          opacities.push(splat.opacity * alpha);
        }
      }

      if (colors.length > 0) {
        const { finalColor, finalTransmittance } = alphaComposite(colors, opacities);
        // Composite splat color over background:  C = C_splats + T_final · C_bg
        data[pixelIdx] = Math.round(finalColor[0] * 255 + finalTransmittance * BG_R);
        data[pixelIdx + 1] = Math.round(finalColor[1] * 255 + finalTransmittance * BG_G);
        data[pixelIdx + 2] = Math.round(finalColor[2] * 255 + finalTransmittance * BG_B);
        data[pixelIdx + 3] = 255;
      }
    }
  }

  ctx.putImageData(imageData, 0, 0);
}

/**
 * Copy the content of a source canvas onto the hi-res canvas (scaling up if needed),
 * then mark the shared texture as needing update.
 */
function commitToTexture(source: HTMLCanvasElement): void {
  const ctx = hiCanvas.getContext('2d');
  if (!ctx) return;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'medium';
  ctx.drawImage(source, 0, 0, HI_W, HI_H);
  renderTexture.needsUpdate = true;
}

// ─── React component ──────────────────────────────────────────────────────────

/**
 * Renders the Gaussian splat cloud as a 2D image using CPU splatting,
 * then displays it on a textured plane in 3D space.
 *
 * Uses dual-resolution rendering:
 * - Instant 64×64 low-res preview on parameter change
 * - Debounced 256×256 high-res render after 300ms of inactivity
 */
export function CameraRenderedView({
  gaussians,
  cameraPos,
  cameraLookAt,
  focalLength = 350,
  usePixelEvaluation = true,
  displayPosition = [0, 2.5, -4],
  displayQuaternion = [0, 0, 0, 1],
  displaySize = [3.5, 3.5],
}: CameraRenderedViewProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [isRendering, setIsRendering] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const quat = useMemo(
    () => new THREE.Quaternion(displayQuaternion[0], displayQuaternion[1], displayQuaternion[2], displayQuaternion[3]),
    [displayQuaternion],
  );

  // Stable render function refs to avoid stale closures
  const renderLowRes = useCallback(() => {
    renderGaussianCameraView(loCanvas, gaussians, cameraPos, cameraLookAt, focalLength, usePixelEvaluation);
    commitToTexture(loCanvas);
  }, [gaussians, cameraPos, cameraLookAt, focalLength, usePixelEvaluation]);

  const renderHiRes = useCallback(() => {
    renderGaussianCameraView(hiCanvas, gaussians, cameraPos, cameraLookAt, focalLength, usePixelEvaluation);
    renderTexture.needsUpdate = true;
    setIsRendering(false);
  }, [gaussians, cameraPos, cameraLookAt, focalLength, usePixelEvaluation]);

  useEffect(() => {
    // 1) Instant low-res preview
    renderLowRes();
    setIsRendering(true);

    // 2) Debounced hi-res render
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      renderHiRes();
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [renderLowRes, renderHiRes]);

  return (
    <group position={displayPosition} quaternion={quat}>
      {/* Rendered image plane */}
      <mesh ref={meshRef}>
        <planeGeometry args={[displaySize[0], displaySize[1]]} />
        <meshBasicMaterial
          map={renderTexture}
          transparent
          side={THREE.DoubleSide}
          opacity={isRendering ? 0.85 : 1}
        />
      </mesh>
      {/* Border frame */}
      <lineSegments>
        <edgesGeometry args={[new THREE.PlaneGeometry(displaySize[0], displaySize[1])]} />
        <lineBasicMaterial color="#58a6ff" />
      </lineSegments>
      {/* Loading indicator */}
      {isRendering && (
        <mesh position={[0, 0, 0.01]}>
          <planeGeometry args={[displaySize[0] * 0.5, displaySize[1] * 0.12]} />
          <meshBasicMaterial map={loadingTexture} transparent depthWrite={false} />
        </mesh>
      )}
    </group>
  );
}
