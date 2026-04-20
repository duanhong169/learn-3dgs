import { useMemo } from 'react';
import * as THREE from 'three';

import { useChapterStore } from '@/store/useChapterStore';
import { useSHStore } from '@/store/useSHStore';
import { CameraFrustum } from '@/components/canvas/shared/CameraFrustum';
import {
  DEFAULT_SH_LIGHTING,
  SH_SPHERE_POSITIONS,
  generateSHSceneGaussians,
} from '@/utils/sh-scene';

import { SHGaussianCloud } from './sh/SHGaussianCloud';
import { GroundTruthSpheres } from './sh/GroundTruthSpheres';
import { SHBasisPreview } from './sh/SHBasisPreview';
import { BakingVisualizer } from './sh/BakingVisualizer';
import { SHCameraRenderedView } from './sh/SHCameraRenderedView';

import type { Tuple3 } from '@/types/common';

const SPHERE_RADIUS = 0.55;

/**
 * Chapter 6 scene: spherical-harmonic view-dependent colors.
 *
 * View-mode semantics (orthogonal to the step index):
 *   'sh'           — show the SH splat cloud only
 *   'groundTruth'  — show only the reference meshStandardMaterial spheres
 *   'overlay'      — show BOTH at the SAME position: SH cloud (opaque splats)
 *                    + GT spheres (semi-transparent wireframe shell) so the
 *                    user sees "real material vs SH reconstruction" A/B in-place
 *   'cameraRender' — show SH cloud + virtual camera frustum + CPU render plane
 *
 * The step index drives optional overlays (basis preview, baking visualizer)
 * but no longer forces view-mode content, so switching modes always behaves
 * the same way regardless of step.
 */
