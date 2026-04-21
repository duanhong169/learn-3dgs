import projectionSrc from '@/utils/projection.ts?raw';

import { useIntroStore } from '@/store/useIntroStore';
import { InstructionPanel } from '@/components/ui/shared/InstructionPanel';
import { ParameterPanel } from '@/components/ui/shared/ParameterPanel';
import { ParamSlider } from '@/components/ui/shared/ParamSlider';
import { ParamToggle } from '@/components/ui/shared/ParamToggle';
import { CodePeek } from '@/components/ui/shared/CodePeek';
import { countCoveringSplats } from '@/components/canvas/shared/introShared';
import { useChapterStore } from '@/store/useChapterStore';
import { cn } from '@/lib/utils';

import type { RenderMethod } from '@/store/useIntroStore';

const INSTRUCTION_STEPS = [
  '欢迎来到 3DGS 之旅。本章先回答一个核心问题——"为什么需要 3D 高斯溅射？"',
  '左侧是 NeRF 的世界：每个像素都要发射一条光线，沿线采样几十到上百个点，并用神经网络（MLP）推断颜色与密度。',
  '调整「每像素采样数」滑块。注意右上角的「成本计数」：NeRF 的代价随采样数线性增长。',
  '右侧是 3DGS 的世界：场景被表示为一堆显式的 3D 高斯椭球。渲染时直接把它们投影到屏幕上（Splatting），再按深度混合。',
  '点击左右两侧相同坐标的像素。左侧：一条昂贵的光线。右侧：只有覆盖该像素的少数几个高斯参与计算。',
  '切换「方法对比」开关，同时展示两种方法。同样一帧：NeRF ≈ 数百万次 MLP 运算；3DGS ≈ 数千次投影 + 混合。',
  '这就是 3DGS 能做到实时的原因：用显式原语替代隐式场，把每像素的成本从 O(采样) 降到 O(重叠 splat)。下一章：3D 高斯究竟长什么样？',
];

const METHOD_OPTIONS: { id: RenderMethod; label: string }[] = [
  { id: 'nerf', label: 'NeRF' },
  { id: 'splat', label: '3DGS' },
  { id: 'both', label: '并列' },
];

/** Virtual MLP cost per sample for the NeRF total-cost estimate. */
const MLP_OPS_PER_SAMPLE = 1536;
/** Assumed total pixels for the scene (use a typical 1080p frame). */
const FRAME_PIXELS = 1920 * 1080;

export function IntroOverlay() {
  const method = useIntroStore((s) => s.method);
  const samplesPerRay = useIntroStore((s) => s.samplesPerRay);
  const selectedPixel = useIntroStore((s) => s.selectedPixel);
  const showCostCounter = useIntroStore((s) => s.showCostCounter);

  const setMethod = useIntroStore((s) => s.setMethod);
  const setSamplesPerRay = useIntroStore((s) => s.setSamplesPerRay);
  const toggleCostCounter = useIntroStore((s) => s.toggleCostCounter);
  const reset = useIntroStore((s) => s.reset);

  const instructionStep = useChapterStore((s) => s.instructionStep);

  const covering = countCoveringSplats(selectedPixel);
  // Rough cost estimates for the big scene.
  const nerfCost = FRAME_PIXELS * samplesPerRay * MLP_OPS_PER_SAMPLE;
  const splatCost = FRAME_PIXELS * covering * 6; // ~6 FLOPs per composited splat

  return (
    <>
      {/* Parameter panel — top right */}
      <div className="pointer-events-auto absolute right-4 top-4 flex max-h-[calc(100vh-12rem)] w-72 flex-col gap-3 overflow-y-auto">
        <ParameterPanel title="方法对比">
          <div className="grid grid-cols-3 gap-1">
            {METHOD_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                onClick={() => setMethod(opt.id)}
                className={cn(
                  'rounded-md px-2 py-1.5 text-xs font-medium transition-colors duration-75',
                  method === opt.id
                    ? 'bg-primary text-white'
                    : 'border border-border text-text hover:bg-bg',
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </ParameterPanel>

        <ParameterPanel title="NeRF 采样参数">
          <ParamSlider
            label="每像素采样数"
            value={samplesPerRay}
            min={8}
            max={128}
            step={4}
            onChange={setSamplesPerRay}
          />
          <p className="text-xs text-text-muted">
            每条光线沿 +Z 步进的采样点数量。论文中常用 64 或 128。
          </p>
        </ParameterPanel>

        <ParameterPanel title="像素选择">
          <div className="flex justify-between text-xs">
            <span className="text-text-muted">当前像素</span>
            <span className="font-mono text-text">
              ({selectedPixel[0]}, {selectedPixel[1]})
            </span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-text-muted">覆盖该像素的 splat</span>
            <span className="font-mono text-primary">{covering}</span>
          </div>
          <p className="text-xs text-text-muted">
            点击画面上的小球选择像素，观察左右两种方法的"每像素成本"差异。
          </p>
        </ParameterPanel>

        {showCostCounter && (
          <ParameterPanel title="成本估算（1080p / 帧）">
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-text-muted">NeRF MLP 运算</span>
                <span className="font-mono text-danger">
                  {formatOps(nerfCost)}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-text-muted">3DGS 投影+混合</span>
                <span className="font-mono text-primary">
                  {formatOps(splatCost)}
                </span>
              </div>
              <div className="mt-1 rounded-md bg-primary/10 px-2 py-1.5 text-xs leading-relaxed text-primary">
                比率：NeRF 代价约为 3DGS 的{' '}
                <strong>
                  {splatCost > 0 ? Math.round(nerfCost / splatCost) : '∞'}×
                </strong>
              </div>
            </div>
          </ParameterPanel>
        )}

        <ParameterPanel title="显示选项">
          <ParamToggle
            label="显示成本计数"
            value={showCostCounter}
            onChange={toggleCostCounter}
          />
        </ParameterPanel>

        {/* CodePeek — Step 4+ */}
        {instructionStep >= 3 && (
          <CodePeek
            source={projectionSrc}
            functionName="projectCovariance3Dto2D"
            label="utils/projection.ts"
            caption="3DGS 的核心投影公式：Σ' = J · Σ · Jᵀ。每个 splat 做一次这种 O(1) 的投影。"
          />
        )}

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

/** Format large operation counts: 1234567 → "1.2M". */
function formatOps(n: number): string {
  if (n < 1e3) return `${n}`;
  if (n < 1e6) return `${(n / 1e3).toFixed(1)}K`;
  if (n < 1e9) return `${(n / 1e6).toFixed(1)}M`;
  return `${(n / 1e9).toFixed(2)}G`;
}
