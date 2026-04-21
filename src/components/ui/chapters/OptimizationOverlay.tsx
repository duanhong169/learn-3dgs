import optimizationStoreSrc from '@/store/useOptimizationStore.ts?raw';

import { useOptimizationStore } from '@/store/useOptimizationStore';
import { InstructionPanel } from '@/components/ui/shared/InstructionPanel';
import { ParameterPanel } from '@/components/ui/shared/ParameterPanel';
import { ParamSlider } from '@/components/ui/shared/ParamSlider';
import { ParamToggle } from '@/components/ui/shared/ParamToggle';
import { LossChart } from '@/components/ui/shared/LossChart';
import { CodePeek } from '@/components/ui/shared/CodePeek';
import { useChapterStore } from '@/store/useChapterStore';
import { cn } from '@/lib/utils';

const INSTRUCTION_STEPS = [
  '训练从一组随机的高斯体开始（来自 SfM 点云）。它们还完全不匹配场景。',
  '每一步优化会将「渲染图像」与「真实图像」对比，并为每个高斯的参数计算梯度。',
  '点击「Step」按钮，观察高斯体如何向更好的位置和形状移动。黄色箭头显示梯度方向。',
  '但仅靠梯度下降还不够。「自适应密度控制」处理欠重建/过重建问题：',
  '「分裂 (Split)」: 一个大高斯体梯度大 → 覆盖太多区域 → 分裂为 2 个更小的。',
  '「克隆 (Clone)」: 一个小高斯体梯度大 → 覆盖不够 → 在附近复制一个。',
  '「修剪 (Prune)」: 不透明度接近 0 的高斯体没有用 → 移除以节省内存。',
  '训练损失不是单一的像素差。论文用 (1−λ)·L1 + λ·D-SSIM，默认 λ=0.2。拖动「λ」滑块：λ=1 时只看结构相似度；λ=0 时只看逐像素差。',
  '不透明度重置——每 3000 iter（演示里调成 300）把所有 α 置为 0.01。为什么？有些 splat 陷入"我透明但我还活着"的局部最优；重置后下一轮密度控制就会把它们 prune 掉。点击「手动重置」按钮观察 loss 跳变。',
  '观察高斯体数量的变化。真实 3DGS 每 100 次迭代执行一次密度控制，每 3000 次迭代执行一次不透明度重置。下一章：把这些串起来看完整的重建场景。',
];

