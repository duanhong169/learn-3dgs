/** Available chapter identifiers. */
export type ChapterId =
  | 'intro'
  | 'gaussian-basics'
  | 'splatting'
  | 'alpha-blending'
  | 'tile-rasterization'
  | 'optimization'
  | 'reconstruction'
  | 'spherical-harmonics';

/** Metadata for a single chapter. */
export interface ChapterMeta {
  id: ChapterId;
  title: string;
  subtitle: string;
  icon: string;
  totalSteps: number;
}
