import { cn } from '@/lib/utils';
import { CHAPTERS } from '@/constants/chapters';
import { CHAPTER_TRANSITIONS } from '@/constants/chapterTransitions';
import { useChapterStore } from '@/store/useChapterStore';

import type { ChapterId } from '@/types/chapters';

export interface TransitionPanelProps {
  /** The chapter that is currently ending (i.e. user is on its last step). */
  currentId: ChapterId;
  className?: string;
}

/**
 * 承上启下 card shown on the last step of each chapter.
 * Recaps what was learned + teases (and links to) the next chapter.
 */
export function TransitionPanel({ currentId, className }: TransitionPanelProps) {
  const setChapter = useChapterStore((s) => s.setChapter);

  const transition = CHAPTER_TRANSITIONS[currentId];
  const currentIndex = CHAPTERS.findIndex((c) => c.id === currentId);
  const nextChapter = currentIndex >= 0 ? CHAPTERS[currentIndex + 1] : undefined;

  return (
    <div
      className={cn(
        'mb-3 rounded-md border border-primary/30 bg-primary/5 px-3 py-2.5',
        className,
      )}
    >
      <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
        <span>📘</span>
        <span>本章小结</span>
      </div>
      <p className="mb-2 text-xs leading-relaxed text-text">{transition.summary}</p>
      <p className="mb-2.5 text-xs leading-relaxed text-text-muted">{transition.nextHint}</p>
      {nextChapter ? (
        <button
          onClick={() => setChapter(nextChapter.id)}
          className="w-full rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white transition-colors duration-75 hover:bg-primary/90"
        >
          {nextChapter.icon} 下一章：{nextChapter.title} →
        </button>
      ) : (
        <div className="rounded-md border border-border bg-surface px-3 py-2 text-center text-xs text-text-muted">
          🎉 课程完成
        </div>
      )}
    </div>
  );
}