export function OptimizationOverlay() {
  const gaussians = useOptimizationStore((s) => s.gaussians);
  const step = useOptimizationStore((s) => s.step);
  const loss = useOptimizationStore((s) => s.loss);
  const l1Loss = useOptimizationStore((s) => s.l1Loss);
  const dssimLoss = useOptimizationStore((s) => s.dssimLoss);
  const lambdaDssim = useOptimizationStore((s) => s.lambdaDssim);
  const resetInterval = useOptimizationStore((s) => s.resetInterval);
  const opacityResetCountdown = useOptimizationStore((s) => s.opacityResetCountdown);
  const opacityResetsTriggered = useOptimizationStore((s) => s.opacityResetsTriggered);
  const isAutoRunning = useOptimizationStore((s) => s.isAutoRunning);
  const autoRunSpeed = useOptimizationStore((s) => s.autoRunSpeed);
  const showGradients = useOptimizationStore((s) => s.showGradients);
  const pruneThreshold = useOptimizationStore((s) => s.pruneThreshold);
  const autoDensify = useOptimizationStore((s) => s.autoDensify);

  const runStep = useOptimizationStore((s) => s.runStep);
  const toggleAutoRun = useOptimizationStore((s) => s.toggleAutoRun);
  const setAutoRunSpeed = useOptimizationStore((s) => s.setAutoRunSpeed);
  const triggerSplit = useOptimizationStore((s) => s.triggerSplit);
  const triggerClone = useOptimizationStore((s) => s.triggerClone);
  const triggerPrune = useOptimizationStore((s) => s.triggerPrune);
  const triggerOpacityReset = useOptimizationStore((s) => s.triggerOpacityReset);
  const toggleGradients = useOptimizationStore((s) => s.toggleGradients);
  const toggleAutoDensify = useOptimizationStore((s) => s.toggleAutoDensify);
  const setPruneThreshold = useOptimizationStore((s) => s.setPruneThreshold);
  const setLambdaDssim = useOptimizationStore((s) => s.setLambdaDssim);
  const setResetInterval = useOptimizationStore((s) => s.setResetInterval);
  const reset = useOptimizationStore((s) => s.reset);

  const instructionStep = useChapterStore((s) => s.instructionStep);

  return (
    <>
      {/* Parameter panel — top right */}
      <div className="pointer-events-auto absolute right-4 top-4 flex max-h-[calc(100vh-12rem)] w-72 flex-col gap-3 overflow-y-auto">
        {/* Stats */}
        <ParameterPanel title="训练状态">
          <div className="flex justify-between text-xs">
            <span className="text-text-muted">迭代步</span>
            <span className="font-mono text-text">{step}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-text-muted">高斯数量</span>
            <span className="font-mono text-text">{gaussians.length}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-text-muted">当前 Loss</span>
            <span className="font-mono text-text">{(loss[loss.length - 1] ?? 0).toFixed(4)}</span>
          </div>
        </ParameterPanel>

        {/* Controls */}
        <ParameterPanel title="优化控制">
          <div className="flex gap-2">
            <button
              onClick={runStep}
              disabled={isAutoRunning}
              className={cn(
                'flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors duration-75',
                isAutoRunning
                  ? 'cursor-not-allowed bg-border text-text-muted'
                  : 'bg-primary text-white hover:bg-primary/90',
              )}
            >
              Step
            </button>
            <button
              onClick={toggleAutoRun}
              className={cn(
                'flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors duration-75',
                isAutoRunning
                  ? 'bg-danger text-white hover:bg-danger/90'
                  : 'border border-border text-text hover:bg-bg',
              )}
            >
              {isAutoRunning ? 'Stop' : 'Auto'}
            </button>
          </div>
          <ParamSlider label="速度" value={autoRunSpeed} min={0.5} max={5} step={0.5} onChange={setAutoRunSpeed} />
        </ParameterPanel>

        {/* Loss decomposition (NEW) */}
        <ParameterPanel
          title="损失函数"
          tooltip="L = (1−λ)·L1 + λ·D-SSIM。论文默认 λ=0.2：L1 给像素级精度，D-SSIM 保留局部结构。"
        >
          <ParamSlider
            label="λ (D-SSIM 权重)"
            value={lambdaDssim}
            min={0}
            max={1}
            step={0.05}
            onChange={setLambdaDssim}
          />
          <div className="flex flex-col gap-1.5 pt-1">
            <MiniChart label="L1" data={l1Loss} color="#58a6ff" />
            <MiniChart label="D-SSIM" data={dssimLoss} color="#f78166" />
            <MiniChart label="Total" data={loss} color="#3fb950" />
          </div>
        </ParameterPanel>

        {/* Opacity reset (NEW) */}
        <ParameterPanel
          title="不透明度重置"
          tooltip="论文中每 3000 iter 把所有 α 重置到 0.01，避免 splat 陷入「透明但未 prune」的局部最优。这里默认 300 以便演示。"
        >
          <ParamSlider
            label="重置间隔"
            value={resetInterval}
            min={50}
            max={3000}
            step={50}
            onChange={setResetInterval}
          />
          <div className="flex justify-between text-xs">
            <span className="text-text-muted">下次重置倒计时</span>
            <span className="font-mono text-text">{opacityResetCountdown}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-text-muted">已触发次数</span>
            <span className="font-mono text-primary">{opacityResetsTriggered}</span>
          </div>
          <button
            onClick={triggerOpacityReset}
            className="rounded-md border border-warning/40 bg-warning/5 px-3 py-1.5 text-xs font-medium text-warning transition-colors duration-75 hover:bg-warning/15"
          >
            手动触发重置
          </button>
        </ParameterPanel>

        {/* Adaptive density control */}
        <ParameterPanel title="自适应密度控制">
          <div className="flex gap-2">
            <button
              onClick={triggerSplit}
              className="flex-1 rounded-md border border-danger/30 px-2 py-1.5 text-xs font-medium text-danger transition-colors duration-75 hover:bg-danger/10"
            >
              Split
            </button>
            <button
              onClick={triggerClone}
              className="flex-1 rounded-md border border-primary/30 px-2 py-1.5 text-xs font-medium text-primary transition-colors duration-75 hover:bg-primary/10"
            >
              Clone
            </button>
            <button
              onClick={triggerPrune}
              className="flex-1 rounded-md border border-warning/30 px-2 py-1.5 text-xs font-medium text-warning transition-colors duration-75 hover:bg-warning/10"
            >
              Prune
            </button>
          </div>
          <ParamSlider label="修剪阈值" value={pruneThreshold} min={0} max={0.5} step={0.01} onChange={setPruneThreshold} />
        </ParameterPanel>

        {/* Display options */}
        <ParameterPanel title="显示选项">
          <ParamToggle label="显示梯度箭头" value={showGradients} onChange={toggleGradients} />
          <ParamToggle label="自动密度控制" value={autoDensify} onChange={toggleAutoDensify} />
        </ParameterPanel>

        {/* CodePeek: show when reaching loss-decomposition step */}
        {instructionStep >= 7 && (
          <CodePeek
            source={optimizationStoreSrc}
            functionName="runStep"
            label="store/useOptimizationStore.ts"
            caption="Loss 合成发生在 runStep 内：newTotal = (1-λ)·newL1 + λ·newDssim。"
          />
        )}
        {instructionStep >= 8 && (
          <CodePeek
            source={optimizationStoreSrc}
            functionName="triggerOpacityReset"
            label="store/useOptimizationStore.ts"
            caption="重置就是一行代码：所有 gaussian.opacity = 0.01。简洁但关键。"
          />
        )}

        <button
          onClick={reset}
          className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-text-muted transition-colors duration-75 hover:bg-bg hover:text-text"
        >
          重新初始化
        </button>
      </div>

      {/* Instruction panel — bottom right */}
      <InstructionPanel steps={INSTRUCTION_STEPS} />
    </>
  );
}

/** Small inline loss chart — labeled + colored. Reuses LossChart. */
function MiniChart({
  label,
  data,
  color,
}: {
  label: string;
  data: number[];
  color: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span
        className="w-14 font-mono text-[10px] font-medium"
        style={{ color }}
      >
        {label}
      </span>
      <div className="flex-1">
        <LossChart data={data} width={180} height={40} color={color} showTitle={false} />
      </div>
    </div>
  );
}
