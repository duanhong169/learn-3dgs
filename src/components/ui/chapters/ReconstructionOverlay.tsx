import { useMemo } from 'react';

import { useReconstructionStore } from '@/store/useReconstructionStore';
import { InstructionPanel } from '@/components/ui/shared/InstructionPanel';
import { ParameterPanel } from '@/components/ui/shared/ParameterPanel';
import { ParamSlider } from '@/components/ui/shared/ParamSlider';
import { ParamToggle } from '@/components/ui/shared/ParamToggle';
import { generateSceneGaussians } from '@/utils/reconstruction';
import { cn } from '@/lib/utils';

import type { ViewMode } from '@/store/useReconstructionStore';

const INSTRUCTION_STEPS = [
  '这是最终的重建效果！3DGS 用上千个高斯体逼近一个简单的 3D 场景——包含球体、立方体和圆柱体。',
  '切换到「Ground Truth」查看原始场景几何体，再切回「Gaussian」对比重建质量。试试「叠加」模式！',
  '拖动「密度等级」滑块，观察高斯体数量如何影响重建质量。少量高斯 → 粗糙，大量 → 精细。',
  '点击「播放重建」观看高斯体从随机初始化逐步收敛到目标位置的动画过程。',
  '自由漫游场景！从不同角度观察重建效果。注意某些角度的质量差异——这正是 3DGS 视角依赖性的体现。',
];

const VIEW_MODE_OPTIONS: { mode: ViewMode; label: string }[] = [
  { mode: 'gaussian', label: 'Gaussian' },
  { mode: 'groundTruth', label: 'Ground Truth' },
  { mode: 'overlay', label: '叠加' },
];

export function ReconstructionOverlay() {
  const viewMode = useReconstructionStore((s) => s.viewMode);
  const densityLevel = useReconstructionStore((s) => s.densityLevel);
  const isAnimating = useReconstructionStore((s) => s.isAnimating);
  const animationProgress = useReconstructionStore((s) => s.animationProgress);
  const showWireframe = useReconstructionStore((s) => s.showWireframe);
  const showGaussianCenters = useReconstructionStore((s) => s.showGaussianCenters);

  const setViewMode = useReconstructionStore((s) => s.setViewMode);
  const setDensityLevel = useReconstructionStore((s) => s.setDensityLevel);
  const toggleAnimation = useReconstructionStore((s) => s.toggleAnimation);
  const setAnimationProgress = useReconstructionStore((s) => s.setAnimationProgress);
  const toggleWireframe = useReconstructionStore((s) => s.toggleWireframe);
  const toggleGaussianCenters = useReconstructionStore((s) => s.toggleGaussianCenters);
  const reset = useReconstructionStore((s) => s.reset);

  // Compute gaussian count (memoized to avoid regenerating full array on every render)
  const gaussianCount = useMemo(
    () => generateSceneGaussians(densityLevel).length,
    [densityLevel],
  );

  return (
    <>
      {/* Parameter panel — top right */}
      <div className="pointer-events-auto absolute right-4 top-4 flex max-h-[calc(100vh-12rem)] w-64 flex-col gap-3 overflow-y-auto">
        {/* View mode toggle */}
        <ParameterPanel title="视图模式">
          <div className="flex gap-1">
            {VIEW_MODE_OPTIONS.map((opt) => (
              <button
                key={opt.mode}
                onClick={() => setViewMode(opt.mode)}
                className={cn(
                  'flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors duration-75',
                  viewMode === opt.mode
                    ? 'bg-primary text-white'
                    : 'border border-border text-text hover:bg-bg',
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </ParameterPanel>

        {/* Density control */}
        <ParameterPanel title="重建质量">
          <ParamSlider
            label="密度等级"
            value={densityLevel}
            min={1}
            max={5}
            step={1}
            onChange={setDensityLevel}
          />
          <div className="flex justify-between text-xs">
            <span className="text-text-muted">高斯体数量</span>
            <span className="font-mono text-text">{gaussianCount}</span>
          </div>
        </ParameterPanel>

        {/* Reconstruction animation */}
        <ParameterPanel title="重建动画">
          <button
            onClick={toggleAnimation}
            className={cn(
              'w-full rounded-md px-3 py-1.5 text-xs font-medium transition-colors duration-75',
              isAnimating
                ? 'bg-danger text-white hover:bg-danger/90'
                : 'bg-primary text-white hover:bg-primary/90',
            )}
          >
            {isAnimating ? '暂停' : animationProgress >= 1 ? '播放重建' : '继续'}
          </button>
          <ParamSlider
            label="进度"
            value={animationProgress}
            min={0}
            max={1}
            step={0.01}
            onChange={setAnimationProgress}
          />
        </ParameterPanel>

        {/* Display options */}
        <ParameterPanel title="显示选项">
          <ParamToggle label="线框模式" value={showWireframe} onChange={toggleWireframe} />
          <ParamToggle label="高斯中心点" value={showGaussianCenters} onChange={toggleGaussianCenters} />
        </ParameterPanel>

        <button
          onClick={reset}
          className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-text-muted transition-colors duration-75 hover:bg-bg hover:text-text"
        >
          重置
        </button>
      </div>

      {/* Instruction panel — bottom right */}
      <InstructionPanel steps={INSTRUCTION_STEPS} />
    </>
  );
}
