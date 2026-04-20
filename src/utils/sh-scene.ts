/**
 * Scene and material definitions for Chapter 6 (Spherical Harmonics).
 *
 * Each splat lives on the surface of a small sphere whose material defines a
 * BRDF. To bake per-splat SH coefficients we sample outgoing view directions
 * uniformly on the hemisphere centered at the splat's normal, evaluate a
 * simplified GGX-Schlick BRDF against a single directional key light plus
 * uniform ambient light, and project the resulting color function onto the
 * L=2 SH basis.
 *
 * Three materials are showcased for contrast:
 *   diffuse  — Lambertian, view-independent ⇒ L=0,1 dominate, L=2 ≈ 0.
 *   glossy   — moderate roughness, soft specular lobe that migrates with view.
 *   metallic — low roughness + high F0, sharp specular lobe needs L=2.
 */

import { bakeSHFromSamples, fibonacciSphere } from '@/utils/spherical-harmonics';

import type { Tuple3, ColorRGB } from '@/types/common';
import type { ReconGaussian } from '@/utils/reconstruction';
import type { SHGaussian } from '@/utils/spherical-harmonics';

// ─── Materials ────────────────────────────────────────────────────────────────

export type SHMaterialId = 'diffuse' | 'glossy' | 'metallic';

export interface SHMaterial {
  id: SHMaterialId;
  /** Base color / albedo (for diffuse) or tint (for specular). */
  albedo: ColorRGB;
  /** Surface roughness [0, 1]. Lower = sharper highlights. */
  roughness: number;
  /** Metalness [0, 1]. 1 = fully metallic (no diffuse, tinted specular). */
  metalness: number;
  /** Human-readable label for UI. */
  label: string;
}

export const SH_MATERIALS: Record<SHMaterialId, SHMaterial> = {
  diffuse: {
    id: 'diffuse',
    albedo: [0.85, 0.35, 0.35],
    roughness: 1.0,
    metalness: 0.0,
    label: '漫反射',
  },
  glossy: {
    id: 'glossy',
    albedo: [0.35, 0.55, 0.85],
    roughness: 0.25,
    metalness: 0.0,
    label: '光泽',
  },
  metallic: {
    id: 'metallic',
    albedo: [0.95, 0.75, 0.35],
    roughness: 0.15,
    metalness: 1.0,
    label: '金属',
  },
};

/** Default lighting environment shared across baking and ground-truth spheres. */
export const DEFAULT_SH_LIGHTING = {
  /** Unit direction from the scene toward the light source. */
  keyLightDir: normalizeTuple([0.5, 0.8, 0.4]),
  // Bright, slightly warm key light. The GPU shader renders each splat just
  // once (no overpainting), so the baked color magnitude drives visible
  // brightness directly — boost above "1.0" so the single-pass result looks
  // vivid instead of muddy grey.
  keyLightColor: [3.5, 3.3, 3.0] as ColorRGB,
  ambientColor: [0.35, 0.4, 0.5] as ColorRGB,
};

// ─── BRDF evaluation ──────────────────────────────────────────────────────────

function normalizeTuple(v: Tuple3): Tuple3 {
  const len = Math.hypot(v[0], v[1], v[2]);
  return len > 0 ? [v[0] / len, v[1] / len, v[2] / len] : [0, 1, 0];
}

function dot(a: Tuple3, b: Tuple3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function addTo(out: ColorRGB, r: number, g: number, b: number): void {
  out[0] += r;
  out[1] += g;
  out[2] += b;
}

/** Schlick's Fresnel approximation. */
function fresnelSchlick(cosTheta: number, f0: ColorRGB): ColorRGB {
  const f = Math.pow(1 - Math.max(0, Math.min(1, cosTheta)), 5);
  return [
    f0[0] + (1 - f0[0]) * f,
    f0[1] + (1 - f0[1]) * f,
    f0[2] + (1 - f0[2]) * f,
  ];
}

/** GGX / Trowbridge-Reitz normal distribution. */
function ndfGGX(nDotH: number, alpha: number): number {
  const a2 = alpha * alpha;
  const denom = nDotH * nDotH * (a2 - 1) + 1;
  return a2 / (Math.PI * denom * denom + 1e-7);
}

/** Smith geometry term (combined, Schlick approximation). */
function geometrySmith(nDotV: number, nDotL: number, alpha: number): number {
  const k = ((alpha + 1) * (alpha + 1)) / 8;
  const gv = nDotV / (nDotV * (1 - k) + k + 1e-7);
  const gl = nDotL / (nDotL * (1 - k) + k + 1e-7);
  return gv * gl;
}

/**
 * Evaluate outgoing radiance (RGB) for a surface with `mat` at `normal`,
 * viewed from direction `view` (pointing away from the surface), under the
 * given key + ambient lighting.
 */
function evaluateBRDF(
  mat: SHMaterial,
  normal: Tuple3,
  view: Tuple3,
  lightDir: Tuple3,
  lightColor: ColorRGB,
  ambientColor: ColorRGB,
): ColorRGB {
  const nDotV = Math.max(0, dot(normal, view));
  const nDotL = Math.max(0, dot(normal, lightDir));

  // F0: dielectrics use 0.04, metals use the albedo (tinted specular).
  const f0: ColorRGB = mat.metalness >= 0.5
    ? [mat.albedo[0], mat.albedo[1], mat.albedo[2]]
    : [0.04, 0.04, 0.04];

  const diffuseWeight = 1 - mat.metalness;
  const out: ColorRGB = [0, 0, 0];

  // Ambient: approximated as Lambert albedo · ambient
  addTo(
    out,
    mat.albedo[0] * ambientColor[0] * diffuseWeight,
    mat.albedo[1] * ambientColor[1] * diffuseWeight,
    mat.albedo[2] * ambientColor[2] * diffuseWeight,
  );

  if (nDotL > 0) {
    // Diffuse (Lambert)
    const diffCoef = diffuseWeight / Math.PI;
    addTo(
      out,
      mat.albedo[0] * diffCoef * lightColor[0] * nDotL,
      mat.albedo[1] * diffCoef * lightColor[1] * nDotL,
      mat.albedo[2] * diffCoef * lightColor[2] * nDotL,
    );

    // Specular (Cook-Torrance, GGX)
    const hx = view[0] + lightDir[0];
    const hy = view[1] + lightDir[1];
    const hz = view[2] + lightDir[2];
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
      addTo(
        out,
        F[0] * specCoef * lightColor[0] * nDotL,
        F[1] * specCoef * lightColor[1] * nDotL,
        F[2] * specCoef * lightColor[2] * nDotL,
      );
    }
  }

  return out;
}