export function SphericalHarmonicsScene() {
  const step = useChapterStore((s) => s.instructionStep);

  const splatDensity = useSHStore((s) => s.splatDensity);
  const viewMode = useSHStore((s) => s.viewMode);
  const highlight = useSHStore((s) => s.highlightBasisIndex);
  const selectedMaterial = useSHStore((s) => s.selectedMaterial);
  const cameraAzimuth = useSHStore((s) => s.cameraAzimuth);
  const cameraElevation = useSHStore((s) => s.cameraElevation);
  const cameraDistance = useSHStore((s) => s.cameraDistance);
  const cameraFocalLength = useSHStore((s) => s.cameraFocalLength);
  const useCameraPixelEvaluation = useSHStore((s) => s.useCameraPixelEvaluation);

  // Generate (+ bake) SH splats. Expensive — regenerate only when density changes.
  const allGaussians = useMemo(
    () =>
      generateSHSceneGaussians({
        gaussiansPerSphere: splatDensity,
        sphereRadius: SPHERE_RADIUS,
        lighting: DEFAULT_SH_LIGHTING,
        bakeSamples: 256,
      }),
    [splatDensity],
  );

  const gaussians = useMemo(() => {
    if (selectedMaterial === 'all') return allGaussians;
    return allGaussians.filter((g) => g.materialId === selectedMaterial);
  }, [allGaussians, selectedMaterial]);

  // Visibility is driven purely by view-mode (plus step-specific overlays that
  // don't interact with the view-mode content).
  const showSHCloud = viewMode === 'sh' || viewMode === 'overlay' || viewMode === 'cameraRender';
  const showGroundTruth = viewMode === 'groundTruth' || viewMode === 'overlay';
  const showCameraRender = viewMode === 'cameraRender';
  const showBasisPreview = step === 1 || step === 2;
  const showBaking = step === 4;

  // Virtual camera for cameraRender mode
  const virtualCameraPos = useMemo((): Tuple3 => {
    const az = (cameraAzimuth * Math.PI) / 180;
    const el = (cameraElevation * Math.PI) / 180;
    return [
      cameraDistance * Math.cos(el) * Math.sin(az),
      cameraDistance * Math.sin(el) + 0.6,
      cameraDistance * Math.cos(el) * Math.cos(az),
    ];
  }, [cameraAzimuth, cameraElevation, cameraDistance]);

  // Center the virtual camera on the middle sphere
  const cameraLookAt: Tuple3 = SH_SPHERE_POSITIONS.glossy;

  const frustumFar = cameraDistance * 0.6;
  const frustumFov = (2 * Math.atan(256 / cameraFocalLength) * 180) / Math.PI;

  const { displayPosition, displayQuaternion, displaySize } = useMemo(() => {
    const dx = cameraLookAt[0] - virtualCameraPos[0];
    const dy = cameraLookAt[1] - virtualCameraPos[1];
    const dz = cameraLookAt[2] - virtualCameraPos[2];
    const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const fwd: Tuple3 = [dx / len, dy / len, dz / len];

    const farCenter: Tuple3 = [
      virtualCameraPos[0] + fwd[0] * frustumFar,
      virtualCameraPos[1] + fwd[1] * frustumFar,
      virtualCameraPos[2] + fwd[2] * frustumFar,
    ];

    const halfH = Math.tan((frustumFov * Math.PI) / 360) * frustumFar;
    const planeSize: [number, number] = [halfH * 2 * (16 / 9), halfH * 2];

    const backDir = new THREE.Vector3(
      virtualCameraPos[0] - farCenter[0],
      virtualCameraPos[1] - farCenter[1],
      virtualCameraPos[2] - farCenter[2],
    ).normalize();
    const worldUp = new THREE.Vector3(0, 1, 0);
    const right = new THREE.Vector3().crossVectors(worldUp, backDir).normalize();
    const up = new THREE.Vector3().crossVectors(backDir, right).normalize();
    const rotMatrix = new THREE.Matrix4().makeBasis(right, up, backDir);
    const quat = new THREE.Quaternion().setFromRotationMatrix(rotMatrix);
    const q: [number, number, number, number] = [quat.x, quat.y, quat.z, quat.w];
    return { displayPosition: farCenter, displayQuaternion: q, displaySize: planeSize };
  }, [virtualCameraPos, cameraLookAt, frustumFar, frustumFov]);

  return (
    <group>
      {showSHCloud && (
        <SHGaussianCloud
          key={`${splatDensity}-${selectedMaterial}`}
          gaussians={gaussians}
          overlayOpacity={1}
          highlightBasisIndex={step === 1 ? highlight : null}
        />
      )}

      {showGroundTruth && (
        <GroundTruthSpheres
          radius={SPHERE_RADIUS}
          // Overlay: GT occupies the same position as the SH cloud but renders
          // as a slightly-larger semi-transparent wireframe shell, so the user
          // sees SH splats filling the interior with GT surface outline around.
          // Pure groundTruth mode: opaque, in-place for a clean material showcase.
          yOffset={0}
          wireframe={viewMode === 'overlay'}
          opacity={viewMode === 'overlay' ? 0.35 : 1}
          onlyMaterial={selectedMaterial === 'all' ? null : selectedMaterial}
        />
      )}

      {/* Place basis preview to the side so it doesn't overlap the main scene */}
      {showBasisPreview && (
        <SHBasisPreview origin={[-3.5, 1.2, 0]} spacing={0.75} radius={0.25} highlightIndex={highlight} />
      )}

      {showBaking && <BakingVisualizer />}

      {showCameraRender && (
        <>
          <CameraFrustum
            position={virtualCameraPos}
            lookAt={cameraLookAt}
            fov={frustumFov}
            aspect={16 / 9}
            near={0.3}
            far={frustumFar}
            color="#58a6ff"
          />
          <SHCameraRenderedView
            key={`sh-cam-${splatDensity}-${selectedMaterial}`}
            gaussians={gaussians}
            cameraPos={virtualCameraPos}
            cameraLookAt={cameraLookAt}
            focalLength={cameraFocalLength}
            usePixelEvaluation={useCameraPixelEvaluation}
            displayPosition={displayPosition}
            displayQuaternion={displayQuaternion}
            displaySize={displaySize}
          />
        </>
      )}
    </group>
  );
}
