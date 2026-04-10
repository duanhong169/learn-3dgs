import { cn } from '@/lib/utils';
import { useAppStore } from '@/store/useAppStore';
import { OBJECT_COLORS } from '@/constants/scene';

const OBJECT_NAMES: Record<string, string> = {
  'box-1': 'Orange Box',
  'box-2': 'Teal Box',
  'box-3': 'Yellow Box',
};

const OBJECT_COLOR_MAP: Record<string, string> = {
  'box-1': OBJECT_COLORS[0]!,
  'box-2': OBJECT_COLORS[1]!,
  'box-3': OBJECT_COLORS[2]!,
};

export function Overlay() {
  const selectedId = useAppStore((s) => s.selectedId);
  const select = useAppStore((s) => s.select);

  return (
    <div className="pointer-events-none fixed inset-0 z-10">
      {/* Top-left title */}
      <div className="absolute left-4 top-4 pointer-events-auto">
        <h1 className="text-sm font-semibold text-white drop-shadow-md">R3F Template</h1>
        <p className="text-xs text-white/60 drop-shadow-md">Click a box to select it</p>
      </div>

      {/* Bottom-right selection info */}
      {selectedId && (
        <div
          className={cn(
            'pointer-events-auto absolute bottom-4 right-4',
            'rounded-md border border-white/10 bg-black/60 px-4 py-3 backdrop-blur-sm',
          )}
        >
          <div className="flex items-center gap-3">
            <div
              className="h-4 w-4 rounded-sm"
              style={{ backgroundColor: OBJECT_COLOR_MAP[selectedId] }}
            />
            <div>
              <p className="text-sm font-medium text-white">
                {OBJECT_NAMES[selectedId] ?? selectedId}
              </p>
              <p className="text-xs text-white/60">ID: {selectedId}</p>
            </div>
            <button
              onClick={() => select(null)}
              className="ml-4 text-xs text-white/40 hover:text-white/80"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
