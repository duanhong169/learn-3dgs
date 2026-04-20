/** Available chapter identifiers. */
export type ChapterId = 'gaussian-basics' | 'splatting' | 'alpha-blending' | 'optimization' | 'reconstruction' | 'spherical-harmonics';

/** Metadata for a single chapter. */
export interface ChapterMeta {
  id: ChapterId;
  title: string;
  subtitle: string;
  icon: string;
  totalSteps: number;
}
