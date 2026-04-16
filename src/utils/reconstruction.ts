/**
 * Utility functions for generating Gaussian parameters that approximate
 * simple geometric shapes, used in the reconstruction demo chapter.
 *
 * Strategy: sample points both on surfaces and inside volumes so the
 * reconstruction looks solid, not hollow. Use InstancedMesh for performance.
 */

import type { Tuple3 } from '@/types/common';

/** Parameters for a single Gaussian in the reconstruction. */
export interface ReconGaussian {
  id: number;
  /** Target (converged) position. */
  position: Tuple3;
  /** Initial (random) position before optimization. */
  initialPosition: Tuple3;
  scale: Tuple3;
  rotation: Tuple3;
  /** Color as [r, g, b] in 0-1 range. */
  color: Tuple3;
  opacity: number;
}

// --- Seeded pseudo-random number generator (deterministic) ---

function createRng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/** Gaussian-distributed random number (Box-Muller, mean=0, std=1). */
function gaussRandom(rng: () => number): number {
  const u1 = rng();
  const u2 = rng();
  return Math.sqrt(-2 * Math.log(Math.max(u1, 1e-10))) * Math.cos(2 * Math.PI * u2);
}

// --- Hex color → RGB ---

function hexToRgb(hex: string): Tuple3 {
  const h = hex.replace('#', '');
  return [
    parseInt(h.substring(0, 2), 16) / 255,
    parseInt(h.substring(2, 4), 16) / 255,
    parseInt(h.substring(4, 6), 16) / 255,
  ];
}

// --- Volume sampling helpers ---

/** Sample a point inside or on a sphere. */
function sampleSphere(
  center: Tuple3,
  radius: number,
  rng: () => number,
  surfaceOnly: boolean,
): Tuple3 {
  const theta = rng() * Math.PI * 2;
  const phi = Math.acos(2 * rng() - 1);
  const r = surfaceOnly ? radius : radius * Math.cbrt(rng());
  return [
    center[0] + r * Math.sin(phi) * Math.cos(theta),
    center[1] + r * Math.sin(phi) * Math.sin(theta),
    center[2] + r * Math.cos(phi),
  ];
}

/** Sample a point inside or on a box. */
function sampleBox(
  center: Tuple3,
  size: Tuple3,
  rng: () => number,
  surfaceOnly: boolean,
): Tuple3 {
  if (!surfaceOnly) {
    return [
      center[0] + (rng() - 0.5) * size[0],
      center[1] + (rng() - 0.5) * size[1],
      center[2] + (rng() - 0.5) * size[2],
    ];
  }
  // Surface sampling
  const hx = size[0] / 2;
  const hy = size[1] / 2;
  const hz = size[2] / 2;
  const face = Math.floor(rng() * 6);
  const u = rng() * 2 - 1;
  const v = rng() * 2 - 1;
  let x: number, y: number, z: number;
  switch (face) {
    case 0: x = hx;  y = u * hy; z = v * hz; break;
    case 1: x = -hx; y = u * hy; z = v * hz; break;
    case 2: y = hy;  x = u * hx; z = v * hz; break;
    case 3: y = -hy; x = u * hx; z = v * hz; break;
    case 4: z = hz;  x = u * hx; y = v * hy; break;
    default: z = -hz; x = u * hx; y = v * hy; break;
  }
  return [center[0] + x, center[1] + y, center[2] + z];
}

/** Sample a point inside or on a cylinder. */
function sampleCylinder(
  center: Tuple3,
  radius: number,
  height: number,
  rng: () => number,
  surfaceOnly: boolean,
): Tuple3 {
  if (!surfaceOnly) {
    const r = radius * Math.sqrt(rng());
    const theta = rng() * Math.PI * 2;
    const h = (rng() - 0.5) * height;
    return [
      center[0] + r * Math.cos(theta),
      center[1] + h,
      center[2] + r * Math.sin(theta),
    ];
  }
  // Surface: 70% side, 15% top, 15% bottom
  const roll = rng();
  if (roll < 0.7) {
    const theta = rng() * Math.PI * 2;
    const h = (rng() - 0.5) * height;
    return [
      center[0] + radius * Math.cos(theta),
      center[1] + h,
      center[2] + radius * Math.sin(theta),
    ];
  }
  const r = radius * Math.sqrt(rng());
  const theta = rng() * Math.PI * 2;
  const yOff = roll < 0.85 ? height / 2 : -height / 2;
  return [
    center[0] + r * Math.cos(theta),
    center[1] + yOff,
    center[2] + r * Math.sin(theta),
  ];
}

/** Sample a point on a flat plane with slight y jitter. */
function samplePlane(
  center: Tuple3,
  sizeX: number,
  sizeZ: number,
  rng: () => number,
): Tuple3 {
  return [
    center[0] + (rng() - 0.5) * sizeX,
    center[1] + gaussRandom(rng) * 0.015,
    center[2] + (rng() - 0.5) * sizeZ,
  ];
}

// --- Scene definition ---

/** The ground truth scene geometry for the reconstruction demo. */
export const SCENE_OBJECTS = {
  ground: {
    center: [0, -0.5, 0] as Tuple3,
    sizeX: 6,
    sizeZ: 6,
    color: '#8b7355',
  },
  sphere: {
    center: [-1.5, 0.5, 0] as Tuple3,
    radius: 0.8,
    color: '#e74c3c',
  },
  box: {
    center: [0, 0.25, -1] as Tuple3,
    size: [1, 1, 1] as Tuple3,
    color: '#3498db',
  },
  cylinder: {
    center: [1.5, 0.15, 0.5] as Tuple3,
    radius: 0.5,
    height: 1.3,
    color: '#2ecc71',
  },
};

