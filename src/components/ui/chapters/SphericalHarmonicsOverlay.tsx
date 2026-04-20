import { useCallback } from 'react';

import { useChapterStore } from '@/store/useChapterStore';
import { useSHStore } from '@/store/useSHStore';
import { InstructionPanel } from '@/components/ui/shared/InstructionPanel';
import { ParameterPanel } from '@/components/ui/shared/ParameterPanel';
import { ParamSlider } from '@/components/ui/shared/ParamSlider';
import { ParamToggle } from '@/components/ui/shared/ParamToggle';
import { SH_MATERIALS } from '@/utils/sh-scene';
import { cn } from '@/lib/utils';

import type { SHViewMode } from '@/store/useSHStore';
import type { SHMaterialId } from '@/utils/sh-scene';

const INSTRUCTION_STEPS = [
  '为什么 splat 需要「视角依赖」颜色？在叠加模式下，实心粒子云是 SH 重建，外层线框球是真实材质的 GT——SH 能随视角变化呈现高光，而第 5 章那种固定 RGB 永远扁平。',
  '这 9 个彩色球是 L=0..2 的球谐基函数 Y_i(d)——它们是「方向→标量」的正交基底。点击系数索引高亮某一个，观察它的正负分布。',
  '给定一组 RGB 系数 c_i，splat 在某视角 d 下的颜色就是 Σ c_i · Y_i(d)。换句话说：把「方向函数」投影到 9 维空间存起来，用的时候再按方向重建。',
  '不同材质决定了 SH 系数的分布：漫反射几乎只用 L=0,1（和视角无关），而光泽/金属材质的 L=2 非零项强烈——这就是反射能随视角迁移的原因。用下方筛选器单独观察。',
  '如何得到 SH 系数？给定多视角下的 BRDF 渲染图（训练图像），对每个 splat 做最小二乘拟合 (Monte-Carlo 投影)：c_i ≈ (4π/N) Σ f(ω_j)·Y_i(ω_j)。点击「开始烘焙」观看系数逐步收敛。',
  '完整渲染路径：3D 视图用 GPU shader 每帧重算 SH→颜色，CPU 渲染视图（右下）展示虚拟相机看到的效果。拖动相机滑块，注意金属球高光的位置会随视角移动。',
];

const VIEW_MODE_OPTIONS: { mode: SHViewMode; label: string }[] = [
  { mode: 'sh', label: 'SH 云' },
  { mode: 'groundTruth', label: '真值' },
  { mode: 'overlay', label: '叠加' },
  { mode: 'cameraRender', label: '渲染' },
];

const MATERIAL_OPTIONS: { id: SHMaterialId | 'all'; label: string }[] = [
  { id: 'all', label: '全部' },
  { id: 'diffuse', label: SH_MATERIALS.diffuse.label },
  { id: 'glossy', label: SH_MATERIALS.glossy.label },
  { id: 'metallic', label: SH_MATERIALS.metallic.label },
];

const BASIS_GRID: Array<{ i: number; label: string }> = [
  { i: 0, label: 'Y₀₀' },
  { i: 1, label: 'Y₁₋₁' },
  { i: 2, label: 'Y₁₀' },
  { i: 3, label: 'Y₁₁' },
  { i: 4, label: 'Y₂₋₂' },
  { i: 5, label: 'Y₂₋₁' },
  { i: 6, label: 'Y₂₀' },
  { i: 7, label: 'Y₂₁' },
  { i: 8, label: 'Y₂₂' },
];

