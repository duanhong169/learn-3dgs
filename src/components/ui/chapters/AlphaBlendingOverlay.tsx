import { useMemo } from 'react';

import { useAlphaBlendingStore } from '@/store/useAlphaBlendingStore';
import { InstructionPanel } from '@/components/ui/shared/InstructionPanel';
import { ParameterPanel } from '@/components/ui/shared/ParameterPanel';
import { ParamSlider } from '@/components/ui/shared/ParamSlider';
import { ParamToggle } from '@/components/ui/shared/ParamToggle';
import { ParamColorPicker } from '@/components/ui/shared/ParamColorPicker';
import { AccumulationBar } from '@/components/ui/shared/AccumulationBar';
import { alphaComposite, hexToRGB } from '@/utils/blending';
import { evaluateGaussian1D } from '@/utils/blending';

const INSTRUCTION_STEPS = [
  '现在我们有多个 splat 在空间中重叠。渲染器如何确定每个像素的最终颜色？',
  '第一步：所有 splat 按照距离相机的深度进行「前到后排序」。',
  '对于每个像素，按排序顺序遍历 splat。每个 splat 贡献颜色: C_i * α_i * T_i，其中 T 是剩余透射率。',
  '拖动黄色「像素探针」在不同位置采样 — 观察不同位置如何产生不同的颜色混合结果。',
  '这就是 Alpha 合成公式: C = Σ cᵢ · αᵢ · Πⱼ₌₁ⁱ⁻¹(1 - αⱼ)。简洁、可微分、且高效！',
];

export function AlphaBlendingOverlay() {
  const splats = useAlphaBlendingStore((s) => s.splats);
  const probeX = useAlphaBlendingStore((s) => s.probeX);
  const stepThroughMode = useAlphaBlendingStore((s) => s.stepThroughMode);
  const currentStepIndex = useAlphaBlendingStore((s) => s.currentStepIndex);
  const setProbeX = useAlphaBlendingStore((s) => s.setProbeX);
  const updateSplat = useAlphaBlendingStore((s) => s.updateSplat);
  const addSplat = useAlphaBlendingStore((s) => s.addSplat);
  const toggleStepThrough = useAlphaBlendingStore((s) => s.toggleStepThrough);
  const nextBlendStep = useAlphaBlendingStore((s) => s.nextBlendStep);
  const prevBlendStep = useAlphaBlendingStore((s) => s.prevBlendStep);
  const reset = useAlphaBlendingStore((s) => s.reset);

  // Sort and compute blending
  const sortedSplats = useMemo(
    () => [...splats].sort((a, b) => a.depth - b.depth),
    [splats],
  );

  const blendResult = useMemo(() => {
    // For each sorted splat, compute effective opacity at probe position
    const colors: Array<[number, number, number]> = [];
    const opacities: number[] = [];

    for (const splat of sortedSplats) {
      const density = evaluateGaussian1D(probeX, splat.positionX, splat.scale * 0.5);
      const effectiveAlpha = splat.opacity * density;
      colors.push(hexToRGB(splat.color));
      opacities.push(effectiveAlpha);
    }

    return alphaComposite(colors, opacities);
  }, [sortedSplats, probeX]);

  return (
    <>
      {/* Parameter panel — top right */}
      <div className="pointer-events-auto absolute right-4 top-4 flex max-h-[calc(100vh-12rem)] w-64 flex-col gap-3 overflow-y-auto">
        <ParameterPanel title="像素探针">
          <ParamSlider
            label="X 位置"
            value={probeX}
            min={-3}
            max={3}
            step={0.05}
            onChange={setProbeX}
          />
        </ParameterPanel>

        <ParameterPanel title="混合模式">
          <ParamToggle label="逐步模式" value={stepThroughMode} onChange={toggleStepThrough} />
          {stepThroughMode && (
            <div className="flex gap-2">
              <button
                onClick={prevBlendStep}
                disabled={currentStepIndex === 0}
                className="flex-1 rounded-md border border-border px-2 py-1 text-xs font-medium text-text-muted transition-colors duration-75 hover:bg-bg disabled:opacity-40"
              >
                &larr; 上一层
              </button>
              <button
                onClick={nextBlendStep}
                disabled={currentStepIndex >= sortedSplats.length - 1}
                className="flex-1 rounded-md border border-border px-2 py-1 text-xs font-medium text-text-muted transition-colors duration-75 hover:bg-bg disabled:opacity-40"
              >
                下一层 &rarr;
              </button>
            </div>
          )}
        </ParameterPanel>

        <ParameterPanel title="Splat 列表">
          {sortedSplats.map((splat, i) => (
            <div key={splat.id} className="flex flex-col gap-1 border-b border-border pb-2 last:border-b-0 last:pb-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-text">#{i + 1}</span>
                <div className="h-3 w-3 rounded-sm" style={{ backgroundColor: splat.color }} />
                <ParamColorPicker label="" value={splat.color} onChange={(c) => updateSplat(splat.id, { color: c })} />
              </div>
              <ParamSlider
                label="不透明度"
                value={splat.opacity}
                min={0}
                max={1}
                step={0.01}
                onChange={(v) => updateSplat(splat.id, { opacity: v })}
              />
            </div>
          ))}
          {splats.length < 7 && (
            <button
              onClick={addSplat}
              className="rounded-md border border-dashed border-border px-2 py-1 text-xs text-text-muted hover:bg-bg"
            >
              + 添加 Splat
            </button>
          )}
        </ParameterPanel>

        <ParameterPanel title="颜色累积">
          <AccumulationBar
            steps={blendResult.steps}
            visibleSteps={stepThroughMode ? currentStepIndex : undefined}
          />
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
