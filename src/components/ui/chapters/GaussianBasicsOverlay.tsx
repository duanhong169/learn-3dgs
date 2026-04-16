import { useGaussianBasicsStore } from '@/store/useGaussianBasicsStore';
import { useGaussianMatrix } from '@/hooks/useGaussianMatrix';
import { InstructionPanel } from '@/components/ui/shared/InstructionPanel';
import { ParameterPanel } from '@/components/ui/shared/ParameterPanel';
import { ParamSlider } from '@/components/ui/shared/ParamSlider';
import { ParamToggle } from '@/components/ui/shared/ParamToggle';
import { ParamColorPicker } from '@/components/ui/shared/ParamColorPicker';
import { MatrixDisplay } from '@/components/ui/shared/MatrixDisplay';
import { SCALE_RANGE, ROTATION_RANGE, OPACITY_RANGE } from '@/constants/gaussian';

import type { Tuple3 } from '@/types/common';

const INSTRUCTION_STEPS = [
  '这是一个 3D 高斯体 — 空间中一个柔软的、半透明的椭球。为什么叫"高斯"？因为它的密度从中心到边缘按高斯分布（钟形曲线）衰减：中心最浓密，越远越稀薄透明。这个 exp(-½r²) 的衰减正是高斯函数的 3D 版本。',
  '拖动「缩放」滑块来改变高斯体沿各轴的扩展程度 — σx、σy、σz 控制了椭球的"胖瘦"。',
  '现在旋转它 — 缩放 + 旋转的组合就构成了「协方差矩阵 Σ」，它完整定义了高斯体的 3D 形状。',
  '改变「颜色」和「不透明度」— 在 3DGS 中，每个高斯体的颜色用「球谐函数 (SH)」来表示，而不是一个固定的 RGB 值。',
  '为什么要用球谐函数？现实中很多表面的颜色会随观察角度变化（比如金属光泽、肥皂泡的彩虹）。球谐函数是一组定义在球面上的基函数，就像傅里叶级数能用正弦波组合出任意波形一样，SH 能用几个系数组合出"任意方向→颜色"的映射。',
  '0 阶 SH 只有 1 个系数 = 各方向颜色相同（固定单色）；1 阶增加 3 个系数 = 能表达简单的方向性变化；2 阶再加 5 个 = 更复杂的角度依赖。3DGS 通常用到 3 阶（共 16 个系数/通道），足以捕捉大多数视角相关的外观变化。这里我们简化为单色展示。',
  '一个完整的 3DGS 场景就是由数百万个这样的高斯体组成的！每个都有自己的位置 μ、形状 Σ、球谐颜色系数和不透明度 α。',
];

