import { OrbitControls, Environment, Grid } from '@react-three/drei';

import { useChapterStore } from '@/store/useChapterStore';
import { useReconstructionStore } from '@/store/useReconstructionStore';
import { useSHStore } from '@/store/useSHStore';
import { IntroScene } from '@/components/canvas/chapters/IntroScene';
import { GaussianBasicsScene } from '@/components/canvas/chapters/GaussianBasicsScene';
import { SplattingScene } from '@/components/canvas/chapters/SplattingScene';
import { AlphaBlendingScene } from '@/components/canvas/chapters/AlphaBlendingScene';
import { OptimizationScene } from '@/components/canvas/chapters/OptimizationScene';
import { ReconstructionScene } from '@/components/canvas/chapters/ReconstructionScene';
import { SphericalHarmonicsScene } from '@/components/canvas/chapters/SphericalHarmonicsScene';
import { ViewportGizmo } from '@/components/canvas/shared/ViewportGizmo';

export function ChapterScene() {
  const activeChapter = useChapterStore((s) => s.activeChapter);
  const reconstructionViewMode = useReconstructionStore((s) => s.viewMode);
  const shViewMode = useSHStore((s) => s.viewMode);
  // Hide the floor grid whenever a CPU-rendered camera view plane is on screen —
  // the grid would otherwise overlap / occlude the render plane in ch5 & ch6,
  // and on the intro chapter where it's just visual clutter.
  const hideGrid =
    activeChapter === 'intro' ||
    (activeChapter === 'reconstruction' && reconstructionViewMode === 'cameraRender') ||
    (activeChapter === 'spherical-harmonics' && shViewMode === 'cameraRender');

  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight position={[8, 10, 5]} intensity={1.2} castShadow />
      <Environment preset="studio" />

      {activeChapter === 'intro' && <IntroScene />}
      {activeChapter === 'gaussian-basics' && <GaussianBasicsScene />}
      {activeChapter === 'splatting' && <SplattingScene />}
      {activeChapter === 'alpha-blending' && <AlphaBlendingScene />}
      {activeChapter === 'optimization' && <OptimizationScene />}
      {activeChapter === 'reconstruction' && <ReconstructionScene />}
      {activeChapter === 'spherical-harmonics' && <SphericalHarmonicsScene />}

      {!hideGrid && (
        <Grid
          infiniteGrid
          cellSize={0.5}
          cellThickness={0.5}
          sectionSize={2}
          sectionThickness={1}
          fadeDistance={20}
          fadeStrength={1}
        />
      )}
      <OrbitControls makeDefault enableDamping dampingFactor={0.1} />
      <ViewportGizmo />
    </>
  );
}
