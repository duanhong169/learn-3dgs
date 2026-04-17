# 3DGS Learning Project: Exploration Report

## EXECUTIVE SUMMARY

This 3DGS learning project has well-organized utilities for:
1. 3D-to-2D projection of Gaussians
2. Alpha compositing for blending
3. Canvas-based rendering to display

Key utilities to reuse for a camera rendered view panel:
- Projection: computeProjectionJacobian, projectCovariance3Dto2D, covarianceToEllipse
- Blending: alphaComposite 
- Display: ScreenPlane canvas texture pattern
- Shader: ReconstructionScene exp(-3*r²) for density

---

## 1. PROJECTION UTILITIES (src/utils/projection.ts)

### computeProjectionJacobian(x, y, z, fx, fy) -> [6]
Returns 2x3 Jacobian of perspective projection
Formula: J = [[fx/z, 0, -fx*x/z²], [0, fy/z, -fy*y/z²]]
Maps 3D perturbations to 2D screen changes
Used for covariance projection

### projectCovariance3Dto2D(cov3D, jacobian) -> [4]
Projects 3x3 covariance to 2x2 using Jacobian  
Formula: Σ_2D = J · Σ_3D · J^T
CORE FUNCTION: Defines splat footprint shape in 2D

### covarianceToEllipse(cov) -> {radiusX, radiusY, angle}
Eigenvalue decomposition of 2x2 covariance
Extracts principal axes radii and rotation
Uses 2σ for 95% confidence interval

---

## 2. ALPHA BLENDING UTILITIES (src/utils/blending.ts)

### alphaComposite(colors, opacities)
Front-to-back alpha compositing
Formula: C_final = Σ_i (c_i · α_i · T_i) where T_i = Π_{j<i} (1 - α_j)
REQUIREMENT: Input MUST be pre-sorted front-to-back by depth
Returns: {finalColor: [r,g,b], steps: []}
Features: Early termination, per-step tracking

### evaluateGaussian1D(x, center, sigma)
Formula: exp(-0.5 * ((x - center) / sigma)²)

---

## 3. TYPES (src/types/gaussian.ts)

GaussianParams:
- position: Tuple3
- scale: Tuple3
- rotation: Tuple3 (degrees)
- color: string (hex)
- opacity: number [0,1]

Matrix3 = 9-element flat array (row-major)
Matrix2 = 4-element flat array (row-major)

---

## 4. KEY COMPONENTS

### SplattingScene.tsx - Projection Visualization
Workflow:
1. buildCovarianceMatrix(scale, rotation)
2. computeProjectionJacobian(pos, fx, fy)
3. projectCovariance3Dto2D(cov3D, jacobian)
4. covarianceToEllipse(cov2D)

### AlphaBlendingScene.tsx - Blending Visualization
- Splats sorted by depth, positioned on Z-axis
- Step-through mode reveals splats progressively

### GaussianSplat2D.tsx - Billboard Rendering
Canvas texture with radial gradient for Gaussian falloff
Always faces camera (billboard)

### ScreenPlane.tsx - DIRECTLY REUSABLE
Module-level singleton canvas and CanvasTexture
Update in useEffect, signal needsUpdate = true

FOR CAMERA VIEW:
1. Project Gaussians to 2D
2. Sort by depth
3. Per pixel: collect covering Gaussians, use alphaComposite
4. Draw to canvas, display on ScreenPlane

### CameraFrustum.tsx - Camera Visualization
Computes frustum corners from position, lookAt, FOV

### ReconstructionScene.tsx - GPU Rendering
InstancedMesh for many objects
Custom shader: exp(-3 * r²) for Gaussian density
Per-instance opacity handling

---

## 5. MATH UTILITIES (src/utils/math.ts)

buildCovarianceMatrix(scale, rotation) -> Σ = R · S · S^T · R^T
buildRotationMatrix(rx, ry, rz) - Euler to rotation (XYZ)
buildScaleMatrix(sx, sy, sz) - Diagonal matrix
Matrix operations: multiply3x3, transpose3x3, etc.

---

## 6. RECONSTRUCTION (src/utils/reconstruction.ts)

ReconGaussian: {id, position, initialPosition, scale, rotation, color: RGB, opacity}
Seeded RNG: Deterministic sampling
Volume & surface sampling: sampleSphere, sampleBox, sampleCylinder, samplePlane
generateSceneGaussians(densityLevel): 5 levels with 60% volume + 40% surface

---

## 7. TWO APPROACHES FOR CAMERA VIEW PANEL

### Option A: Canvas-Based CPU (Simple)
1. Project all Gaussians to 2D
2. For each pixel: find covering Gaussians, alphaComposite
3. Draw to canvas