// ─── Baking ───────────────────────────────────────────────────────────────────

export interface SHBakeLighting {
  keyLightDir: Tuple3;
  keyLightColor: ColorRGB;
  ambientColor: ColorRGB;
}

/**
 * Bake per-splat SH coefficients by sampling view directions on the full
 * sphere (views from "below" the surface contribute zero via BRDF cos terms,
 * which is the correct behavior). 256 samples strike a good balance between
 * coefficient quality and baking cost at scene-mount time.
 */
export function bakeMaterialSH(
  mat: SHMaterial,
  normal: Tuple3,
  lighting: SHBakeLighting,
  numSamples: number = 256,
): Float32Array {
  const dirs = fibonacciSphere(numSamples);
  const samples: Array<{ dir: Tuple3; color: ColorRGB }> = [];
  for (const dir of dirs) {
    const color = evaluateBRDF(
      mat,
      normal,
      dir,
      lighting.keyLightDir,
      lighting.keyLightColor,
      lighting.ambientColor,
    );
    samples.push({ dir, color });
  }
  return bakeSHFromSamples(samples);
}

// ─── Scene generation ─────────────────────────────────────────────────────────

export interface SHSceneConfig {
  gaussiansPerSphere: number;
  sphereRadius: number;
  lighting: SHBakeLighting;
  /** Number of view-direction samples per splat during baking. */
  bakeSamples: number;
}

/** World positions for each demo sphere, laid out left→right by material. */
export const SH_SPHERE_POSITIONS: Record<SHMaterialId, Tuple3> = {
  diffuse: [-1.5, 0.6, 0],
  glossy: [0, 0.6, 0],
  metallic: [1.5, 0.6, 0],
};

function mulberry32(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function sampleSphereSurface(
  center: Tuple3,
  radius: number,
  rng: () => number,
): { pos: Tuple3; normal: Tuple3 } {
  // Uniform on unit sphere via inverse CDF.
  const theta = rng() * Math.PI * 2;
  const z = 2 * rng() - 1;
  const r = Math.sqrt(Math.max(0, 1 - z * z));
  const normal: Tuple3 = [Math.cos(theta) * r, Math.sin(theta) * r, z];
  const pos: Tuple3 = [
    center[0] + normal[0] * radius,
    center[1] + normal[1] * radius,
    center[2] + normal[2] * radius,
  ];
  return { pos, normal };
}

/**
 * Build a full SH scene: splats on the surface of one sphere per material,
 * each carrying pre-baked L=2 SH coefficients.
 */
export function generateSHSceneGaussians(cfg: SHSceneConfig): SHGaussian[] {
  const out: SHGaussian[] = [];
  let id = 0;
  // Per-splat Gaussian extent — small enough to resolve specular highlights.
  const scale = Math.max(0.03, cfg.sphereRadius * 0.085);

  for (const matId of ['diffuse', 'glossy', 'metallic'] as const) {
    const mat = SH_MATERIALS[matId];
    const center = SH_SPHERE_POSITIONS[matId];
    const rng = mulberry32(0x5eed + id);

    for (let i = 0; i < cfg.gaussiansPerSphere; i++) {
      const { pos, normal } = sampleSphereSurface(center, cfg.sphereRadius, rng);
      const shCoefficients = bakeMaterialSH(mat, normal, cfg.lighting, cfg.bakeSamples);
      const g: SHGaussian = {
        id: id++,
        position: pos,
        initialPosition: pos,
        scale: [scale, scale, scale],
        rotation: [0, 0, 0],
        color: [mat.albedo[0], mat.albedo[1], mat.albedo[2]], // DC fallback
        opacity: 0.92,
        normal,
        shCoefficients,
        materialId: matId,
      };
      out.push(g);
    }
  }
  return out;
}

/** Convenience: drop SH fields for code paths that only need the base type. */
export function asReconGaussian(g: SHGaussian): ReconGaussian {
  const { normal: _normal, shCoefficients: _sh, materialId: _m, ...rest } = g;
  void _normal;
  void _sh;
  void _m;
  return rest;
}