export function GaussianBasicsOverlay() {
  const scale = useGaussianBasicsStore((s) => s.scale);
  const rotation = useGaussianBasicsStore((s) => s.rotation);
  const color = useGaussianBasicsStore((s) => s.color);
  const opacity = useGaussianBasicsStore((s) => s.opacity);
  const showSamples = useGaussianBasicsStore((s) => s.showSamples);
  const showAxes = useGaussianBasicsStore((s) => s.showAxes);
  const showBoundingBox = useGaussianBasicsStore((s) => s.showBoundingBox);
  const setScale = useGaussianBasicsStore((s) => s.setScale);
  const setRotation = useGaussianBasicsStore((s) => s.setRotation);
  const setColor = useGaussianBasicsStore((s) => s.setColor);
  const setOpacity = useGaussianBasicsStore((s) => s.setOpacity);
  const toggleSamples = useGaussianBasicsStore((s) => s.toggleSamples);
  const toggleAxes = useGaussianBasicsStore((s) => s.toggleAxes);
  const toggleBoundingBox = useGaussianBasicsStore((s) => s.toggleBoundingBox);
  const reset = useGaussianBasicsStore((s) => s.reset);

  const { formatted } = useGaussianMatrix(scale, rotation);

  // Detect uniform scale — rotation won't change Σ in this case
  const isUniformScale = Math.abs(scale[0] - scale[1]) < 0.01 &&
    Math.abs(scale[1] - scale[2]) < 0.01;

  const handleScaleChange = (axis: 0 | 1 | 2, value: number) => {
    const newScale: Tuple3 = [...scale];
    newScale[axis] = value;
    setScale(newScale);
  };

  const handleRotationChange = (axis: 0 | 1 | 2, value: number) => {
    const newRot: Tuple3 = [...rotation];
    newRot[axis] = value;
    setRotation(newRot);
  };

  return (
    <>
      {/* Parameter panel — top right */}
      <div className="pointer-events-auto absolute right-4 top-4 flex w-72 max-h-[calc(100vh-12rem)] flex-col gap-3 overflow-y-auto">
        <ParameterPanel title="缩放 (σ)">
          <ParamSlider label="σx" value={scale[0]} {...SCALE_RANGE} onChange={(v) => handleScaleChange(0, v)} />
          <ParamSlider label="σy" value={scale[1]} {...SCALE_RANGE} onChange={(v) => handleScaleChange(1, v)} />
          <ParamSlider label="σz" value={scale[2]} {...SCALE_RANGE} onChange={(v) => handleScaleChange(2, v)} />
        </ParameterPanel>

        <ParameterPanel title="旋转 (°)">
          <ParamSlider label="Rx" value={rotation[0]} {...ROTATION_RANGE} onChange={(v) => handleRotationChange(0, v)} />
          <ParamSlider label="Ry" value={rotation[1]} {...ROTATION_RANGE} onChange={(v) => handleRotationChange(1, v)} />
          <ParamSlider label="Rz" value={rotation[2]} {...ROTATION_RANGE} onChange={(v) => handleRotationChange(2, v)} />
        </ParameterPanel>

        <ParameterPanel title="外观">
          <ParamColorPicker label="颜色" value={color} onChange={setColor} />
          <ParamSlider label="不透明度 (α)" value={opacity} {...OPACITY_RANGE} onChange={setOpacity} />
        </ParameterPanel>

        <ParameterPanel title="显示选项">
          <ParamToggle
            label="显示坐标轴"
            value={showAxes}
            onChange={toggleAxes}
            tooltip="显示 RGB 三色坐标轴，分别对应协方差矩阵的三个主轴方向（X=红, Y=绿, Z=蓝）。"
          />
          <ParamToggle
            label="显示采样点"
            value={showSamples}
            onChange={toggleSamples}
            tooltip="在高斯分布内随机采样 200 个点。点越密集的区域概率密度越高，直观感受高斯体的密度分布。"
          />
          <ParamToggle
            label="显示 3σ 边界"
            value={showBoundingBox}
            onChange={toggleBoundingBox}
            tooltip="显示 3 倍标准差的边界框。在统计学中，约 99.7% 的概率质量落在 3σ 范围内。"
          />
        </ParameterPanel>

        {/* Covariance matrix display */}
        <ParameterPanel
          title="协方差矩阵 Σ"
          tooltip="协方差矩阵 Σ 完整描述了高斯体的 3D 形状。它由缩放 S（控制各轴长度）和旋转 R（控制朝向）组合而成: Σ = R·S·Sᵀ·Rᵀ。对角元素是各轴方差，非对角元素反映轴间相关性。"
        >
          <MatrixDisplay label="Σ = R · S · Sᵀ · Rᵀ" values={formatted} />
          {isUniformScale && (
            <p className="rounded-md bg-warning/10 px-2 py-1.5 text-xs leading-relaxed text-warning">
              当前三轴缩放相等（球体），旋转不会改变 Σ。
              <br />
              因为 R·I·Rᵀ = I。请先设置不同的 σ 值再旋转！
            </p>
          )}
          <button
            onClick={reset}
            className="mt-1 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-text-muted transition-colors duration-75 hover:bg-bg hover:text-text"
          >
            重置参数
          </button>
        </ParameterPanel>
      </div>

      {/* Instruction panel — bottom right */}
      <InstructionPanel steps={INSTRUCTION_STEPS} />
    </>
  );
}