Pros: Reuses all utilities
Cons: CPU-intensive

### Option B: GPU/Shader (Better)  
1. WebGLRenderTarget
2. Each Gaussian as billboard with additive blending
3. Display result

Pros: Real-time, scalable
Cons: More complex

---

## 8. REUSABLE COMPONENTS

From projection.ts:
- computeProjectionJacobian() -> Jacobian
- projectCovariance3Dto2D() -> 2D covariance  
- covarianceToEllipse() -> ellipse params

From blending.ts:
- alphaComposite() -> blend sorted Gaussians

From components:
- ScreenPlane: Canvas texture display
- GaussianSplat2D: Billboard logic
- CameraFrustum: Frustum computation
- ReconstructionScene shader: exp(-3*r²)

---

## 9. RECOMMENDATIONS

1. Copy projection + blending to camera view component
2. Use ScreenPlane pattern for display
3. Adapt ReconstructionScene shader for GPU rendering
4. Add UI panel to reconstruction chapter
5. Performance: Cache projections, use WebWorker, frustum cull

---

## FILE ORGANIZATION

src/
├── utils/projection.ts (Jacobian, covariance proj)
├── utils/blending.ts (Alpha compositing)
├── utils/math.ts (Matrix ops)
├── utils/reconstruction.ts (Scene generation)
├── types/gaussian.ts (Types)
├── components/canvas/chapters/
│   ├── SplattingScene.tsx (Ch2)
│   ├── AlphaBlendingScene.tsx (Ch3)
│   └── ReconstructionScene.tsx (Ch5)
└── components/canvas/shared/
    ├── ScreenPlane.tsx (Canvas display)
    ├── GaussianSplat2D.tsx (Billboard)
    └── CameraFrustum.tsx (Camera viz)


## 10. DETAILED FUNCTION SIGNATURES

### Projection Functions

computeProjectionJacobian(
  x: number,      // Camera-space X
  y: number,      // Camera-space Y
  z: number,      // Camera-space Z (depth)
  fx: number,     // Focal length X
  fy: number      // Focal length Y
): [number, number, number, number, number, number]
// Returns flat 2x3 matrix: [j00, j01, j02, j10, j11, j12]

projectCovariance3Dto2D(
  cov3D: Matrix3,                           // 9-element array
  jacobian: [number, number, number, number, number, number]  // 6-element
): Matrix2  // Returns 4-element array [c00, c01, c10, c11]

covarianceToEllipse(cov: Matrix2): {
  radiusX: number,
  radiusY: number,
  angle: number  // in radians
}

### Blending Functions

alphaComposite(
  colors: Array<[number, number, number]>,  // RGB [0,1]
  opacities: number[]                        // Alpha [0,1]
): {
  finalColor: [number, number, number],
  steps: Array<{
    index: number,
    color: [number, number, number],
    alpha: number,
    transmittance: number,
    contribution: number,
    accumulatedColor: [number, number, number]
  }>
}

evaluateGaussian1D(
  x: number,
  center: number,
  sigma: number
): number  // Density [0, 1]

### Math Functions

buildCovarianceMatrix(
  scale: [number, number, number],
  rotation: [number, number, number]  // Degrees
): Matrix3  // 9-element covariance matrix

buildRotationMatrix(
  rx: number,  // Degrees
  ry: number,  // Degrees
  rz: number   // Degrees, XYZ order
): Matrix3

buildScaleMatrix(
  sx: number,
  sy: number,
  sz: number
): Matrix3

---

## 11. IMPLEMENTATION PATTERN FOR CAMERA VIEW

