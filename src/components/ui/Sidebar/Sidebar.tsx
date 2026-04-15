import { cn } from '@/lib/utils';
import { useChapterStore } from '@/store/useChapterStore';
import { CHAPTERS } from '@/constants/chapters';
import type { ChapterId } from '@/types/chapters';

export function Sidebar() {
  const activeChapter = useChapterStore((s) => s.activeChapter);
  const setChapter = useChapterStore((s) => s.setChapter);
  const sidebarCollapsed = useChapterStore((s) => s.sidebarCollapsed);

  if (sidebarCollapsed) return null;

  return (
    <aside className="relative z-20 flex h-full w-60 shrink-0 flex-col border-r border-border bg-surface">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold text-text">章节目录</h2>
      </div>
      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-2">
        {CHAPTERS.map((chapter, index) => (
          <ChapterNavItem
            key={chapter.id}
            id={chapter.id}
            index={index}
            icon={chapter.icon}
            title={chapter.title}
            subtitle={chapter.subtitle}
            isActive={chapter.id === activeChapter}
            onClick={() => setChapter(chapter.id)}
          />
        ))}
      </nav>
    </aside>
  );
}

interface ChapterNavItemProps {
  id: ChapterId;
  index: number;
  icon: string;
  title: string;
  subtitle: string;
  isActive: boolean;
  onClick: () => void;
}

function ChapterNavItem({ index, icon, title, subtitle, isActive, onClick }: ChapterNavItemProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex w-full items-start gap-3 rounded-md px-3 py-2.5 text-left transition-colors duration-75',
        isActive
          ? 'bg-primary/10 text-primary'
          : 'text-text hover:bg-bg',
      )}
    >
      <span className="mt-0.5 text-base">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className={cn(
            'inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-medium',
            isActive
              ? 'bg-primary text-white'
              : 'bg-border text-text-muted',
          )}>
            {index + 1}
          </span>
          <span className="truncate text-sm font-medium">{title}</span>
        </div>
        <p className="mt-0.5 truncate pl-7 text-xs text-text-muted">{subtitle}</p>
      </div>
    </button>
  );
}
