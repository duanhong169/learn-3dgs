import { OrbitControls, Environment, Grid } from '@react-three/drei';

import { useChapterStore } from '@/store/useChapterStore';
import { useReconstructionStore } from '@/store/useReconstructionStore';
import { GaussianBasicsScene } from '@/components/canvas/chapters/GaussianBasicsScene';
import { SplattingScene } from '@/components/canvas/chapters/SplattingScene';
import { AlphaBlendingScene } from '@/components/canvas/chapters/AlphaBlendingScene';
import { OptimizationScene } from '@/components/canvas/chapters/OptimizationScene';
import { ReconstructionScene } from '@/components/canvas/chapters/ReconstructionScene';

export function ChapterScene() {
  const activeChapter = useChapterStore((s) => s.activeChapter);
  const reconstructionViewMode = useReconstructionStore((s) => s.viewMode);
  const hideGrid = activeChapter === 'reconstruction' && reconstructionViewMode === 'cameraRender';

  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight position={[8, 10, 5]} intensity={1.2} castShadow />
      <Environment preset="studio" />

      {activeChapter === 'gaussian-basics' && <GaussianBasicsScene />}
      {activeChapter === 'splatting' && <SplattingScene />}
      {activeChapter === 'alpha-blending' && <AlphaBlendingScene />}
      {activeChapter === 'optimization' && <OptimizationScene />}
      {activeChapter === 'reconstruction' && <ReconstructionScene />}

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
    </>
  );
}
