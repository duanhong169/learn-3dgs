import type { Tuple3 } from '@/types/common';
import type { ChapterId, ChapterMeta } from '@/types/chapters';

/** Ordered list of all chapters. */
export const CHAPTERS: ChapterMeta[] = [
  {
    id: 'gaussian-basics',
    title: '3D 高斯基础',
    subtitle: '位置、形状、颜色与不透明度',
    icon: '🔵',
    totalSteps: 7,
  },
  {
    id: 'splatting',
    title: 'Splatting 投影',
    subtitle: '从 3D 到 2D 的变换',
    icon: '📽️',
    totalSteps: 4,
  },
  {
    id: 'alpha-blending',
    title: 'Alpha 混合',
    subtitle: '深度排序与颜色合成',
    icon: '🎨',
    totalSteps: 5,
  },
  {
    id: 'optimization',
    title: '优化与密度控制',
    subtitle: '分裂、克隆与修剪',
    icon: '⚙️',
    totalSteps: 8,
  },
  {
    id: 'reconstruction',
    title: '3DGS 重建',
    subtitle: '场景重建与自由漫游',
    icon: '🏗️',
    totalSteps: 5,
  },
];

/** Camera preset positions for each chapter. */
export const CHAPTER_CAMERA_POSITIONS: Record<ChapterId, Tuple3> = {
  'gaussian-basics': [4, 3, 4],
  'splatting': [6, 4, 6],
  'alpha-blending': [0, 0, 8],
  'optimization': [8, 6, 8],
  'reconstruction': [6, 4, 6],
};

/** Camera look-at targets for each chapter. */
export const CHAPTER_CAMERA_TARGETS: Record<ChapterId, Tuple3> = {
  'gaussian-basics': [0, 0, 0],
  'splatting': [0, 0, 0],
  'alpha-blending': [0, 0, 0],
  'optimization': [0, 0, 0],
  'reconstruction': [0, 0.5, 0],
};
