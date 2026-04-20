import * as THREE from 'three';

import { SH_MATERIALS, SH_SPHERE_POSITIONS } from '@/utils/sh-scene';

import type { SHMaterialId } from '@/utils/sh-scene';

export interface GroundTruthSpheresProps {
  /** Sphere radius (must match SHGaussianCloud). */
  radius: number;
  /** Optional world-space Y offset (e.g. to place reference spheres above SH cloud). */
  yOffset?: number;
  /** Only show the selected material; null = all three. */
  onlyMaterial?: SHMaterialId | null;
  /** Render as wireframe (useful in overlay mode to avoid occluding SH cloud). */
  wireframe?: boolean;
  /** Material opacity (1 = fully opaque). */
  opacity?: number;
}

/**
 * Reference spheres rendered with meshStandardMaterial — they respond to the
 * scene's ambient + directional lights and produce "real" view-dependent shading
 * that our baked SH coefficients are meant to approximate. Useful for A/B
 * comparison at step 1 / step 4 / step 6.
 */
export function GroundTruthSpheres({
  radius,
  yOffset = 0,
  onlyMaterial = null,
  wireframe = false,
  opacity = 1,
}: GroundTruthSpheresProps) {
  const materials = (['diffuse', 'glossy', 'metallic'] as const).filter(
    (id) => onlyMaterial === null || onlyMaterial === id,
  );

  const transparent = opacity < 1;

  return (
    <group>
      {materials.map((id) => {
        const mat = SH_MATERIALS[id];
        const basePos = SH_SPHERE_POSITIONS[id];
        const color = new THREE.Color(mat.albedo[0], mat.albedo[1], mat.albedo[2]);
        return (
          <mesh key={id} position={[basePos[0], basePos[1] + yOffset, basePos[2]]}>
            <sphereGeometry args={[radius, 48, 48]} />
            <meshStandardMaterial
              color={color}
              roughness={mat.roughness}
              metalness={mat.metalness}
              wireframe={wireframe}
              transparent={transparent}
              opacity={opacity}
              depthWrite={!transparent}
            />
          </mesh>
        );
      })}
    </group>
  );
}
