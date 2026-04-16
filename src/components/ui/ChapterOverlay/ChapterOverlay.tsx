import { useChapterStore } from '@/store/useChapterStore';
import { GaussianBasicsOverlay } from '@/components/ui/chapters/GaussianBasicsOverlay';
import { SplattingOverlay } from '@/components/ui/chapters/SplattingOverlay';
import { AlphaBlendingOverlay } from '@/components/ui/chapters/AlphaBlendingOverlay';
import { OptimizationOverlay } from '@/components/ui/chapters/OptimizationOverlay';
import { ReconstructionOverlay } from '@/components/ui/chapters/ReconstructionOverlay';

export function ChapterOverlay() {
  const activeChapter = useChapterStore((s) => s.activeChapter);

  switch (activeChapter) {
    case 'gaussian-basics':
      return <GaussianBasicsOverlay />;
    case 'splatting':
      return <SplattingOverlay />;
    case 'alpha-blending':
      return <AlphaBlendingOverlay />;
    case 'optimization':
      return <OptimizationOverlay />;
    case 'reconstruction':
      return <ReconstructionOverlay />;
    default:
      return null;
  }
}
