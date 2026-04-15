import { Sidebar } from '@/components/ui/Sidebar';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { useChapterStore } from '@/store/useChapterStore';

export interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const sidebarCollapsed = useChapterStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useChapterStore((s) => s.toggleSidebar);

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden">
      {/* Top navigation bar */}
      <header className="relative z-20 flex h-12 shrink-0 items-center justify-between border-b border-white/10 bg-nav-bg px-4">
        <div className="flex items-center gap-3">
          <button
            onClick={toggleSidebar}
            className="flex h-8 w-8 items-center justify-center rounded-md text-white/80 transition-colors duration-75 hover:bg-white/10 hover:text-white"
            aria-label={sidebarCollapsed ? '展开侧边栏' : '收起侧边栏'}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M1 2.75A.75.75 0 0 1 1.75 2h12.5a.75.75 0 0 1 0 1.5H1.75A.75.75 0 0 1 1 2.75Zm0 5A.75.75 0 0 1 1.75 7h12.5a.75.75 0 0 1 0 1.5H1.75A.75.75 0 0 1 1 7.75ZM1.75 12h12.5a.75.75 0 0 1 0 1.5H1.75a.75.75 0 0 1 0-1.5Z" />
            </svg>
          </button>
          <h1 className="text-sm font-semibold text-white">Learn 3DGS</h1>
          <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-white/60">
            交互式教学
          </span>
        </div>
        <ThemeToggle />
      </header>

      {/* Main area: sidebar + content */}
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="relative min-w-0 flex-1 overflow-hidden">{children}</main>
      </div>
    </div>
  );
}
