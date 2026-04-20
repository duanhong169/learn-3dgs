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
import { evaluateSH } from '@/utils/spherical-harmonics';

import type { SHGaussian } from '@/utils/spherical-harmonics';
import type { Tuple3 } from '@/types/common';
import type { Matrix2 } from '@/types/gaussian';

/**
 * SH-aware CPU splatter — fork of `CameraRenderedView` that evaluates per-splat
 * color from the splat's SH coefficients using the virtual camera's view
 * direction (→ splat center) each frame, rather than using a baked RGB.
 *
 * The projection / splatting / alpha compositing pipeline is identical to the
 * reconstruction chapter's — only the color source differs.
 */
export interface SHCameraRenderedViewProps {
  gaussians: SHGaussian[];
  cameraPos: Tuple3;
  cameraLookAt: Tuple3;
  focalLength?: number;
  usePixelEvaluation?: boolean;
  displayPosition?: Tuple3;
  displayQuaternion?: [number, number, number, number];
  displaySize?: [number, number];
}

const ASPECT = 16 / 9;
const HI_W = 288;
const HI_H = Math.round(HI_W / ASPECT);
const LO_W = 80;
const LO_H = Math.round(LO_W / ASPECT);
const DEBOUNCE_MS = 300;

const loCanvas = (() => {
  const c = document.createElement('canvas');
  c.width = LO_W;
  c.height = LO_H;
  return c;
})();

const hiCanvas = (() => {
  const c = document.createElement('canvas');
  c.width = HI_W;
  c.height = HI_H;
  return c;
})();

const renderTexture = new THREE.CanvasTexture(hiCanvas);
renderTexture.minFilter = THREE.LinearFilter;
renderTexture.magFilter = THREE.LinearFilter;

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

// ─── View basis + helpers (same as CameraRenderedView) ────────────────────────

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

function renderSHCameraView(
  canvas: HTMLCanvasElement,
  gaussians: SHGaussian[],
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

  const projected: ProjectedSplat[] = [];

  for (const g of gaussians) {
    const camCoord = worldToCamera(g.position, viewBasis);
    if (camCoord[2] < 0.01) continue;

    const [pixelX, pixelY, depth] = projectToScreen(camCoord, focalLength, w, h);
    const margin = 100;
    if (pixelX < -margin || pixelX > w + margin || pixelY < -margin || pixelY > h + margin) continue;

    const cov3DWorld = buildCovarianceMatrix(g.scale, g.rotation);
    const cov3DCam = rotateCovariance3D(cov3DWorld, viewBasis.right, viewBasis.up, viewBasis.forward);
    const jacobian = computeProjectionJacobian(camCoord[0], camCoord[1], camCoord[2], fx, fx);
    const cov2D = projectCovariance3Dto2D(cov3DCam, jacobian);
    const ellipse = covarianceToEllipse(cov2D);

    // SH evaluation: viewDir = normalize(cameraPos - splatPos), in world space.
    // Convention matches the Gaussian cloud shader.
    const vx = cameraPos[0] - g.position[0];
    const vy = cameraPos[1] - g.position[1];
    const vz = cameraPos[2] - g.position[2];
    const vlen = Math.hypot(vx, vy, vz);
    const viewDir: Tuple3 = vlen > 1e-6 ? [vx / vlen, vy / vlen, vz / vlen] : [0, 1, 0];
    const shColor = evaluateSH(g.shCoefficients, viewDir);
    const color: Tuple3 = [
      Math.max(0, shColor[0]),
      Math.max(0, shColor[1]),
      Math.max(0, shColor[2]),
    ];

    projected.push({
      centerX: pixelX,
      centerY: pixelY,
      radiusX: ellipse.radiusX,
      radiusY: ellipse.radiusY,
      angle: ellipse.angle,
      color,
      opacity: g.opacity,
      depth,
      cov2D,
    });
  }

  projected.sort((a, b) => a.depth - b.depth);

  const imageData = ctx.createImageData(w, h);
  const data = imageData.data;

  const BG_R = 13;
  const BG_G = 17;
  const BG_B = 23;
  for (let i = 0; i < data.length; i += 4) {
    data[i] = BG_R; data[i + 1] = BG_G; data[i + 2] = BG_B; data[i + 3] = 255;
  }

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
          if (dist2 < 1) alpha = Math.exp(-0.5 * dist2 * 9);
        }

        if (alpha > 0.001) {
          colors.push(splat.color);
          opacities.push(splat.opacity * alpha);
        }
      }

      if (colors.length > 0) {
        const { finalColor, finalTransmittance } = alphaComposite(colors, opacities);
        data[pixelIdx] = Math.min(255, Math.round(finalColor[0] * 255 + finalTransmittance * BG_R));
        data[pixelIdx + 1] = Math.min(255, Math.round(finalColor[1] * 255 + finalTransmittance * BG_G));
        data[pixelIdx + 2] = Math.min(255, Math.round(finalColor[2] * 255 + finalTransmittance * BG_B));
        data[pixelIdx + 3] = 255;
      }
    }
  }

  ctx.putImageData(imageData, 0, 0);
}