export function SphericalHarmonicsOverlay() {
  const step = useChapterStore((s) => s.instructionStep);

  const splatDensity = useSHStore((s) => s.splatDensity);
  const viewMode = useSHStore((s) => s.viewMode);
  const highlight = useSHStore((s) => s.highlightBasisIndex);
  const selectedMaterial = useSHStore((s) => s.selectedMaterial);
  const baking = useSHStore((s) => s.baking);

  const cameraAzimuth = useSHStore((s) => s.cameraAzimuth);
  const cameraElevation = useSHStore((s) => s.cameraElevation);
  const cameraDistance = useSHStore((s) => s.cameraDistance);
  const cameraFocalLength = useSHStore((s) => s.cameraFocalLength);
  const useCameraPixelEvaluation = useSHStore((s) => s.useCameraPixelEvaluation);

  const setSplatDensity = useSHStore((s) => s.setSplatDensity);
  const setViewMode = useSHStore((s) => s.setViewMode);
  const setHighlightBasisIndex = useSHStore((s) => s.setHighlightBasisIndex);
  const setSelectedMaterial = useSHStore((s) => s.setSelectedMaterial);
  const startBaking = useSHStore((s) => s.startBaking);
  const stopBaking = useSHStore((s) => s.stopBaking);
  const resetBaking = useSHStore((s) => s.resetBaking);

  const setCameraAzimuth = useSHStore((s) => s.setCameraAzimuth);
  const setCameraElevation = useSHStore((s) => s.setCameraElevation);
  const setCameraDistance = useSHStore((s) => s.setCameraDistance);
  const setCameraFocalLength = useSHStore((s) => s.setCameraFocalLength);
  const toggleCameraPixelEvaluation = useSHStore((s) => s.toggleCameraPixelEvaluation);
  const reset = useSHStore((s) => s.reset);

  const toggleHighlight = useCallback(
    (i: number) => {
      setHighlightBasisIndex(highlight === i ? null : i);
    },
    [highlight, setHighlightBasisIndex],
  );

  const isCameraRenderStep = step === 5 || viewMode === 'cameraRender';

  return (
    <>
      <div className="pointer-events-auto absolute right-4 top-4 flex max-h-[calc(100vh-12rem)] w-64 flex-col gap-3 overflow-y-auto">
        <ParameterPanel title="视图模式">
          <div className="grid grid-cols-4 gap-1">
            {VIEW_MODE_OPTIONS.map((opt) => (
              <button
                key={opt.mode}
                onClick={() => setViewMode(opt.mode)}
                className={cn(
                  'rounded-md px-1.5 py-1.5 text-xs font-medium transition-colors duration-75 whitespace-nowrap',
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

        {/* Material filter */}
        <ParameterPanel title="材质">
          <div className="grid grid-cols-4 gap-1">
            {MATERIAL_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                onClick={() => setSelectedMaterial(opt.id)}
                className={cn(
                  'rounded-md px-1.5 py-1.5 text-xs font-medium transition-colors duration-75 whitespace-nowrap',
                  selectedMaterial === opt.id
                    ? 'bg-primary text-white'
                    : 'border border-border text-text hover:bg-bg',
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </ParameterPanel>

        <ParameterPanel title="密度">
          <ParamSlider
            label="每球 splat 数"
            value={splatDensity}
            min={50}
            max={800}
            step={10}
            onChange={setSplatDensity}
          />
        </ParameterPanel>

        {/* Basis-isolator — only useful in step 1 / 2 */}
        {(step === 1 || step === 2) && (
          <ParameterPanel title="SH 基函数">
            <div className="grid grid-cols-3 gap-1">
              {BASIS_GRID.map((b) => (
                <button
                  key={b.i}
                  onClick={() => toggleHighlight(b.i)}
                  className={cn(
                    'rounded-md px-1.5 py-1.5 font-mono text-[11px] transition-colors duration-75',
                    highlight === b.i
                      ? 'bg-primary text-white'
                      : 'border border-border text-text hover:bg-bg',
                  )}
                >
                  {b.label}
                </button>
              ))}
            </div>
            {highlight !== null && (
              <button
                onClick={() => setHighlightBasisIndex(null)}
                className="mt-1 rounded-md border border-border px-2 py-1 text-xs text-text-muted hover:bg-bg hover:text-text"
              >
                显示全部
              </button>
            )}
          </ParameterPanel>
        )}

        {/* Baking controls — step 4 */}
        {step === 4 && (
          <ParameterPanel title="烘焙">
            {!baking.running ? (
              <button
                onClick={() => startBaking(40)}
                className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary/90"
              >
                {baking.iter > 0 ? '重新烘焙' : '开始烘焙'}
              </button>
            ) : (
              <button
                onClick={stopBaking}
                className="rounded-md bg-danger px-3 py-1.5 text-xs font-medium text-white hover:bg-danger/90"
              >
                暂停
              </button>
            )}
            <div className="flex justify-between text-xs text-text-muted">
              <span>迭代</span>
              <span className="font-mono text-text">{baking.iter}/{baking.totalIters}</span>
            </div>
            <div className="flex justify-between text-xs text-text-muted">
              <span>残差 (RMSE)</span>
              <span className="font-mono text-text">{baking.residual.toFixed(4)}</span>
            </div>
            <button
              onClick={resetBaking}
              className="rounded-md border border-border px-2 py-1 text-xs text-text-muted hover:bg-bg hover:text-text"
            >
              重置
            </button>
          </ParameterPanel>
        )}

        {/* Camera controls — step 5 / cameraRender mode */}
        {isCameraRenderStep && (
          <ParameterPanel title="相机控制">
            <ParamSlider
              label="方位角"
              value={cameraAzimuth}
              min={0}
              max={360}
              step={1}
              onChange={setCameraAzimuth}
            />
            <ParamSlider
              label="仰角"
              value={cameraElevation}
              min={-90}
              max={90}
              step={1}
              onChange={setCameraElevation}
            />
            <ParamSlider
              label="距离"
              value={cameraDistance}
              min={1}
              max={15}
              step={0.1}
              onChange={setCameraDistance}
            />
            <ParamSlider
              label="焦距"
              value={cameraFocalLength}
              min={50}
              max={600}
              step={10}
              onChange={setCameraFocalLength}
            />
            <ParamToggle
              label="像素精评"
              value={useCameraPixelEvaluation}
              onChange={toggleCameraPixelEvaluation}
            />
          </ParameterPanel>
        )}

        <button
          onClick={reset}
          className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-text-muted transition-colors duration-75 hover:bg-bg hover:text-text"
        >
          重置
        </button>
      </div>

      <InstructionPanel steps={INSTRUCTION_STEPS} />
    </>
  );
}
