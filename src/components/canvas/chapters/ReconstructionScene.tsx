import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

import { useReconstructionStore } from '@/store/useReconstructionStore';
import { CameraRenderedView } from '@/components/canvas/shared/CameraRenderedView';
import { CameraFrustum } from '@/components/canvas/shared/CameraFrustum';
import {
  generateSceneGaussians,
  interpolatePosition,
  SCENE_OBJECTS,
} from '@/utils/reconstruction';

import type { InstancedMesh } from 'three';
import type { Tuple3 } from '@/types/common';
import type { ReconGaussian } from '@/utils/reconstruction';

// Reusable temp objects — allocated once, mutated in loops
const _position = new THREE.Vector3();
const _scale = new THREE.Vector3();
const _quaternion = new THREE.Quaternion();
const _euler = new THREE.Euler();
const _matrix = new THREE.Matrix4();
const _color = new THREE.Color();

// --- Custom ShaderMaterial for instanced Gaussians with per-instance opacity ---

const gaussianInstanceVertexShader = /* glsl */ `
  attribute float instanceOpacity;
  varying vec3 vColor;
  varying float vOpacity;
  varying vec3 vLocalPos;

  void main() {
    vColor = instanceColor;
    vOpacity = instanceOpacity;
    vLocalPos = position;
    vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const gaussianInstanceFragmentShader = /* glsl */ `
  varying vec3 vColor;
  varying float vOpacity;
  varying vec3 vLocalPos;

  void main() {
    float r2 = dot(vLocalPos, vLocalPos);
    float density = exp(-3.0 * r2);
    float alpha = density * vOpacity;
    if (alpha < 0.01) discard;
    gl_FragColor = vec4(vColor, alpha);
  }