function commitToTexture(source: HTMLCanvasElement): void {
  const ctx = hiCanvas.getContext('2d');
  if (!ctx) return;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'medium';
  ctx.drawImage(source, 0, 0, HI_W, HI_H);
  renderTexture.needsUpdate = true;
}

/**
 * SH-aware CPU renderer with dual-resolution pipeline:
 *   1) Instant 80×45 low-res preview on parameter change
 *   2) Debounced 288×162 high-res render after `DEBOUNCE_MS` of inactivity
 */
export function SHCameraRenderedView({
  gaussians,
  cameraPos,
  cameraLookAt,
  focalLength = 350,
  usePixelEvaluation = true,
  displayPosition = [0, 2.5, -4],
  displayQuaternion = [0, 0, 0, 1],
  displaySize = [3.5, 3.5],
}: SHCameraRenderedViewProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [isRendering, setIsRendering] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const quat = useMemo(
    () =>
      new THREE.Quaternion(
        displayQuaternion[0],
        displayQuaternion[1],
        displayQuaternion[2],
        displayQuaternion[3],
      ),
    [displayQuaternion],
  );

  const renderLowRes = useCallback(() => {
    renderSHCameraView(loCanvas, gaussians, cameraPos, cameraLookAt, focalLength, usePixelEvaluation);
    commitToTexture(loCanvas);
  }, [gaussians, cameraPos, cameraLookAt, focalLength, usePixelEvaluation]);

  const renderHiRes = useCallback(() => {
    renderSHCameraView(hiCanvas, gaussians, cameraPos, cameraLookAt, focalLength, usePixelEvaluation);
    renderTexture.needsUpdate = true;
    setIsRendering(false);
  }, [gaussians, cameraPos, cameraLookAt, focalLength, usePixelEvaluation]);

  useEffect(() => {
    // `setIsRendering(true)` is intentional — kick off the "rendering…" overlay
    // until the debounced hi-res pass finishes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsRendering(true);
    renderLowRes();

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
      <mesh ref={meshRef}>
        <planeGeometry args={[displaySize[0], displaySize[1]]} />
        <meshBasicMaterial
          map={renderTexture}
          transparent
          side={THREE.DoubleSide}
          opacity={isRendering ? 0.85 : 1}
        />
      </mesh>
      <lineSegments>
        <edgesGeometry args={[new THREE.PlaneGeometry(displaySize[0], displaySize[1])]} />
        <lineBasicMaterial color="#58a6ff" />
      </lineSegments>
      {isRendering && (
        <mesh position={[0, 0, 0.01]}>
          <planeGeometry args={[displaySize[0] * 0.5, displaySize[1] * 0.12]} />
          <meshBasicMaterial map={loadingTexture} transparent depthWrite={false} />
        </mesh>
      )}
    </group>
  );
}
