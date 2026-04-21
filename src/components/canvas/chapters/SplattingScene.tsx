import { useMemo, useEffect } from 'react';
import * as THREE from 'three';

import { GaussianEllipsoid } from '@/components/canvas/shared/GaussianEllipsoid';
import { CameraFrustum } from '@/components/canvas/shared/CameraFrustum';
import { ScreenPlane } from '@/components/canvas/shared/ScreenPlane';
import { ProjectionRays } from '@/components/canvas/shared/ProjectionRays';
import { useSplattingStore } from '@/store/useSplattingStore';
import { buildCovarianceMatrix, degToRad } from '@/utils/math';
import {
  computeProjectionJacobian,
  projectCovariance3Dto2D,
  covarianceToEllipse,
  rotateCovariance3D,
} from '@/utils/projection';

/**
 * Chapter 2: Splatting & Projection — Visualize how a 3D Gaussian projects to a 2D ellipse.
 */
export function SplattingScene() {
  const gaussianScale = useSplattingStore((s) => s.gaussianScale);
  const gaussianRotation = useSplattingStore((s) => s.gaussianRotation);
  const cameraAzimuth = useSplattingStore((s) => s.cameraAzimuth);
  const cameraElevation = useSplattingStore((s) => s.cameraElevation);
  const cameraDistance = useSplattingStore((s) => s.cameraDistance);
  const showProjectionLines = useSplattingStore((s) => s.showProjectionLines);
  const setCovariance3D = useSplattingStore((s) => s.setCovariance3D);
  const setCovariance2D = useSplattingStore((s) => s.setCovariance2D);

  // Virtual camera position orbiting around origin
  const virtualCamPos: [number, number, number] = useMemo(() => {
    const azRad = degToRad(cameraAzimuth);
    const elRad = degToRad(cameraElevation);
    const x = cameraDistance * Math.cos(elRad) * Math.sin(azRad);
    const y = cameraDistance * Math.sin(elRad);
    const z = cameraDistance * Math.cos(elRad) * Math.cos(azRad);
    return [x, y, z];
  }, [cameraAzimuth, cameraElevation, cameraDistance]);

  // Direction from camera to Gaussian (origin)
  const camDir = useMemo(() => {
    const dir = new THREE.Vector3(-virtualCamPos[0], -virtualCamPos[1], -virtualCamPos[2]).normalize();
    return dir;
  }, [virtualCamPos]);

  // Compute 3D covariance (world space), rotate into camera space, then project to 2D.
  // The Jacobian approximation is accurate only at the Gaussian's camera-space
  // position — since the Gaussian sits at the world origin, that position is
  // simply (0, 0, cameraDistance) in camera space, which keeps J well conditioned.
  const { cov3D, cov2D, ellipseParams } = useMemo(() => {
    const cov = buildCovarianceMatrix(gaussianScale, gaussianRotation);

    // Camera basis (world coordinates). `forward` points from the camera toward
    // the Gaussian at the origin; `right` and `up` are derived from a world-up
    // reference, matching three.js's Matrix4.lookAt convention.
    const forward: [number, number, number] = [camDir.x, camDir.y, camDir.z];
    const worldUp = new THREE.Vector3(0, 1, 0);
    const forwardV = new THREE.Vector3(...forward);
    const rightV = new THREE.Vector3().crossVectors(worldUp, forwardV).normalize();
    // Fallback when the camera looks straight up/down and `right` degenerates.
    if (rightV.lengthSq() < 1e-6) rightV.set(1, 0, 0);
    const upV = new THREE.Vector3().crossVectors(forwardV, rightV).normalize();
    const right: [number, number, number] = [rightV.x, rightV.y, rightV.z];
    const up: [number, number, number] = [upV.x, upV.y, upV.z];

    const covCam = rotateCovariance3D(cov, right, up, forward);

    const fx = 2;
    const fy = 2;
    // Gaussian's camera-space position: (0, 0, +cameraDistance).
    const jacobian = computeProjectionJacobian(0, 0, cameraDistance, fx, fy);
    const cov2DResult = projectCovariance3Dto2D(covCam, jacobian);
    const ellipse = covarianceToEllipse(cov2DResult);
    return { cov3D: cov, cov2D: cov2DResult, ellipseParams: ellipse };
  }, [gaussianScale, gaussianRotation, camDir, cameraDistance]);

  // Update store with computed covariances
  useEffect(() => {
    setCovariance3D(cov3D);
    setCovariance2D(cov2D);
  }, [cov3D, cov2D, setCovariance3D, setCovariance2D]);

  // Image plane: positioned between camera and Gaussian, at 40% from camera
  const imagePlaneDistance = cameraDistance * 0.4;
  const imagePlanePos: [number, number, number] = useMemo(() => [
    virtualCamPos[0] + camDir.x * imagePlaneDistance,
    virtualCamPos[1] + camDir.y * imagePlaneDistance,
    virtualCamPos[2] + camDir.z * imagePlaneDistance,
  ], [virtualCamPos, camDir, imagePlaneDistance]);

  // Image plane quaternion: face toward the camera
  const imagePlaneQuaternion = useMemo(() => {
    const lookDir = new THREE.Vector3(
      virtualCamPos[0] - imagePlanePos[0],
      virtualCamPos[1] - imagePlanePos[1],
      virtualCamPos[2] - imagePlanePos[2],
    ).normalize();
    const quat = new THREE.Quaternion();
    const mat = new THREE.Matrix4();
    mat.lookAt(new THREE.Vector3(0, 0, 0), lookDir, new THREE.Vector3(0, 1, 0));
    quat.setFromRotationMatrix(mat);
    return quat;
  }, [virtualCamPos, imagePlanePos]);

  // Image plane size: match frustum cross-section at that distance
  const planeSize = useMemo(() => {
    const halfFov = degToRad(50 / 2);
    const h = Math.tan(halfFov) * imagePlaneDistance * 2;
    const w = h * 1.2;
    return [w, h] as [number, number];
  }, [imagePlaneDistance]);

  return (
    <group>
      {/* The 3D Gaussian */}
      <GaussianEllipsoid
        position={[0, 0, 0]}
        scale={gaussianScale}
        rotation={gaussianRotation}
        color="#4ecdc4"
        opacity={0.6}
      />

      {/* Virtual camera frustum */}
      <CameraFrustum
        position={virtualCamPos}
        lookAt={[0, 0, 0]}
        fov={50}
        near={0.3}
        far={cameraDistance * 0.8}
        color="#58a6ff"
      />

      {/* Image plane showing 2D projection — placed inside the frustum */}
      <group
        position={imagePlanePos}
        quaternion={imagePlaneQuaternion}
      >
        <ScreenPlane
          position={[0, 0, 0]}
          size={planeSize}
          ellipse={{
            centerX: 0,
            centerY: 0,
            radiusX: ellipseParams.radiusX,
            radiusY: ellipseParams.radiusY,
            angle: ellipseParams.angle,
            color: '#4ecdc4',
          }}
        />
      </group>

      {/* Projection rays */}
      <ProjectionRays
        from={[0, 0, 0]}
        to={virtualCamPos}
        imagePlanePoint={imagePlanePos}
        visible={showProjectionLines}
      />
    </group>
  );
}
