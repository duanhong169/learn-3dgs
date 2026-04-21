import { NerfRayMarchViz } from '@/components/canvas/shared/NerfRayMarchViz';
import { SplatProjectionViz } from '@/components/canvas/shared/SplatProjectionViz';
import { useIntroStore } from '@/store/useIntroStore';

/**
 * Chapter 0 (Intro): side-by-side NeRF ray-marching vs 3DGS splat-projection.
 * Left half = NeRF, right half = 3DGS. Whole scene uses the default perspective
 * camera so users can still orbit with OrbitControls.
 */
export function IntroScene() {
  const method = useIntroStore((s) => s.method);

  const showNerf = method === 'nerf' || method === 'both';
  const showSplat = method === 'splat' || method === 'both';

  return (
    <group>
      {showNerf && <NerfRayMarchViz offsetX={method === 'both' ? -2.2 : 0} />}
      {showSplat && <SplatProjectionViz offsetX={method === 'both' ? 2.2 : 0} />}
    </group>
  );
}