/**
 * Gaussian counts per density level (1-5) per object.
 * Mix of volume and surface samples so objects look solid.
 */
const DENSITY_COUNTS = {
  1: { ground: 80,  sphere: 60,  box: 50,  cylinder: 45 },
  2: { ground: 160, sphere: 120, box: 100, cylinder: 90 },
  3: { ground: 300, sphere: 200, box: 160, cylinder: 140 },
  4: { ground: 500, sphere: 350, box: 280, cylinder: 250 },
  5: { ground: 700, sphere: 500, box: 400, cylinder: 350 },
} as const;

type DensityLevel = keyof typeof DENSITY_COUNTS;

/** Gaussian scale per density level — smaller gaussians for finer detail. */
const DENSITY_SCALE: Record<DensityLevel, number> = {
  1: 0.20,
  2: 0.15,
  3: 0.11,
  4: 0.085,
  5: 0.07,
};

/**
 * Generate Gaussian parameters that approximate the scene geometry.
 * Uses a seeded RNG so results are deterministic for each density level.
 */
export function generateSceneGaussians(densityLevel: number): ReconGaussian[] {
  const level = Math.max(1, Math.min(5, Math.round(densityLevel))) as DensityLevel;
  const counts = DENSITY_COUNTS[level];
  const baseScale = DENSITY_SCALE[level];
  const rng = createRng(42 + level);

  const gaussians: ReconGaussian[] = [];
  let id = 0;

  const addGaussian = (
    pos: Tuple3,
    colorHex: string,
    scaleMultiplier: Tuple3 = [1, 1, 1],
    opacityBase = 0.85,
  ) => {
    const gs = baseScale;
    // Slight color variation for a more natural look
    const baseColor = hexToRgb(colorHex);
    const variation = 0.06;
    const color: Tuple3 = [
      Math.min(1, Math.max(0, baseColor[0] + (rng() - 0.5) * variation)),
      Math.min(1, Math.max(0, baseColor[1] + (rng() - 0.5) * variation)),
      Math.min(1, Math.max(0, baseColor[2] + (rng() - 0.5) * variation)),
    ];
    gaussians.push({
      id: id++,
      position: pos,
      initialPosition: [
        pos[0] + (rng() - 0.5) * 5,
        pos[1] + rng() * 3 + 1,
        pos[2] + (rng() - 0.5) * 5,
      ],
      scale: [
        gs * scaleMultiplier[0] * (0.8 + rng() * 0.4),
        gs * scaleMultiplier[1] * (0.8 + rng() * 0.4),
        gs * scaleMultiplier[2] * (0.8 + rng() * 0.4),
      ],
      rotation: [rng() * 360, rng() * 360, rng() * 360],
      color,
      opacity: opacityBase + rng() * (1 - opacityBase),
    });
  };

  // Ground plane — flat gaussians covering the surface
  for (let i = 0; i < counts.ground; i++) {
    const pos = samplePlane(
      SCENE_OBJECTS.ground.center,
      SCENE_OBJECTS.ground.sizeX,
      SCENE_OBJECTS.ground.sizeZ,
      rng,
    );
    addGaussian(pos, SCENE_OBJECTS.ground.color, [1.0, 0.15, 1.0], 0.9);
  }

  // Sphere — mix volume (60%) and surface (40%)
  const sphereSurface = Math.floor(counts.sphere * 0.4);
  for (let i = 0; i < counts.sphere; i++) {
    const surfaceOnly = i < sphereSurface;
    const pos = sampleSphere(
      SCENE_OBJECTS.sphere.center,
      SCENE_OBJECTS.sphere.radius,
      rng,
      surfaceOnly,
    );
    addGaussian(pos, SCENE_OBJECTS.sphere.color, [1, 1, 1], 0.88);
  }

  // Box — mix volume (60%) and surface (40%)
  const boxSurface = Math.floor(counts.box * 0.4);
  for (let i = 0; i < counts.box; i++) {
    const surfaceOnly = i < boxSurface;
    const pos = sampleBox(
      SCENE_OBJECTS.box.center,
      SCENE_OBJECTS.box.size,
      rng,
      surfaceOnly,
    );
    addGaussian(pos, SCENE_OBJECTS.box.color, [0.8, 0.8, 0.8], 0.88);
  }

  // Cylinder — mix volume (60%) and surface (40%)
  const cylSurface = Math.floor(counts.cylinder * 0.4);
  for (let i = 0; i < counts.cylinder; i++) {
    const surfaceOnly = i < cylSurface;
    const pos = sampleCylinder(
      SCENE_OBJECTS.cylinder.center,
      SCENE_OBJECTS.cylinder.radius,
      SCENE_OBJECTS.cylinder.height,
      rng,
      surfaceOnly,
    );
    addGaussian(pos, SCENE_OBJECTS.cylinder.color, [0.9, 1.0, 0.9], 0.88);
  }

  return gaussians;
}

/** Interpolate a position between initial (random) and target (converged). */
export function interpolatePosition(
  initial: Tuple3,
  target: Tuple3,
  t: number,
): Tuple3 {
  const s = Math.min(1, Math.max(0, t));
  // Use ease-out cubic for smoother convergence
  const e = 1 - Math.pow(1 - s, 3);
  return [
    initial[0] + (target[0] - initial[0]) * e,
    initial[1] + (target[1] - initial[1]) * e,
    initial[2] + (target[2] - initial[2]) * e,
  ];
}
