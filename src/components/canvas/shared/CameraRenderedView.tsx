import { useRef, useEffect, useState, useMemo } from 'react';
import * as THREE from 'three';

import { buildCovarianceMatrix } from '@/utils/math';
import {
  computeProjectionJacobian,
  projectCovariance3Dto2D,
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

// Resolution — lower = faster. 256×256 is ~4× faster than 512×512
const RENDER_RES = 256;

// Singleton canvas + texture (reused across renders)
const renderCanvas = (() => {
  const c = document.createElement('canvas');
  c.width = RENDER_RES;
  c.height = RENDER_RES;
  return c;
})();

const renderTexture = new THREE.CanvasTexture(renderCanvas);
renderTexture.minFilter = THREE.LinearFilter;
renderTexture.magFilter = THREE.LinearFilter;

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
  resolution: number,
): [number, number, number] {
  const depth = Math.max(0.01, camPos[2]);
  // focalLength is in pixel units (relative to the render resolution).
  // Scale it proportionally: store default 500 is for ~512px, scale to actual res.
  const fx = focalLength * (resolution / 512);
  const halfRes = resolution / 2;
  const pixelX = (camPos[0] * fx) / depth + halfRes;
  const pixelY = -(camPos[1] * fx) / depth + halfRes;
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

  // Scale focal length from store units (for 512px) to actual render resolution
  const fx = focalLength * (w / 512);

  // Project all gaussians to screen space
  const projected: ProjectedSplat[] = [];

  for (const g of gaussians) {
    const camCoord = worldToCamera(g.position, viewBasis);
    if (camCoord[2] < 0.01) continue;

    const [pixelX, pixelY, depth] = projectToScreen(camCoord, focalLength, w);
    const margin = 100;
    if (pixelX < -margin || pixelX > w + margin || pixelY < -margin || pixelY > h + margin) continue;

    const cov3D = buildCovarianceMatrix(g.scale, g.rotation);
    const jacobian = computeProjectionJacobian(camCoord[0], camCoord[1], camCoord[2], fx, fx);
    const cov2D = projectCovariance3Dto2D(cov3D, jacobian);
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

  // Background color (dark)
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 13; data[i + 1] = 17; data[i + 2] = 23; data[i + 3] = 255;
  }

  // Per-pixel splatting
  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      const pixelIdx = (py * w + px) * 4;
      const colors: Tuple3[] = [];
      const opacities: number[] = [];

      for (const splat of projected) {
        let alpha = 0;

        if (usePixelEvaluation) {
          // Exact 2D Gaussian evaluation
          alpha = evaluateGaussian2D(px, py, splat.centerX, splat.centerY, splat.cov2D);
        } else {
          // Approximate ellipse-based evaluation
          const dx = px - splat.centerX;
          const dy = py - splat.centerY;
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
        const { finalColor } = alphaComposite(colors, opacities);
        data[pixelIdx] = Math.round(finalColor[0] * 255);
        data[pixelIdx + 1] = Math.round(finalColor[1] * 255);
        data[pixelIdx + 2] = Math.round(finalColor[2] * 255);
        data[pixelIdx + 3] = 255;
      }
    }
  }

  ctx.putImageData(imageData, 0, 0);

  // HUD overlay text
  ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
  ctx.font = 'bold 11px monospace';
  ctx.fillText(`3DGS Rendered View  (${projected.length} splats)`, 6, 14);

  renderTexture.needsUpdate = true;
}

// ─── React component ──────────────────────────────────────────────────────────

/**
 * Renders the Gaussian splat cloud as a 2D image using CPU splatting,
 * then displays it on a textured plane in 3D space.
 */
export function CameraRenderedView({
  gaussians,
  cameraPos,
  cameraLookAt,
  focalLength = 500,
  usePixelEvaluation = true,
  displayPosition = [0, 2.5, -4],
  displayQuaternion = [0, 0, 0, 1],
  displaySize = [3.5, 3.5],
}: CameraRenderedViewProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [isRendering, setIsRendering] = useState(true);

  const quat = useMemo(
    () => new THREE.Quaternion(displayQuaternion[0], displayQuaternion[1], displayQuaternion[2], displayQuaternion[3]),
    [displayQuaternion],
  );

  useEffect(() => {
    setIsRendering(true);

    // Defer heavy CPU work to avoid blocking the main thread
    const timeoutId = setTimeout(() => {
      renderGaussianCameraView(
        renderCanvas,
        gaussians,
        cameraPos,
        cameraLookAt,
        focalLength,
        usePixelEvaluation,
      );
      setIsRendering(false);
    }, 16);

    return () => clearTimeout(timeoutId);
  }, [gaussians, cameraPos, cameraLookAt, focalLength, usePixelEvaluation]);

  return (
    <group position={displayPosition} quaternion={quat}>
      {/* Rendered image plane */}
      <mesh ref={meshRef}>
        <planeGeometry args={[displaySize[0], displaySize[1]]} />
        <meshBasicMaterial
          map={renderTexture}
          transparent
          side={THREE.DoubleSide}
          opacity={isRendering ? 0.5 : 1}
        />
      </mesh>
      {/* Border frame */}
      <lineSegments>
        <edgesGeometry args={[new THREE.PlaneGeometry(displaySize[0], displaySize[1])]} />
        <lineBasicMaterial color="#58a6ff" />
      </lineSegments>
      {/* Label */}
      {isRendering && (
        <mesh position={[0, 0, 0.01]}>
          <planeGeometry args={[1.6, 0.3]} />
          <meshBasicMaterial color="#0d1117" transparent opacity={0.8} />
        </mesh>
      )}
    </group>
  );
}
