import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

import {
  SH_MATERIALS,
  type SHMaterial,
  type SHBakeLighting,
  DEFAULT_SH_LIGHTING,
} from '@/utils/sh-scene';
import {
  evaluateSH,
  fibonacciSphere,
  SH_TOTAL_FLOATS,
} from '@/utils/spherical-harmonics';
import { useSHStore } from '@/store/useSHStore';

import type { Tuple3, ColorRGB } from '@/types/common';
import type { SHMaterialId } from '@/utils/sh-scene';

// Re-use BRDF from sh-scene via a thin wrapper: we import and recreate the minimal
// path-tracer here for visualization. Keep it consistent with sh-scene.ts.
function dot(a: Tuple3, b: Tuple3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function fresnelSchlick(cosTheta: number, f0: ColorRGB): ColorRGB {
  const f = Math.pow(1 - Math.max(0, Math.min(1, cosTheta)), 5);
  return [f0[0] + (1 - f0[0]) * f, f0[1] + (1 - f0[1]) * f, f0[2] + (1 - f0[2]) * f];
}
function ndfGGX(nDotH: number, alpha: number): number {
  const a2 = alpha * alpha;
  const denom = nDotH * nDotH * (a2 - 1) + 1;
  return a2 / (Math.PI * denom * denom + 1e-7);
}
function geometrySmith(nDotV: number, nDotL: number, alpha: number): number {
  const k = ((alpha + 1) * (alpha + 1)) / 8;
  const gv = nDotV / (nDotV * (1 - k) + k + 1e-7);
  const gl = nDotL / (nDotL * (1 - k) + k + 1e-7);
  return gv * gl;
}

function evaluateBRDF(
  mat: SHMaterial,
  normal: Tuple3,
  view: Tuple3,
  lighting: SHBakeLighting,
): ColorRGB {
  const nDotV = Math.max(0, dot(normal, view));
  const nDotL = Math.max(0, dot(normal, lighting.keyLightDir));
  const f0: ColorRGB =
    mat.metalness >= 0.5 ? [mat.albedo[0], mat.albedo[1], mat.albedo[2]] : [0.04, 0.04, 0.04];
  const diffuseWeight = 1 - mat.metalness;
  const out: ColorRGB = [
    mat.albedo[0] * lighting.ambientColor[0] * diffuseWeight,
    mat.albedo[1] * lighting.ambientColor[1] * diffuseWeight,
    mat.albedo[2] * lighting.ambientColor[2] * diffuseWeight,
  ];
  if (nDotL > 0) {
    const dc = diffuseWeight / Math.PI;
    out[0] += mat.albedo[0] * dc * lighting.keyLightColor[0] * nDotL;
    out[1] += mat.albedo[1] * dc * lighting.keyLightColor[1] * nDotL;
    out[2] += mat.albedo[2] * dc * lighting.keyLightColor[2] * nDotL;
    const hx = view[0] + lighting.keyLightDir[0];
    const hy = view[1] + lighting.keyLightDir[1];
    const hz = view[2] + lighting.keyLightDir[2];
    const hlen = Math.hypot(hx, hy, hz);
    if (hlen > 1e-6) {
      const half: Tuple3 = [hx / hlen, hy / hlen, hz / hlen];
      const nDotH = Math.max(0, dot(normal, half));
      const vDotH = Math.max(0, dot(view, half));
      const alpha = Math.max(1e-3, mat.roughness * mat.roughness);
      const D = ndfGGX(nDotH, alpha);
      const G = geometrySmith(Math.max(1e-4, nDotV), nDotL, alpha);
      const F = fresnelSchlick(vDotH, f0);
      const denom = 4 * nDotV * nDotL + 1e-4;
      const specCoef = (D * G) / denom;
      out[0] += F[0] * specCoef * lighting.keyLightColor[0] * nDotL;
      out[1] += F[1] * specCoef * lighting.keyLightColor[1] * nDotL;
      out[2] += F[2] * specCoef * lighting.keyLightColor[2] * nDotL;
    }
  }
  return out;
}

// ─── Canvas texture builders ─────────────────────────────────────────────────

const TEX_SIZE = 128; // Square texture for preview disc
const SAMPLE_COUNT = 256;

/**
 * Build a texture showing the BRDF-true color as a function of view direction,
 * projected onto a disc (orthographic view along +Z). This is our "ground
 * truth" target that the SH reconstruction should match.
 */
function renderGroundTruthDisc(
  canvas: HTMLCanvasElement,
  mat: SHMaterial,
  normal: Tuple3,
  lighting: SHBakeLighting,
): void {
  const ctx = canvas.getContext('2d')!;
  const w = canvas.width;
  const h = canvas.height;
  const img = ctx.createImageData(w, h);
  const data = img.data;
  const cx = w / 2;
  const cy = h / 2;
  const R = Math.min(w, h) / 2 - 2;

  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      const nx = (px - cx) / R;
      const ny = -(py - cy) / R;
      const r2 = nx * nx + ny * ny;
      const idx = (py * w + px) * 4;
      if (r2 > 1) {
        data[idx] = 13; data[idx + 1] = 17; data[idx + 2] = 23; data[idx + 3] = 255;
        continue;
      }
      const nz = Math.sqrt(1 - r2);
      const viewDir: Tuple3 = [nx, ny, nz];
      const c = evaluateBRDF(mat, normal, viewDir, lighting);
      data[idx] = Math.min(255, Math.round(c[0] * 255));
      data[idx + 1] = Math.min(255, Math.round(c[1] * 255));
      data[idx + 2] = Math.min(255, Math.round(c[2] * 255));
      data[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}

/** Build a texture of the current SH reconstruction for view directions on the +Z hemisphere. */
function renderSHDisc(canvas: HTMLCanvasElement, coeffs: Float32Array): void {
  const ctx = canvas.getContext('2d')!;
  const w = canvas.width;
  const h = canvas.height;
  const img = ctx.createImageData(w, h);
  const data = img.data;
  const cx = w / 2;
  const cy = h / 2;
  const R = Math.min(w, h) / 2 - 2;

  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      const nx = (px - cx) / R;
      const ny = -(py - cy) / R;
      const r2 = nx * nx + ny * ny;
      const idx = (py * w + px) * 4;
      if (r2 > 1) {
        data[idx] = 13; data[idx + 1] = 17; data[idx + 2] = 23; data[idx + 3] = 255;
        continue;
      }
      const nz = Math.sqrt(1 - r2);
      const c = evaluateSH(coeffs, [nx, ny, nz]);
      data[idx] = Math.min(255, Math.max(0, Math.round(c[0] * 255)));
      data[idx + 1] = Math.min(255, Math.max(0, Math.round(c[1] * 255)));
      data[idx + 2] = Math.min(255, Math.max(0, Math.round(c[2] * 255)));
      data[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}

/** Precompute direction-color samples for a material — the "training set". */
function prepareTrainingSamples(
  mat: SHMaterial,
  normal: Tuple3,
  lighting: SHBakeLighting,
  n: number,
): Array<{ dir: Tuple3; color: ColorRGB }> {
  const dirs = fibonacciSphere(n);
  return dirs.map((dir) => ({ dir, color: evaluateBRDF(mat, normal, dir, lighting) }));
}

// ─── Component ───────────────────────────────────────────────────────────────

export interface BakingVisualizerProps {
  /** Place the visualization above the scene. */
  position?: Tuple3;
  /** Size of each preview plane. */
  tileSize?: number;
  /** Material to visualize (null = follow store's selectedMaterial, fallback glossy). */
  materialId?: SHMaterialId;
}

/**
 * Educational visualizer for the SH baking process:
 *   Left:   ground-truth BRDF hemisphere for the chosen material
 *   Right:  partial SH reconstruction updated as more training samples are consumed
 *
 * Two canvas textures are pasted onto planes; a React overlay UI (below)
 * renders the 27-coefficient bar chart. An internal `useFrame` advances one
 * iteration per `ITERATION_INTERVAL_MS`.
 */
export function BakingVisualizer({
  position = [0, 3.2, -0.5],
  tileSize = 0.9,
  materialId,
}: BakingVisualizerProps) {
  const storeMaterial = useSHStore((s) => s.selectedMaterial);
  const baking = useSHStore((s) => s.baking);
  const setBakingProgress = useSHStore((s) => s.setBakingProgress);
  const stopBaking = useSHStore((s) => s.stopBaking);

  const mid: SHMaterialId =
    materialId ?? (storeMaterial !== 'all' ? storeMaterial : 'glossy');
  const mat = SH_MATERIALS[mid];
  // Sample a representative normal for visualization — the "top" of the sphere.
  // Kept as a module-level-style constant (not a ref) so useMemo deps stay clean.
  const NORMAL_Z: Tuple3 = useMemo(() => [0, 0, 1], []);

  const samples = useMemo(
    () => prepareTrainingSamples(mat, NORMAL_Z, DEFAULT_SH_LIGHTING, SAMPLE_COUNT),
    [mat, NORMAL_Z],
  );

  // GT canvas is static per material
  const gtCanvas = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = TEX_SIZE;
    c.height = TEX_SIZE;
    renderGroundTruthDisc(c, mat, NORMAL_Z, DEFAULT_SH_LIGHTING);
    return c;
  }, [mat, NORMAL_Z]);
  const gtTexture = useMemo(() => {
    const t = new THREE.CanvasTexture(gtCanvas);
    t.minFilter = THREE.LinearFilter;
    return t;
  }, [gtCanvas]);

  // SH reconstruction canvas refreshed as coefficients change
  const shCanvas = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = TEX_SIZE;
    c.height = TEX_SIZE;
    return c;
  }, []);
  const shTexture = useMemo(() => {
    const t = new THREE.CanvasTexture(shCanvas);
    t.minFilter = THREE.LinearFilter;
    return t;
  }, [shCanvas]);

  // Iteration state, local to this component
  const consumedRef = useRef(0);
  const coeffsRef = useRef<Float32Array>(new Float32Array(SH_TOTAL_FLOATS));
  const lastIterTimeRef = useRef(0);
  const [iterCount, setIterCount] = useState(0);

  // Reset when baking starts fresh or material changes
  useEffect(() => {
    if (baking.running && baking.iter === 0) {
      consumedRef.current = 0;
      coeffsRef.current = new Float32Array(SH_TOTAL_FLOATS);
      setIterCount(0);
      renderSHDisc(shCanvas, coeffsRef.current);
      shTexture.needsUpdate = true;
    }
  }, [baking.running, baking.iter, shCanvas, shTexture, mat]);

  const ITERATION_INTERVAL_MS = 120;
  const SAMPLES_PER_ITERATION = Math.max(1, Math.floor(SAMPLE_COUNT / baking.totalIters || 1));

  useFrame(() => {
    if (!baking.running) return;
    const now = performance.now();
    if (now - lastIterTimeRef.current < ITERATION_INTERVAL_MS) return;
    lastIterTimeRef.current = now;

    const start = consumedRef.current;
    const end = Math.min(SAMPLE_COUNT, start + SAMPLES_PER_ITERATION);
    if (end <= start) {
      stopBaking();
      return;
    }

    const coeffs = coeffsRef.current;
    const total = 4 * Math.PI;

    // Rescale existing partial sum (Monte-Carlo weight changes with N)
    if (start > 0) {
      const oldWeight = total / start;
      const newWeight = total / end;
      const rescale = newWeight / oldWeight;
      for (let i = 0; i < SH_TOTAL_FLOATS; i++) coeffs[i]! *= rescale;
    }
    const weight = total / end;

    for (let s = start; s < end; s++) {
      const { dir, color } = samples[s]!;
      const x = dir[0], y = dir[1], z = dir[2];
      const C0 = 0.28209479177387814;
      const C1 = 0.4886025119029199;
      const C2a = 1.0925484305920792;
      const C2b = 0.31539156525252005;
      const C2c = 0.5462742152960396;
      const b = [
        C0,
        C1 * y,
        C1 * z,
        C1 * x,
        C2a * x * y,
        C2a * y * z,
        C2b * (3 * z * z - 1),
        C2a * x * z,
        C2c * (x * x - y * y),
      ];
      for (let i = 0; i < 9; i++) {
        const yi = b[i]! * weight;
        coeffs[i]! += color[0] * yi;
        coeffs[9 + i]! += color[1] * yi;
        coeffs[18 + i]! += color[2] * yi;
      }
    }
    consumedRef.current = end;

    // Residual
    let errSum = 0;
    for (let s = 0; s < end; s++) {
      const { dir, color } = samples[s]!;
      const [rr, gg, bb] = evaluateSH(coeffs, dir);
      const dr = rr - color[0];
      const dg = gg - color[1];
      const db = bb - color[2];
      errSum += dr * dr + dg * dg + db * db;
    }
    const residual = Math.sqrt(errSum / (end * 3));

    renderSHDisc(shCanvas, coeffs);
    shTexture.needsUpdate = true;
    setIterCount((n) => n + 1);

    const newIter = iterCount + 1;
    setBakingProgress(newIter, residual, coeffs);

    if (end >= SAMPLE_COUNT) stopBaking();
  });

  return (
    <group position={position}>
      {/* GT label */}
      <mesh position={[-tileSize * 0.6, tileSize * 0.7, 0]}>
        <planeGeometry args={[tileSize * 0.9, 0.16]} />
        <meshBasicMaterial color="#0d1117" transparent opacity={0.6} />
      </mesh>
      {/* GT disc */}
      <mesh position={[-tileSize * 0.6, 0, 0]}>
        <planeGeometry args={[tileSize, tileSize]} />
        <meshBasicMaterial map={gtTexture} transparent />
      </mesh>
      {/* SH label */}
      <mesh position={[tileSize * 0.6, tileSize * 0.7, 0]}>
        <planeGeometry args={[tileSize * 0.9, 0.16]} />
        <meshBasicMaterial color="#0d1117" transparent opacity={0.6} />
      </mesh>
      {/* SH disc */}
      <mesh position={[tileSize * 0.6, 0, 0]}>
        <planeGeometry args={[tileSize, tileSize]} />
        <meshBasicMaterial map={shTexture} transparent />
      </mesh>
    </group>
  );
}
