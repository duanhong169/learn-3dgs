import { useMemo, useEffect } from 'react';
import * as THREE from 'three';

import { GaussianEllipsoid } from '@/components/canvas/shared/GaussianEllipsoid';
import { CameraFrustum } from '@/components/canvas/shared/CameraFrustum';
import { ScreenPlane } from '@/components/canvas/shared/ScreenPlane';
import { ProjectionRays } from '@/components/canvas/shared/ProjectionRays';
import { useSplattingStore } from '@/store/useSplattingStore';
import { buildCovarianceMatrix, degToRad } from '@/utils/math';
import { computeProjectionJacobian, projectCovariance3Dto2D, covarianceToEllipse } from '@/utils/projection';

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

  // Compute 3D covariance and project to 2D
  const { cov3D, ellipseParams } = useMemo(() => {
    const cov = buildCovarianceMatrix(gaussianScale, gaussianRotation);
    const fx = 2;
    const fy = 2;
    const jacobian = computeProjectionJacobian(
      -virtualCamPos[0], -virtualCamPos[1], -virtualCamPos[2],
      fx, fy,
    );
    const cov2D = projectCovariance3Dto2D(cov, jacobian);
    const ellipse = covarianceToEllipse(cov2D);
    return { cov3D: cov, cov2D, ellipseParams: ellipse };
  }, [gaussianScale, gaussianRotation, virtualCamPos]);

  // Update store with computed covariances
  useEffect(() => {
    setCovariance3D(cov3D);
  }, [cov3D, setCovariance3D]);

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
