import * as THREE from 'three';

/**
 * Custom ShaderMaterial that renders a sphere with Gaussian density falloff
 * and optional Spherical Harmonics (SH) view-dependent coloring.
 *
 * Uniforms:
 * - uColor: vec3 — Base Gaussian color (used when SH is disabled)
 * - uOpacity: float — base opacity
 * - uScale: vec3 — per-axis scale (σx, σy, σz)
 * - uSHOrder: int — SH order (0=constant, 1=linear, 2=quadratic, 3=cubic)
 * - uSHCoeffs: vec3[16] — SH coefficients (RGB per basis function)
 * - uUseSH: bool — whether to use SH coloring
 */

const vertexShader = /* glsl */ `
  varying vec3 vLocalPosition;
  varying vec3 vNormal;
  varying vec3 vWorldPosition;

  void main() {
    vLocalPosition = position;
    vNormal = normalize(normalMatrix * normal);
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPos.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform vec3 uScale;
  uniform int uSHOrder;
  uniform vec3 uSHCoeffs[16];
  uniform bool uUseSH;

  varying vec3 vLocalPosition;
  varying vec3 vNormal;
  varying vec3 vWorldPosition;

  // SH basis function constants
  const float SH_C0 = 0.28209479;  // 1/(2*sqrt(pi))
  const float SH_C1 = 0.48860251;  // sqrt(3)/(2*sqrt(pi))
  const float SH_C2_0 = 1.09254843;  // sqrt(15)/(2*sqrt(pi))
  const float SH_C2_1 = 0.31539157;  // sqrt(5)/(4*sqrt(pi))
  const float SH_C2_2 = 0.54627422;  // sqrt(15)/(4*sqrt(pi))
  const float SH_C3_0 = 0.59004360;
  const float SH_C3_1 = 2.89061144;
  const float SH_C3_2 = 0.45704579;
  const float SH_C3_3 = 0.37317633;

  vec3 evaluateSH(vec3 dir) {
    float x = dir.x;
    float y = dir.y;
    float z = dir.z;

    // Order 0 (1 basis)
    vec3 result = uSHCoeffs[0] * SH_C0;

    if (uSHOrder < 1) return result;

    // Order 1 (3 bases)
    result += uSHCoeffs[1] * SH_C1 * y;
    result += uSHCoeffs[2] * SH_C1 * z;
    result += uSHCoeffs[3] * SH_C1 * x;

    if (uSHOrder < 2) return result;

    // Order 2 (5 bases)
    float xx = x * x, yy = y * y, zz = z * z;
    float xy = x * y, yz = y * z, xz = x * z;
    result += uSHCoeffs[4] * SH_C2_0 * xy;
    result += uSHCoeffs[5] * SH_C2_0 * yz;
    result += uSHCoeffs[6] * SH_C2_1 * (3.0 * zz - 1.0);
    result += uSHCoeffs[7] * SH_C2_0 * xz;
    result += uSHCoeffs[8] * SH_C2_2 * (xx - yy);

    if (uSHOrder < 3) return result;

    // Order 3 (7 bases)
    result += uSHCoeffs[9]  * SH_C3_3 * y * (3.0 * xx - yy);
    result += uSHCoeffs[10] * SH_C3_0 * xy * z;
    result += uSHCoeffs[11] * SH_C3_2 * y * (5.0 * zz - 1.0);
    result += uSHCoeffs[12] * SH_C3_1 * z * (5.0 * zz - 3.0);
    result += uSHCoeffs[13] * SH_C3_2 * x * (5.0 * zz - 1.0);
    result += uSHCoeffs[14] * SH_C3_0 * z * (xx - yy);
    result += uSHCoeffs[15] * SH_C3_3 * x * (xx - 3.0 * yy);

    return result;
  }

  void main() {
    vec3 normalized = vLocalPosition;
    float r2 = dot(normalized, normalized);

    // Gaussian falloff
    float density = exp(-2.0 * r2);

    // View-dependent opacity
    float edgeFade = max(0.0, dot(vNormal, vec3(0.0, 0.0, 1.0)));
    edgeFade = mix(0.3, 1.0, edgeFade);

    float alpha = density * uOpacity * edgeFade;

    // Color: either SH-based or fixed
    vec3 color;
    if (uUseSH) {
      // Compute view direction in world space
      vec3 viewDir = normalize(vWorldPosition - cameraPosition);
      // SH evaluates color based on view direction
      color = evaluateSH(viewDir);
      // Sigmoid activation to map SH output to [0,1] range
      color = 1.0 / (1.0 + exp(-color));
    } else {
      color = uColor;
    }

    gl_FragColor = vec4(color, alpha);
  }
`;

/** Default SH coefficients: all zeros except DC term. */
function defaultSHCoeffs(): THREE.Vector3[] {
  const coeffs: THREE.Vector3[] = [];
  for (let i = 0; i < 16; i++) {
    coeffs.push(new THREE.Vector3(0, 0, 0));
  }
  // DC term = neutral gray
  coeffs[0] = new THREE.Vector3(0.5, 0.5, 0.5);
  return coeffs;
}

export function createGaussianMaterial(
  color: THREE.Color = new THREE.Color('#4ecdc4'),
  opacity: number = 0.7,
  scale: THREE.Vector3 = new THREE.Vector3(1, 1, 1),
  shOrder: number = 0,
  shCoeffs: THREE.Vector3[] = defaultSHCoeffs(),
  useSH: boolean = false,
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      uColor: { value: color },
      uOpacity: { value: opacity },
      uScale: { value: scale },
      uSHOrder: { value: shOrder },
      uSHCoeffs: { value: shCoeffs },
      uUseSH: { value: useSH },
    },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.NormalBlending,
  });
}
