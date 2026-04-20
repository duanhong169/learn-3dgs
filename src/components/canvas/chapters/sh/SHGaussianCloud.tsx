import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';

import type { SHGaussian } from '@/utils/spherical-harmonics';
import type { InstancedMesh } from 'three';

// Reusable temp objects to avoid per-frame allocations
const _position = new THREE.Vector3();
const _quaternion = new THREE.Quaternion();
const _scale = new THREE.Vector3();
const _matrix = new THREE.Matrix4();

/**
 * Per-splat GLSL shader that evaluates L=2 real SH in the vertex stage based
 * on the view direction from the camera to the splat center. Because each
 * splat is a small sphere, view direction barely varies across its surface,
 * so per-splat SH evaluation is indistinguishable from per-fragment while
 * using drastically fewer varying slots.
 *
 * Per-instance attributes (packed as 7 × vec4 = 28 slots for 27 SH floats +
 * 1 opacity in the 28th slot):
 *
 *   sh0 : (R0, R1, R2, R3)
 *   sh1 : (R4, R5, R6, R7)
 *   sh2 : (R8, G0, G1, G2)
 *   sh3 : (G3, G4, G5, G6)
 *   sh4 : (G7, G8, B0, B1)
 *   sh5 : (B2, B3, B4, B5)
 *   sh6 : (B6, B7, B8, instanceOpacity)
 *
 * This keeps us under the 16-attribute WebGL hard limit once you add in
 * three.js built-ins (position + instanceMatrix = 5 slots).
 *
 * `cameraPosition` is a built-in uniform auto-provided by three.js.
 */
const vertexShader = /* glsl */ `
  attribute vec4 sh0;
  attribute vec4 sh1;
  attribute vec4 sh2;
  attribute vec4 sh3;
  attribute vec4 sh4;
  attribute vec4 sh5;
  attribute vec4 sh6;

  uniform int uHighlightBasis;  // -1 = reconstructed color; >=0 isolate basis i

  varying float vOpacity;
  varying vec3 vLocalPos;
  varying vec3 vColor;

  const float C0  = 0.28209479177387814;
  const float C1  = 0.4886025119029199;
  const float C2a = 1.0925484305920792;
  const float C2b = 0.31539156525252005;
  const float C2c = 0.5462742152960396;

  void main() {
    vOpacity = sh6.w;
    vLocalPos = position;

    vec4 worldPos = modelMatrix * instanceMatrix * vec4(position, 1.0);
    vec4 centerW = modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);

    vec3 viewDir = normalize(cameraPosition - centerW.xyz);
    float x = viewDir.x; float y = viewDir.y; float z = viewDir.z;

    // Build the 9 SH basis values once
    float b[9];
    b[0] = C0;
    b[1] = C1 * y;
    b[2] = C1 * z;
    b[3] = C1 * x;
    b[4] = C2a * x * y;
    b[5] = C2a * y * z;
    b[6] = C2b * (3.0 * z * z - 1.0);
    b[7] = C2a * x * z;
    b[8] = C2c * (x * x - y * y);

    // Unpack coefficient layout (see comment above)
    float R[9];
    R[0] = sh0.x; R[1] = sh0.y; R[2] = sh0.z; R[3] = sh0.w;
    R[4] = sh1.x; R[5] = sh1.y; R[6] = sh1.z; R[7] = sh1.w;
    R[8] = sh2.x;
    float G[9];
    G[0] = sh2.y; G[1] = sh2.z; G[2] = sh2.w;
    G[3] = sh3.x; G[4] = sh3.y; G[5] = sh3.z; G[6] = sh3.w;
    G[7] = sh4.x; G[8] = sh4.y;
    float B[9];
    B[0] = sh4.z; B[1] = sh4.w;
    B[2] = sh5.x; B[3] = sh5.y; B[4] = sh5.z; B[5] = sh5.w;
    B[6] = sh6.x; B[7] = sh6.y; B[8] = sh6.z;

    if (uHighlightBasis >= 0) {
      int i = uHighlightBasis;
      float bi = b[i];
      float mag = abs(bi) * 2.0;
      if (bi >= 0.0) {
        vColor = vec3(mag, 0.1, 0.1);
      } else {
        vColor = vec3(0.1, 0.1, mag);
      }
    } else {
      float r = 0.0; float g = 0.0; float bc = 0.0;
      for (int i = 0; i < 9; i++) {
        r  += R[i] * b[i];
        g  += G[i] * b[i];
        bc += B[i] * b[i];
      }
      vColor = max(vec3(r, g, bc), vec3(0.0));
    }

    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

const fragmentShader = /* glsl */ `
  varying float vOpacity;
  varying vec3 vLocalPos;
  varying vec3 vColor;

  void main() {
    float r2 = dot(vLocalPos, vLocalPos);
    float density = exp(-2.0 * r2);
    float alpha = density * vOpacity;
    if (alpha < 0.01) discard;
    gl_FragColor = vec4(vColor, alpha);
  }
