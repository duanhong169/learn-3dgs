import { useMemo } from 'react';
import { Line } from '@react-three/drei';

import { GaussianSplat2D } from '@/components/canvas/shared/GaussianSplat2D';
import { PixelProbe } from '@/components/canvas/shared/PixelProbe';
import { useAlphaBlendingStore } from '@/store/useAlphaBlendingStore';

/**
 * Chapter 3: Alpha Blending & Rendering — Visualize front-to-back compositing.
 */
export function AlphaBlendingScene() {
  const splats = useAlphaBlendingStore((s) => s.splats);
  const probeX = useAlphaBlendingStore((s) => s.probeX);
  const stepThroughMode = useAlphaBlendingStore((s) => s.stepThroughMode);
  const currentStepIndex = useAlphaBlendingStore((s) => s.currentStepIndex);

  // Sort splats by depth (front-to-back)
  const sortedSplats = useMemo(
    () => [...splats].sort((a, b) => a.depth - b.depth),
    [splats],
  );

  return (
    <group>
      {/* Splats in 3D space — positioned along Z axis by depth */}
      {sortedSplats.map((splat, index) => {
        const isVisible = !stepThroughMode || index <= currentStepIndex;
        return (
          <GaussianSplat2D
            key={splat.id}
            position={[splat.positionX, 0, splat.depth]}
            color={splat.color}
            opacity={splat.opacity}
            scale={splat.scale}
            visible={isVisible}
          />
        );
      })}

      {/* Depth axis line */}
      <Line
        points={[[0, -0.5, 0], [0, -0.5, 6]]}
        color="#656d76"
        lineWidth={1}
        transparent
        opacity={0.3}
      />

      {/* Depth labels */}
      {sortedSplats.map((splat) => (
        <mesh key={`label-${splat.id}`} position={[splat.positionX, -1.5, splat.depth]}>
          <sphereGeometry args={[0.05, 6, 6]} />
          <meshBasicMaterial color={splat.color} />
        </mesh>
      ))}

      {/* Pixel probe */}
      <PixelProbe x={probeX} height={4} zRange={[0, 6]} />
    </group>
  );
}
