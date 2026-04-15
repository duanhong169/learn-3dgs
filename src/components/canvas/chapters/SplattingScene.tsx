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

  // Compute 3D covariance and project to 2D
  const { cov3D, ellipseParams } = useMemo(() => {
    const cov = buildCovarianceMatrix(gaussianScale, gaussianRotation);

    // The Gaussian is at origin, virtual camera is at virtualCamPos
    // Focal lengths (arbitrary for visualization)
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

  // Screen plane position: behind the Gaussian from the virtual camera's perspective
  const screenPlanePos: [number, number, number] = useMemo(() => {
    // Place screen plane opposite the virtual camera
    const dir = new THREE.Vector3(-virtualCamPos[0], -virtualCamPos[1], -virtualCamPos[2]).normalize();
    return [dir.x * 3, dir.y * 3, dir.z * 3];
  }, [virtualCamPos]);

  // Screen plane rotation: face the virtual camera
  const screenPlaneRotation = useMemo(() => {
    const dir = new THREE.Vector3(
      virtualCamPos[0] - screenPlanePos[0],
      virtualCamPos[1] - screenPlanePos[1],
      virtualCamPos[2] - screenPlanePos[2],
    ).normalize();
    const euler = new THREE.Euler();
    const quaternion = new THREE.Quaternion();
    const lookMatrix = new THREE.Matrix4();
    lookMatrix.lookAt(new THREE.Vector3(0, 0, 0), dir, new THREE.Vector3(0, 1, 0));
    quaternion.setFromRotationMatrix(lookMatrix);
    euler.setFromQuaternion(quaternion);
    return [euler.x, euler.y, euler.z] as [number, number, number];
  }, [virtualCamPos, screenPlanePos]);

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

      {/* Screen plane showing 2D projection */}
      <group position={screenPlanePos} rotation={screenPlaneRotation}>
        <ScreenPlane
          position={[0, 0, 0]}
          size={[2.5, 2.5]}
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
        imagePlanePoint={screenPlanePos}
        visible={showProjectionLines}
      />
    </group>
  );
}