`;

/**
 * Pack 27 SH floats + 1 opacity per splat into 7 × vec4 (28 floats).
 * See shader comment above for the exact channel layout.
 */
function packAttributes(gaussians: SHGaussian[], overlayOpacity: number): Float32Array[] {
  const n = gaussians.length;
  const buffers: Float32Array[] = [];
  for (let i = 0; i < 7; i++) buffers.push(new Float32Array(n * 4));

  for (let i = 0; i < n; i++) {
    const g = gaussians[i]!;
    const sh = g.shCoefficients;
    const opacity = g.opacity * overlayOpacity;
    const base = i * 4;

    // sh0: R0..R3
    buffers[0]![base + 0] = sh[0]!;
    buffers[0]![base + 1] = sh[1]!;
    buffers[0]![base + 2] = sh[2]!;
    buffers[0]![base + 3] = sh[3]!;
    // sh1: R4..R7
    buffers[1]![base + 0] = sh[4]!;
    buffers[1]![base + 1] = sh[5]!;
    buffers[1]![base + 2] = sh[6]!;
    buffers[1]![base + 3] = sh[7]!;
    // sh2: R8, G0..G2
    buffers[2]![base + 0] = sh[8]!;
    buffers[2]![base + 1] = sh[9]!;
    buffers[2]![base + 2] = sh[10]!;
    buffers[2]![base + 3] = sh[11]!;
    // sh3: G3..G6
    buffers[3]![base + 0] = sh[12]!;
    buffers[3]![base + 1] = sh[13]!;
    buffers[3]![base + 2] = sh[14]!;
    buffers[3]![base + 3] = sh[15]!;
    // sh4: G7, G8, B0, B1
    buffers[4]![base + 0] = sh[16]!;
    buffers[4]![base + 1] = sh[17]!;
    buffers[4]![base + 2] = sh[18]!;
    buffers[4]![base + 3] = sh[19]!;
    // sh5: B2..B5
    buffers[5]![base + 0] = sh[20]!;
    buffers[5]![base + 1] = sh[21]!;
    buffers[5]![base + 2] = sh[22]!;
    buffers[5]![base + 3] = sh[23]!;
    // sh6: B6, B7, B8, opacity
    buffers[6]![base + 0] = sh[24]!;
    buffers[6]![base + 1] = sh[25]!;
    buffers[6]![base + 2] = sh[26]!;
    buffers[6]![base + 3] = opacity;
  }
  return buffers;
}

export interface SHGaussianCloudProps {
  gaussians: SHGaussian[];
  /** Optional overlay opacity multiplier. */
  overlayOpacity?: number;
  /** Highlight a single basis function; null/negative = normal SH rendering. */
  highlightBasisIndex?: number | null;
}

export function SHGaussianCloud({
  gaussians,
  overlayOpacity = 1,
  highlightBasisIndex = null,
}: SHGaussianCloudProps) {
  const meshRef = useRef<InstancedMesh>(null);
  const count = gaussians.length;

  const sphereGeo = useMemo(() => new THREE.SphereGeometry(1, 10, 10), []);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        transparent: true,
        depthWrite: false,
        side: THREE.FrontSide,
        uniforms: {
          uHighlightBasis: { value: highlightBasisIndex ?? -1 },
        },
      }),
    // Only create material once — update uniforms via effect below
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useEffect(() => {
    material.uniforms.uHighlightBasis!.value = highlightBasisIndex ?? -1;
  }, [highlightBasisIndex, material]);

  useEffect(() => {
    if (!meshRef.current) return;
    const mesh = meshRef.current;

    for (let i = 0; i < count; i++) {
      const g = gaussians[i]!;
      _position.set(g.position[0], g.position[1], g.position[2]);
      _quaternion.identity();
      _scale.set(g.scale[0], g.scale[1], g.scale[2]);
      _matrix.compose(_position, _quaternion, _scale);
      mesh.setMatrixAt(i, _matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;

    const packed = packAttributes(gaussians, overlayOpacity);
    for (let i = 0; i < 7; i++) {
      mesh.geometry.setAttribute(`sh${i}`, new THREE.InstancedBufferAttribute(packed[i]!, 4));
    }
  }, [gaussians, count, overlayOpacity]);

  return (
    <instancedMesh
      ref={meshRef}
      args={[sphereGeo, material, count]}
      frustumCulled={false}
    />
  );
}
