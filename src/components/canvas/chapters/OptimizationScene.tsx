import { useEffect, useRef } from 'react';

import { GaussianEllipsoid } from '@/components/canvas/shared/GaussianEllipsoid';
import { TargetShapes } from '@/components/canvas/shared/TargetShapes';
import { GradientArrow } from '@/components/canvas/shared/GradientArrow';
import { useOptimizationStore } from '@/store/useOptimizationStore';

/**
 * Chapter 4: Optimization & Adaptive Density Control.
 */
export function OptimizationScene() {
  const gaussians = useOptimizationStore((s) => s.gaussians);
  const showGradients = useOptimizationStore((s) => s.showGradients);
  const isAutoRunning = useOptimizationStore((s) => s.isAutoRunning);
  const autoRunSpeed = useOptimizationStore((s) => s.autoRunSpeed);
  const runStep = useOptimizationStore((s) => s.runStep);

  // Auto-run optimization steps
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (isAutoRunning) {
      const intervalMs = Math.max(50, 500 / autoRunSpeed);
      intervalRef.current = setInterval(() => {
        runStep();
      }, intervalMs);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isAutoRunning, autoRunSpeed, runStep]);

  return (
    <group>
      {/* Ground truth target shapes (wireframe) */}
      <TargetShapes />

      {/* Gaussian cloud */}
      {gaussians.map((g) => (
        <group key={g.id}>
          <GaussianEllipsoid
            position={g.position}
            scale={g.scale}
            rotation={g.rotation}
            color={g.color}
            opacity={g.opacity * 0.6}
            segments={12}
          />
          {showGradients && (
            <GradientArrow
              position={g.position}
              direction={g.gradient}
              magnitude={g.gradientMagnitude}
            />
          )}
        </group>
      ))}
    </group>
  );
}
