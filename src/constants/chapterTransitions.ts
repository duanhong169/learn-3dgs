import type { ChapterId } from '@/types/chapters';

/** 承上启下 copy shown in the `TransitionPanel` on the last step of each chapter. */
export interface ChapterTransition {
  /** One-sentence recap of what was learned. */
  summary: string;
  /** Teaser for the next chapter. */
  nextHint: string;
}

/**
 * Per-chapter transition copy. Keyed by the chapter that just ended.
 * The next chapter is derived from the `CHAPTERS` array order, not from this map.
 */
export const CHAPTER_TRANSITIONS: Record<ChapterId, ChapterTransition> = {
  'intro': {
    summary: '你已经理解了 3DGS 相对于 NeRF 的核心优势：显式原语带来极低的每像素成本。',
    nextHint: '下一章：我们拆解一个 3D 高斯的位置、形状、颜色与不透明度。',
  },
  'gaussian-basics': {
    summary: '你已经掌握了 3D 高斯的构成：位置 μ、协方差 Σ（缩放 + 旋转）、颜色与不透明度 α。',
    nextHint: '下一章：如何把一个 3D 高斯投影到 2D 图像平面——Splatting。',
  },
  'splatting': {
    summary: '你已经看到 3D 协方差通过 Jacobian 变换为 2D 协方差：Σ\' = J·W·Σ·Wᵀ·Jᵀ。',
    nextHint: '下一章：多个投影后的 splat 如何混合成最终像素——Alpha 合成。',
  },
  'alpha-blending': {
    summary: '你已经理解前到后的 α 合成公式：C = Σ cᵢ·αᵢ·Π(1-αⱼ)。',
    nextHint: '下一章：当场景有百万级 splat 时，如何做到实时——Tile 光栅化。',
  },
  'tile-rasterization': {
    summary: '你已经看到 tile 切分 + per-tile 排序 + 像素级 α 合成 + 早期终止让 3DGS 实时可行。',
    nextHint: '下一章：这些 splat 的参数是怎么训练出来的——优化与密度控制。',
  },
  'optimization': {
    summary: '你已经理解 L1 + D-SSIM 损失、梯度下降与自适应密度控制（分裂/克隆/修剪/重置）。',
    nextHint: '下一章：把这些学到的东西串起来——看一个完整的重建场景。',
  },
  'reconstruction': {
    summary: '你已经看到上千个高斯如何逼近一个 3D 场景，并理解了视角依赖的重建质量差异。',
    nextHint: '最后一章：每个 splat 如何通过球谐函数编码视角相关的颜色。',
  },
  'spherical-harmonics': {
    summary: '你已经走完了 3DGS 的完整知识路径：从原语定义到视角相关颜色的 SH 编码。',
    nextHint: '课程结束。可以回到任一章节继续玩耍，或进入下一阶段：真实数据的 3DGS 训练。',
  },
};
