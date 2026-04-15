import { useSplattingStore } from '@/store/useSplattingStore';
import { InstructionPanel } from '@/components/ui/shared/InstructionPanel';
import { ParameterPanel } from '@/components/ui/shared/ParameterPanel';
import { ParamSlider } from '@/components/ui/shared/ParamSlider';
import { ParamToggle } from '@/components/ui/shared/ParamToggle';
import { MatrixDisplay } from '@/components/ui/shared/MatrixDisplay';
import { SCALE_RANGE } from '@/constants/gaussian';
import { formatMatrix3 } from '@/utils/gaussian';
import { formatMatrix2 } from '@/utils/projection';

import type { Tuple3 } from '@/types/common';

const INSTRUCTION_STEPS = [
  '在渲染中，我们需要将每个 3D 高斯"拍平"到相机的图像平面上。这个过程叫做 Splatting。',
  '蓝色锥体代表虚拟相机。调节「方位角」和「仰角」旋转相机位置，观察图像平面上的 2D 椭圆如何变化。',
  '3D 协方差矩阵 Σ 通过投影的 Jacobian 矩阵 J 变换为 2D 协方差: Σ\' = J · W · Σ · Wᵀ · Jᵀ。',
  '注意：3D 中的圆从侧面看会变成椭圆 — 投影过程天然保持高斯形状，这正是 3DGS 选择高斯作为基元的优雅之处！',
];

export function SplattingOverlay() {
  const gaussianScale = useSplattingStore((s) => s.gaussianScale);
  const cameraAzimuth = useSplattingStore((s) => s.cameraAzimuth);
  const cameraElevation = useSplattingStore((s) => s.cameraElevation);
  const cameraDistance = useSplattingStore((s) => s.cameraDistance);
  const showProjectionLines = useSplattingStore((s) => s.showProjectionLines);
  const showCovarianceMatrices = useSplattingStore((s) => s.showCovarianceMatrices);
  const covariance3D = useSplattingStore((s) => s.covariance3D);
  const covariance2D = useSplattingStore((s) => s.covariance2D);

  const setGaussianScale = useSplattingStore((s) => s.setGaussianScale);
  const setCameraAzimuth = useSplattingStore((s) => s.setCameraAzimuth);
  const setCameraElevation = useSplattingStore((s) => s.setCameraElevation);
  const setCameraDistance = useSplattingStore((s) => s.setCameraDistance);
  const toggleProjectionLines = useSplattingStore((s) => s.toggleProjectionLines);
  const toggleCovarianceMatrices = useSplattingStore((s) => s.toggleCovarianceMatrices);
  const reset = useSplattingStore((s) => s.reset);

  const handleScaleChange = (axis: 0 | 1 | 2, value: number) => {
    const newScale: Tuple3 = [...gaussianScale];
    newScale[axis] = value;
    setGaussianScale(newScale);
  };

  return (
    <>
      {/* Parameter panel — top right */}
      <div className="pointer-events-auto absolute right-4 top-4 flex w-72 max-h-[calc(100vh-12rem)] flex-col gap-3 overflow-y-auto">
        <ParameterPanel title="虚拟相机">
          <ParamSlider label="方位角" value={cameraAzimuth} min={0} max={360} step={1} unit="°" onChange={setCameraAzimuth} />
          <ParamSlider label="仰角" value={cameraElevation} min={-80} max={80} step={1} unit="°" onChange={setCameraElevation} />
          <ParamSlider label="距离" value={cameraDistance} min={2} max={10} step={0.1} onChange={setCameraDistance} />
        </ParameterPanel>

        <ParameterPanel title="高斯缩放">
          <ParamSlider label="σx" value={gaussianScale[0]} {...SCALE_RANGE} onChange={(v) => handleScaleChange(0, v)} />
          <ParamSlider label="σy" value={gaussianScale[1]} {...SCALE_RANGE} onChange={(v) => handleScaleChange(1, v)} />
          <ParamSlider label="σz" value={gaussianScale[2]} {...SCALE_RANGE} onChange={(v) => handleScaleChange(2, v)} />
        </ParameterPanel>

        <ParameterPanel title="显示选项">
          <ParamToggle label="显示投影线" value={showProjectionLines} onChange={toggleProjectionLines} />
          <ParamToggle label="显示协方差矩阵" value={showCovarianceMatrices} onChange={toggleCovarianceMatrices} />
        </ParameterPanel>

        {showCovarianceMatrices && (
          <ParameterPanel title="协方差矩阵">
            <MatrixDisplay label="3D: Σ (3×3)" values={formatMatrix3(covariance3D)} />
            <MatrixDisplay label="2D: Σ' (2×2)" values={formatMatrix2(covariance2D)} />
          </ParameterPanel>
        )}

        <button
          onClick={reset}
          className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-text-muted transition-colors duration-75 hover:bg-bg hover:text-text"
        >
          重置参数
        </button>
      </div>

      {/* Instruction panel — bottom right */}
      <InstructionPanel steps={INSTRUCTION_STEPS} />
    </>
  );
}