`;

function createGaussianInstanceMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: gaussianInstanceVertexShader,
    fragmentShader: gaussianInstanceFragmentShader,
    transparent: true,
    depthWrite: false,
    side: THREE.FrontSide,
  });
}

/**
 * Populate all instance matrices, colors, and per-instance opacity.
 */
function populateInstances(
  mesh: InstancedMesh,
  gaussians: ReconGaussian[],
  animationProgress: number,
  overlayOpacity: number,
) {
  const count = gaussians.length;
  const opacityArray = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    const g = gaussians[i]!;
    const pos: Tuple3 =
      animationProgress < 1
        ? interpolatePosition(g.initialPosition, g.position, animationProgress)
        : g.position;

    _position.set(pos[0], pos[1], pos[2]);
    _euler.set(
      (g.rotation[0] * Math.PI) / 180,
      (g.rotation[1] * Math.PI) / 180,
      (g.rotation[2] * Math.PI) / 180,
    );
    _quaternion.setFromEuler(_euler);
    _scale.set(g.scale[0], g.scale[1], g.scale[2]);
    _matrix.compose(_position, _quaternion, _scale);
    mesh.setMatrixAt(i, _matrix);

    _color.setRGB(g.color[0], g.color[1], g.color[2]);
    mesh.setColorAt(i, _color);

    const fadeIn = animationProgress < 0.3 ? animationProgress / 0.3 : 1;
    opacityArray[i] = g.opacity * fadeIn * overlayOpacity;
  }

  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.geometry.setAttribute(
    'instanceOpacity',
    new THREE.InstancedBufferAttribute(opacityArray, 1),
  );
}

// ─── Sub-component: Gaussian cloud ────────────────────────────────────────────

interface GaussianCloudProps {
  gaussians: ReconGaussian[];
  overlayOpacity: number;
  showCenters: boolean;
}

function GaussianCloud({ gaussians, overlayOpacity, showCenters }: GaussianCloudProps) {
  const meshRef = useRef<InstancedMesh>(null);
  const centersRef = useRef<InstancedMesh>(null);
  const count = gaussians.length;

  const sphereGeo = useMemo(() => new THREE.SphereGeometry(1, 10, 10), []);
  const material = useMemo(() => createGaussianInstanceMaterial(), []);
  const centerGeo = useMemo(() => new THREE.SphereGeometry(1, 4, 4), []);
  const centerMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#ffffff' }), []);

  const gaussiansRef = useRef(gaussians);
  gaussiansRef.current = gaussians;
  const overlayRef = useRef(overlayOpacity);
  overlayRef.current = overlayOpacity;

  useEffect(() => {
    if (!meshRef.current) return;
    const progress = useReconstructionStore.getState().animationProgress;
    populateInstances(meshRef.current, gaussians, progress, overlayOpacity);
  }, [gaussians, overlayOpacity]);

  useEffect(() => {
    if (!centersRef.current || !showCenters) return;
    const progress = useReconstructionStore.getState().animationProgress;
    const centerSize = 0.025;
    for (let i = 0; i < count; i++) {
      const g = gaussians[i]!;
      const pos: Tuple3 =
        progress < 1
          ? interpolatePosition(g.initialPosition, g.position, progress)
          : g.position;
      _position.set(pos[0], pos[1], pos[2]);
      _scale.set(centerSize, centerSize, centerSize);
      _quaternion.identity();
      _matrix.compose(_position, _quaternion, _scale);
      centersRef.current.setMatrixAt(i, _matrix);
    }
    centersRef.current.instanceMatrix.needsUpdate = true;
  }, [gaussians, count, showCenters]);

  useFrame((_, delta) => {
    const store = useReconstructionStore.getState();
    if (store.isAnimating && store.animationProgress < 1) {
      const next = Math.min(1, store.animationProgress + delta * 0.25);
      store.setAnimationProgress(next);
      if (next >= 1) {
        useReconstructionStore.setState({ isAnimating: false });
      }
      if (meshRef.current) {
        populateInstances(meshRef.current, gaussiansRef.current, next, overlayRef.current);
      }
    }
  });

  return (
    <>
      <instancedMesh ref={meshRef} args={[sphereGeo, material, count]} frustumCulled={false} />
      {showCenters && (
        <instancedMesh ref={centersRef} args={[centerGeo, centerMat, count]} frustumCulled={false} />
      )}
    </>
  );
}

// ─── Main scene component ─────────────────────────────────────────────────────

/**
 * Chapter 5: 3DGS Reconstruction Demo.
 */
export function ReconstructionScene() {
  const viewMode = useReconstructionStore((s) => s.viewMode);
  const densityLevel = useReconstructionStore((s) => s.densityLevel);
  const showWireframe = useReconstructionStore((s) => s.showWireframe);
  const showGaussianCenters = useReconstructionStore((s) => s.showGaussianCenters);
  const animationProgress = useReconstructionStore((s) => s.animationProgress);
  const cameraAzimuth = useReconstructionStore((s) => s.cameraAzimuth);
  const cameraElevation = useReconstructionStore((s) => s.cameraElevation);
  const cameraDistance = useReconstructionStore((s) => s.cameraDistance);
  const cameraFocalLength = useReconstructionStore((s) => s.cameraFocalLength);
  const useCameraPixelEvaluation = useReconstructionStore((s) => s.useCameraPixelEvaluation);

  const gaussians = useMemo(
    () => generateSceneGaussians(densityLevel),
    [densityLevel],
  );

  // Compute animated gaussians with interpolated positions for camera render
  const animatedGaussians = useMemo(() => {
    if (animationProgress >= 1) return gaussians;
    return gaussians.map((g) => ({
      ...g,
      position: interpolatePosition(g.initialPosition, g.position, animationProgress),
    }));
  }, [gaussians, animationProgress]);

  // Virtual camera position from spherical coordinates
  const virtualCameraPos = useMemo((): Tuple3 => {
    const azRad = (cameraAzimuth * Math.PI) / 180;
    const elRad = (cameraElevation * Math.PI) / 180;
    return [
      cameraDistance * Math.cos(elRad) * Math.sin(azRad),
      cameraDistance * Math.sin(elRad) + 0.25,
      cameraDistance * Math.cos(elRad) * Math.cos(azRad),
    ];
  }, [cameraAzimuth, cameraElevation, cameraDistance]);

  const cameraLookAt: Tuple3 = [0, 0.25, 0];

  // Show gaussian cloud in gaussian, overlay, AND cameraRender modes
  const showGroundTruth = viewMode === 'groundTruth' || viewMode === 'overlay';
  const showGaussians = viewMode === 'gaussian' || viewMode === 'overlay' || viewMode === 'cameraRender';
  const showCameraRender = viewMode === 'cameraRender';
  const gtOpacity = viewMode === 'overlay' ? 0.35 : 1;
  const gaussianOpacity =
    viewMode === 'overlay' ? 0.7 : viewMode === 'cameraRender' ? 0.4 : 1;

  // Compute the frustum far-plane center and orientation so the rendered
  // image sits exactly on the camera frustum's far plane, facing the camera.
  const frustumFar = cameraDistance * 0.6;
  const frustumFov = 45;

  const { displayPosition, displayQuaternion, displaySize } = useMemo(() => {
    // Direction from camera to lookAt
    const dx = cameraLookAt[0] - virtualCameraPos[0];
    const dy = cameraLookAt[1] - virtualCameraPos[1];
    const dz = cameraLookAt[2] - virtualCameraPos[2];
    const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const fwd: Tuple3 = [dx / len, dy / len, dz / len];

    // Far-plane center = camera + forward * far
    const farCenter: Tuple3 = [
      virtualCameraPos[0] + fwd[0] * frustumFar,
      virtualCameraPos[1] + fwd[1] * frustumFar,
      virtualCameraPos[2] + fwd[2] * frustumFar,
    ];

    // Size of the far plane (matches frustum geometry)
    const halfH = Math.tan((frustumFov * Math.PI) / 360) * frustumFar;
    const planeSize: [number, number] = [halfH * 2, halfH * 2]; // aspect=1

    // Build a rotation that makes the plane face toward the camera.
    // Plane default normal = +Z. We need it pointing from farCenter → cameraPos.
    const backDir = new THREE.Vector3(
      virtualCameraPos[0] - farCenter[0],
      virtualCameraPos[1] - farCenter[1],
      virtualCameraPos[2] - farCenter[2],
    ).normalize();

    // Build an orthonormal basis: right, up, forward (= backDir)
    const worldUp = new THREE.Vector3(0, 1, 0);
    const right = new THREE.Vector3().crossVectors(worldUp, backDir).normalize();
    const up = new THREE.Vector3().crossVectors(backDir, right).normalize();

    // Construct rotation matrix from basis (columns = right, up, backDir)
    const rotMatrix = new THREE.Matrix4().makeBasis(right, up, backDir);
    const quat = new THREE.Quaternion().setFromRotationMatrix(rotMatrix);
    const q: [number, number, number, number] = [quat.x, quat.y, quat.z, quat.w];

    return { displayPosition: farCenter, displayQuaternion: q, displaySize: planeSize };
  }, [virtualCameraPos, cameraLookAt, frustumFar, frustumFov]);

  return (
    <group>
      {/* Ground Truth geometry */}
      {showGroundTruth && (
        <group>
          <mesh position={SCENE_OBJECTS.ground.center} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[SCENE_OBJECTS.ground.sizeX, SCENE_OBJECTS.ground.sizeZ]} />
            <meshStandardMaterial
              color={SCENE_OBJECTS.ground.color}
              wireframe={showWireframe}
              transparent={viewMode === 'overlay'}
              opacity={gtOpacity}
            />
          </mesh>
          <mesh position={SCENE_OBJECTS.sphere.center}>
            <sphereGeometry args={[SCENE_OBJECTS.sphere.radius, 32, 32]} />
            <meshStandardMaterial
              color={SCENE_OBJECTS.sphere.color}
              wireframe={showWireframe}
              transparent={viewMode === 'overlay'}
              opacity={gtOpacity}
            />
          </mesh>
          <mesh position={SCENE_OBJECTS.box.center}>
            <boxGeometry args={SCENE_OBJECTS.box.size} />
            <meshStandardMaterial
              color={SCENE_OBJECTS.box.color}
              wireframe={showWireframe}
              transparent={viewMode === 'overlay'}
              opacity={gtOpacity}
            />
          </mesh>
          <mesh position={SCENE_OBJECTS.cylinder.center}>
            <cylinderGeometry
              args={[
                SCENE_OBJECTS.cylinder.radius,
                SCENE_OBJECTS.cylinder.radius,
                SCENE_OBJECTS.cylinder.height,
                32,
              ]}
            />
            <meshStandardMaterial
              color={SCENE_OBJECTS.cylinder.color}
              wireframe={showWireframe}
              transparent={viewMode === 'overlay'}
              opacity={gtOpacity}
            />
          </mesh>
        </group>
      )}

      {/* Gaussian cloud — visible in gaussian, overlay, and cameraRender modes */}
      {showGaussians && (
        <GaussianCloud
          key={densityLevel}
          gaussians={gaussians}
          overlayOpacity={gaussianOpacity}
          showCenters={showGaussianCenters}
        />
      )}

      {/* Camera Render mode: virtual camera frustum + rendered image */}
      {showCameraRender && (
        <>
          {/* Virtual camera frustum visualization */}
          <CameraFrustum
            position={virtualCameraPos}
            lookAt={cameraLookAt}
            fov={45}
            aspect={1}
            near={0.3}
            far={cameraDistance * 0.6}
            color="#58a6ff"
          />

          {/* 2D rendered view — placed on the frustum far plane */}
          <CameraRenderedView
            key={`render-${densityLevel}-${cameraAzimuth}-${cameraElevation}-${cameraDistance}-${cameraFocalLength}-${useCameraPixelEvaluation}`}
            gaussians={animatedGaussians}
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
