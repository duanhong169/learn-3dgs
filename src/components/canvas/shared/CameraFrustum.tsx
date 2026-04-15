import { useMemo } from 'react';
import { Line } from '@react-three/drei';
import * as THREE from 'three';

export interface CameraFrustumProps {
  position?: [number, number, number];
  lookAt?: [number, number, number];
  fov?: number;
  aspect?: number;
  near?: number;
  far?: number;
  color?: string;
}

/**
 * Renders a wireframe camera frustum showing the virtual viewing camera.
 */
export function CameraFrustum({
  position = [3, 2, 3],
  lookAt = [0, 0, 0],
  fov = 50,
  aspect = 1.5,
  near = 0.5,
  far = 4,
  color = '#58a6ff',
}: CameraFrustumProps) {
  const { points } = useMemo(() => {
    const halfFovRad = (fov * Math.PI) / 360;
    const nearH = Math.tan(halfFovRad) * near;
    const nearW = nearH * aspect;
    const farH = Math.tan(halfFovRad) * far;
    const farW = farH * aspect;

    // Camera looks from position toward lookAt; build a basis
    const dir = new THREE.Vector3(...lookAt).sub(new THREE.Vector3(...position)).normalize();
    const up = new THREE.Vector3(0, 1, 0);
    const right = new THREE.Vector3().crossVectors(dir, up).normalize();
    const camUp = new THREE.Vector3().crossVectors(right, dir).normalize();

    const nearCenter = new THREE.Vector3(...position).add(dir.clone().multiplyScalar(near));
    const farCenter = new THREE.Vector3(...position).add(dir.clone().multiplyScalar(far));

    // Near plane corners
    const ntl = nearCenter.clone().add(camUp.clone().multiplyScalar(nearH)).sub(right.clone().multiplyScalar(nearW));
    const ntr = nearCenter.clone().add(camUp.clone().multiplyScalar(nearH)).add(right.clone().multiplyScalar(nearW));
    const nbl = nearCenter.clone().sub(camUp.clone().multiplyScalar(nearH)).sub(right.clone().multiplyScalar(nearW));
    const nbr = nearCenter.clone().sub(camUp.clone().multiplyScalar(nearH)).add(right.clone().multiplyScalar(nearW));

    // Far plane corners
    const ftl = farCenter.clone().add(camUp.clone().multiplyScalar(farH)).sub(right.clone().multiplyScalar(farW));
    const ftr = farCenter.clone().add(camUp.clone().multiplyScalar(farH)).add(right.clone().multiplyScalar(farW));
    const fbl = farCenter.clone().sub(camUp.clone().multiplyScalar(farH)).sub(right.clone().multiplyScalar(farW));
    const fbr = farCenter.clone().sub(camUp.clone().multiplyScalar(farH)).add(right.clone().multiplyScalar(farW));

    const toArr = (v: THREE.Vector3): [number, number, number] => [v.x, v.y, v.z];

    return {
      points: {
        origin: toArr(new THREE.Vector3(...position)),
        ntl: toArr(ntl), ntr: toArr(ntr), nbl: toArr(nbl), nbr: toArr(nbr),
        ftl: toArr(ftl), ftr: toArr(ftr), fbl: toArr(fbl), fbr: toArr(fbr),
      },
      imagePlanePoints: [toArr(ftl), toArr(ftr), toArr(fbr), toArr(fbl)],
    };
  }, [position, lookAt, fov, aspect, near, far]);

  const p = points;

  return (
    <group>
      {/* Camera body dot */}
      <mesh position={position}>
        <sphereGeometry args={[0.08, 8, 8]} />
        <meshBasicMaterial color={color} />
      </mesh>

      {/* Frustum edges */}
      <Line points={[p.origin, p.ftl]} color={color} lineWidth={1} transparent opacity={0.5} />
      <Line points={[p.origin, p.ftr]} color={color} lineWidth={1} transparent opacity={0.5} />
      <Line points={[p.origin, p.fbl]} color={color} lineWidth={1} transparent opacity={0.5} />
      <Line points={[p.origin, p.fbr]} color={color} lineWidth={1} transparent opacity={0.5} />

      {/* Near plane */}
      <Line points={[p.ntl, p.ntr, p.nbr, p.nbl, p.ntl]} color={color} lineWidth={1} />

      {/* Far plane (image plane) */}
      <Line points={[p.ftl, p.ftr, p.fbr, p.fbl, p.ftl]} color={color} lineWidth={1.5} />

      {/* Image plane fill */}
      <mesh
        position={[
          (p.ftl[0] + p.fbr[0]) / 2,
          (p.ftl[1] + p.fbr[1]) / 2,
          (p.ftl[2] + p.fbr[2]) / 2,
        ]}
      >
        <planeGeometry args={[
          Math.sqrt((p.ftr[0] - p.ftl[0]) ** 2 + (p.ftr[1] - p.ftl[1]) ** 2 + (p.ftr[2] - p.ftl[2]) ** 2),
          Math.sqrt((p.ftl[0] - p.fbl[0]) ** 2 + (p.ftl[1] - p.fbl[1]) ** 2 + (p.ftl[2] - p.fbl[2]) ** 2),
        ]} />
        <meshBasicMaterial color={color} transparent opacity={0.08} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}
