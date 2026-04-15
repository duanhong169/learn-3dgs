import { useMemo } from 'react';

import { GaussianEllipsoid } from '@/components/canvas/shared/GaussianEllipsoid';
import { AxisArrows } from '@/components/canvas/shared/AxisArrows';
import { useGaussianBasicsStore } from '@/store/useGaussianBasicsStore';
import { sampleGaussian3D } from '@/utils/gaussian';

/**
 * Chapter 1: 3D Gaussian Basics — Interactive visualization of a single Gaussian.
 */
export function GaussianBasicsScene() {
  const position = useGaussianBasicsStore((s) => s.position);
  const scale = useGaussianBasicsStore((s) => s.scale);
  const rotation = useGaussianBasicsStore((s) => s.rotation);
  const color = useGaussianBasicsStore((s) => s.color);
  const opacity = useGaussianBasicsStore((s) => s.opacity);
  const showSamples = useGaussianBasicsStore((s) => s.showSamples);
  const showAxes = useGaussianBasicsStore((s) => s.showAxes);
  const showBoundingBox = useGaussianBasicsStore((s) => s.showBoundingBox);

  // Generate sample points (recreated when scale changes)
  const samplePoints = useMemo(() => {
    if (!showSamples) return [];
    return sampleGaussian3D(scale, 200);
  }, [scale, showSamples]);

  const rotRad: [number, number, number] = useMemo(
    () => [
      (rotation[0] * Math.PI) / 180,
      (rotation[1] * Math.PI) / 180,
      (rotation[2] * Math.PI) / 180,
    ],
    [rotation],
  );

  return (
    <group>
      {/* Main Gaussian ellipsoid */}
      <GaussianEllipsoid
        position={position}
        scale={scale}
        rotation={rotation}
        color={color}
        opacity={opacity}
      />

      {/* Axis arrows showing principal directions */}
      {showAxes && (
        <AxisArrows
          position={position}
          scale={scale}
          rotation={rotation}
        />
      )}

      {/* 3σ bounding box */}
      {showBoundingBox && (
        <mesh position={position} rotation={rotRad}>
          <boxGeometry args={[2, 2, 2]} />
          <meshBasicMaterial
            color="#ffffff"
            wireframe
            transparent
            opacity={0.2}
          />
        </mesh>
      )}

      {/* Sample points */}
      {showSamples && samplePoints.length > 0 && (
        <group position={position} rotation={rotRad}>
          {samplePoints.map((point, i) => (
            <mesh key={i} position={point}>
              <sphereGeometry args={[0.02, 4, 4]} />
              <meshBasicMaterial color={color} />
            </mesh>
          ))}
        </group>
      )}
    </group>
  );
}
