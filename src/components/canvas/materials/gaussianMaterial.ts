import * as THREE from 'three';

/**
 * Custom ShaderMaterial that renders a sphere with Gaussian density falloff.
 * The sphere is rendered as a unit sphere geometry, and the shader computes
 * exp(-0.5 * r²) where r is the distance from center in the ellipsoid's local space.
 *
 * Uniforms:
 * - uColor: vec3 — Gaussian color
 * - uOpacity: float — base opacity
 * - uScale: vec3 — per-axis scale (σx, σy, σz)
 */

const vertexShader = /* glsl */ `
  varying vec3 vLocalPosition;
  varying vec3 vNormal;

  void main() {
    vLocalPosition = position;
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform vec3 uScale;

  varying vec3 vLocalPosition;
  varying vec3 vNormal;

  void main() {
    // Distance from center in unit-sphere space
    // (position is already in local space of the mesh, which is scaled to uScale)
    vec3 normalized = vLocalPosition; // position in unit sphere [-1, 1]
    float r2 = dot(normalized, normalized);

    // Gaussian falloff: 1 at center, ~0 at surface of unit sphere
    float density = exp(-2.0 * r2);

    // View-dependent opacity: use normal to compute angle-based falloff
    // This gives a more volumetric feel
    float edgeFade = max(0.0, dot(vNormal, vec3(0.0, 0.0, 1.0)));
    edgeFade = mix(0.3, 1.0, edgeFade);

    float alpha = density * uOpacity * edgeFade;

    gl_FragColor = vec4(uColor, alpha);
  }
`;

export function createGaussianMaterial(
  color: THREE.Color = new THREE.Color('#4ecdc4'),
  opacity: number = 0.7,
  scale: THREE.Vector3 = new THREE.Vector3(1, 1, 1),
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      uColor: { value: color },
      uOpacity: { value: opacity },
      uScale: { value: scale },
    },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.NormalBlending,
  });
}
