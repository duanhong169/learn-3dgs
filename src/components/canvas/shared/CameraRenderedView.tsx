import { useRef, useEffect } from 'react';
import * as THREE from 'three';

import { buildCovarianceMatrix } from '@/utils/math';
import { computeProjectionJacobian, projectCovariance3Dto2D, covarianceToEllipse } from '@/utils/projection';
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
}

const renderCanvas = (() => {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  return c;
})();

const renderTexture = new THREE.CanvasTexture(renderCanvas);

function computeViewBasis(
  cameraPos: Tuple3,
  lookAt: Tuple3,
  upVec: Tuple3 = [0, 1, 0]
): {
  right: Tuple3;
  up: Tuple3;
  forward: Tuple3;
  pos: Tuple3;
} {
  const dx = lookAt[0] - cameraPos[0];
  const dy = lookAt[1] - cameraPos[1];
  const dz = lookAt[2] - cameraPos[2];
  const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
  const forward: Tuple3 = [dx / len, dy / len, dz / len];

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
  viewBasis: ReturnType<typeof computeViewBasis>
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
  resolution: number
): Tuple3 {
  const fx = focalLength;
  const fy = focalLength;
  const depth = Math.max(0.01, camPos[2]);

  let screenX = (camPos[0] * fx) / depth;
  let screenY = (camPos[1] * fy) / depth;

  const halfRes = resolution / 2;
  const pixelX = screenX * halfRes + halfRes;
  const pixelY = -screenY * halfRes + halfRes;

  return [pixelX, pixelY, depth];
}

function evaluateGaussian2D(
  pixelX: number,
  pixelY: number,
  centerX: number,
  centerY: number,
  cov2D: Matrix2
): number {
  const dx = pixelX - centerX;
  const dy = pixelY - centerY;

  const a = cov2D[0], b = cov2D[1], c = cov2D[3];
  const det = a * c - b * b;
  if (det <= 0) return 0;

  const inv_a = c / det;
  const inv_b = -b / det;
  const inv_c = a / det;

  const dist2 = dx * (dx * inv_a + dy * inv_b) + dy * (dx * inv_b + dy * inv_c);

  return Math.exp(-0.5 * dist2);
}

function renderGaussianCameraView(
  canvas: HTMLCanvasElement,
  gaussians: ReconGaussian[],
  cameraPos: Tuple3,
  cameraLookAt: Tuple3,
  focalLength: number,
  usePixelEvaluation: boolean
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const w = canvas.width;
  const h = canvas.height;

  ctx.fillStyle = 'rgba(13, 17, 23, 1)';
  ctx.fillRect(0, 0, w, h);

  const viewBasis = computeViewBasis(cameraPos, cameraLookAt);

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

  const projected: ProjectedSplat[] = [];

  for (const g of gaussians) {
    const camPos = worldToCamera(g.position, viewBasis);

    if (camPos[2] < 0.01) continue;

    const screenCoords = projectToScreen(camPos, focalLength, w);
    const pixelX = screenCoords[0];
    const pixelY = screenCoords[1];
    const depth = screenCoords[2];

    const margin = 100;
    if (pixelX < -margin || pixelX > w + margin || pixelY < -margin || pixelY > h + margin)
      continue;

    const cov3D = buildCovarianceMatrix(g.scale, g.rotation);
    const jacobian = computeProjectionJacobian(camPos[0], camPos[1], camPos[2], focalLength, focalLength);
    const cov2D = projectCovariance3Dto2D(cov3D, jacobian);
    const ellipse = covarianceToEllipse(cov2D);

    const rgb = g.color;
    const color: Tuple3 = [rgb[0], rgb[1], rgb[2]];

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

  for (let i = 0; i < data.length; i += 4) {
    data[i] = 13;
    data[i + 1] = 17;
    data[i + 2] = 23;
    data[i + 3] = 255;
  }

  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      const pixelIdx = (py * w + px) * 4;

      const colors: Tuple3[] = [];
      const opacities: number[] = [];

      for (const splat of projected) {
        let alpha = 0;

        if (usePixelEvaluation) {
          alpha = evaluateGaussian2D(px, py, splat.centerX, splat.centerY, splat.cov2D);
        } else {
          const dx = px - splat.centerX;
          const dy = py - splat.centerY;

          const c = Math.cos(splat.angle);
          const s = Math.sin(splat.angle);
          const lx = dx * c + dy * s;
          const ly = -dx * s + dy * c;

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

  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.font = 'bold 14px monospace';
  ctx.fillText('Camera Rendered View', 10, 20);
  ctx.font = '12px monospace';
  ctx.fillText(`Gauss: ${projected.length} / ${gaussians.length}`, 10, 38);

  renderTexture.needsUpdate = true;
}

export function CameraRenderedView({
  gaussians,
  cameraPos,
  cameraLookAt,
  focalLength = 500,
  usePixelEvaluation = true,
}: CameraRenderedViewProps) {
  const meshRef = useRef<THREE.Mesh>(null);

  useEffect(() => {
    renderGaussianCameraView(
      renderCanvas,
      gaussians,
      cameraPos,
      cameraLookAt,
      focalLength,
      usePixelEvaluation
    );
  }, [gaussians, cameraPos, cameraLookAt, focalLength, usePixelEvaluation]);

  return (
    <mesh ref={meshRef} position={[0, 0, -3]}>
      <planeGeometry args={[4, 3]} />
      <meshBasicMaterial map={renderTexture} transparent side={THREE.DoubleSide} />
    </mesh>
  );
}