```typescript
// Pseudocode for camera rendered view

function renderGaussianView(
  gaussians: ReconGaussian[],
  cameraPos: Tuple3,
  cameraLookAt: Tuple3,
  imageWidth: number = 512,
  imageHeight: number = 512
): THREE.CanvasTexture {
  
  // 1. Set up canvas
  const canvas = document.createElement('canvas')
  canvas.width = imageWidth
  canvas.height = imageHeight
  const ctx = canvas.getContext('2d')!
  const imageData = ctx.createImageData(imageWidth, imageHeight)
  const data = imageData.data
  
  // 2. Camera parameters
  const fx = 500  // focal length x (pixels)
  const fy = 500  // focal length y (pixels)
  
  // 3. Project each Gaussian to 2D
  const projected = gaussians.map((g) => {
    // Transform to camera space
    const camPos = transformToCamera(g.position, cameraPos, cameraLookAt)
    
    // Compute Jacobian at this position
    const jacobian = computeProjectionJacobian(
      camPos[0], camPos[1], camPos[2], fx, fy
    )
    
    // Build 3D covariance
    const cov3D = buildCovarianceMatrix(g.scale, g.rotation)
    
    // Project to 2D
    const cov2D = projectCovariance3Dto2D(cov3D, jacobian)
    const ellipse = covarianceToEllipse(cov2D)
    
    // Normalize screen coordinates
    const screenX = (camPos[0] / camPos[2]) * fx + imageWidth / 2
    const screenY = (camPos[1] / camPos[2]) * fy + imageHeight / 2
    
    return {
      screenX, screenY,
      radiusX: ellipse.radiusX,
      radiusY: ellipse.radiusY,
      angle: ellipse.angle,
      color: hexToRGB(g.color),
      opacity: g.opacity,
      depth: camPos[2]  // For sorting
    }
  })
  
  // 4. Sort by depth (front-to-back)
  projected.sort((a, b) => a.depth - b.depth)
  
  // 5. Render to canvas (per-pixel)
  for (let py = 0; py < imageHeight; py++) {
    for (let px = 0; px < imageWidth; px++) {
      // Find all Gaussians covering this pixel
      const covering = projected.filter((p) => {
        const dx = px - p.screenX
        const dy = py - p.screenY
        
        // Transform to ellipse space
        const cos_a = Math.cos(-p.angle)
        const sin_a = Math.sin(-p.angle)
        const x = dx * cos_a - dy * sin_a
        const y = dx * sin_a + dy * cos_a
        
        // Check ellipse
        const r2 = (x / p.radiusX) ** 2 + (y / p.radiusY) ** 2
        return r2 <= 1
      })
      
      if (covering.length > 0) {
        // Extract colors and opacities
        const colors = covering.map((p) => p.color)
        const opacities = covering.map((p) => p.opacity)
        
        // Composite
        const { finalColor } = alphaComposite(colors, opacities)
        
        // Write to pixel
        const idx = (py * imageWidth + px) * 4
        data[idx + 0] = Math.round(finalColor[0] * 255)
        data[idx + 1] = Math.round(finalColor[1] * 255)
        data[idx + 2] = Math.round(finalColor[2] * 255)
        data[idx + 3] = 255
      } else {
        // White background
        const idx = (py * imageWidth + px) * 4
        data[idx + 0] = 255
        data[idx + 1] = 255
        data[idx + 2] = 255
        data[idx + 3] = 255
      }
    }
  }
  
  // 6. Update canvas and return texture
  ctx.putImageData(imageData, 0, 0)
  return new THREE.CanvasTexture(canvas)
}
```

---

## 12. PERFORMANCE CONSIDERATIONS

**Canvas-Based Rendering**
- O(width × height × numGaussians) complexity
- 512×512 × 1000 Gaussians = 262M operations per frame
- Cache projected covariances between camera moves
- Use WebWorker for pixel computation
- Pre-filter Gaussians by frustum

**GPU-Based Rendering**
- Render each Gaussian as billboard once
- Fragment shader handles density per pixel
- Additive blending combines contributions
- Much faster for interactive use
- More complex shader setup required

---

## 13. INTEGRATION CHECKLIST

- [ ] Copy projection.ts utilities to camera view module
- [ ] Copy blending.ts utilities
- [ ] Copy math.ts helpers (buildCovarianceMatrix, etc.)
- [ ] Create canvas rendering function
- [ ] Add ScreenPlane for texture display
- [ ] Set up camera controls (azimuth, elevation, distance)
- [ ] Test projection math with known Gaussians
- [ ] Optimize per-pixel computation
- [ ] Add UI panel to reconstruction chapter
- [ ] Optional: Switch to GPU-based rendering

---

## 14. TESTING STRATEGY

1. Test with single Gaussian at known position
2. Verify Jacobian computation matches reference
3. Test covariance projection with identity covariance
4. Verify depth sorting with overlapping Gaussians
5. Compare rendered image with expected output
6. Profile performance and optimize hotspots
7. Compare with ground truth geometry (opacity-weighted)

---

## QUICK REFERENCE: CORE REUSABLE CODE

projection.ts:
- computeProjectionJacobian: Get Jacobian at 3D point
- projectCovariance3Dto2D: Project covariance using Jacobian
- covarianceToEllipse: Ellipse params from covariance

blending.ts:
- alphaComposite: Blend sorted colors with alphas

math.ts:
- buildCovarianceMatrix: Σ = R · S · S^T · R^T
- buildRotationMatrix: Euler to rotation matrix
- multiply3x3, transpose3x3: Matrix ops

shared components:
- ScreenPlane.tsx: Canvas texture display pattern
- GaussianSplat2D.tsx: Billboard rendering logic
- CameraFrustum.tsx: Frustum computation
- ReconstructionScene.tsx: GPU rendering pattern (exp(-3*r²))

This covers all utilities needed to render Gaussians from a camera view!
