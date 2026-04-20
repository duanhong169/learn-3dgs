import { useEffect, useRef, useState } from 'react';

import { cn } from '@/lib/utils';

type SizeLevel = 1 | 2 | 3;

const BASE_WIDTH = 280;
const SIZE_LEVELS: SizeLevel[] = [1, 2, 3];

/**
 * Reusable fixed-position preview panel that hosts a shared `<canvas>` element
 * (typically the same hi-res canvas already being rendered by a CPU splatter).
 *
 * By accepting the canvas + its native size as props, this panel is
 * chapter-agnostic — chapter 5 (reconstruction) and chapter 6 (spherical
 * harmonics) both mount it with their own canvas + onClose handler.
 *
 * The panel is responsible for:
 *   - Reparenting the provided canvas into its DOM on mount, detaching on unmount
 *   - Preserving aspect ratio when the user toggles 1× / 2× / 3× size
 *   - Rendering a close button that invokes the caller-supplied onClose
 */
export interface CameraPreviewPanelProps {
  /** The shared canvas element to display (kept alive by its owner module). */
  canvas: HTMLCanvasElement;
  /** Native canvas width in pixels — used to preserve aspect ratio. */
  canvasWidth: number;
  /** Native canvas height in pixels — used to preserve aspect ratio. */
  canvasHeight: number;
  /** Click handler for the "×" close button (e.g. toggle store flag). */
  onClose: () => void;
  /** Optional panel title shown in the header. */
  title?: string;
}

export function CameraPreviewPanel({
  canvas,
  canvasWidth,
  canvasHeight,
  onClose,
  title = '相机视图预览',
}: CameraPreviewPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [sizeLevel, setSizeLevel] = useState<SizeLevel>(2);

  const width = BASE_WIDTH * sizeLevel;
  const height = Math.round((width * canvasHeight) / canvasWidth);

  // Mount/unmount: attach provided canvas once; detach on unmount.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    canvas.style.display = 'block';
    container.appendChild(canvas);

    return () => {
      if (canvas.parentElement === container) {
        container.removeChild(canvas);
      }
    };
  }, [canvas]);

  // Keep the canvas CSS size in sync with the selected level.
  useEffect(() => {
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
  }, [canvas, width, height]);

  return (
    <div
      className="pointer-events-auto absolute bottom-4 left-4 z-10 overflow-hidden rounded-md border border-border bg-surface/95 shadow-lg backdrop-blur-sm"
      style={{ width }}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-3 py-1.5">
        <span className="text-xs font-medium text-text">{title}</span>
        <div className="flex items-center gap-1">
          {SIZE_LEVELS.map((level) => (
            <button
              key={level}
              onClick={() => setSizeLevel(level)}
              aria-label={`${level} 倍尺寸`}
              aria-pressed={sizeLevel === level}
              className={cn(
                'flex h-6 w-7 items-center justify-center rounded text-xs font-medium leading-none transition-colors duration-75',
                sizeLevel === level
                  ? 'bg-primary text-white'
                  : 'text-text-muted hover:bg-bg hover:text-text',
              )}
            >
              {level}×
            </button>
          ))}
          <button
            onClick={onClose}
            aria-label="隐藏预览"
            className="ml-1 flex h-6 w-6 items-center justify-center rounded text-sm leading-none text-danger transition-colors duration-75 hover:bg-danger/10 hover:text-danger"
          >
            ×
          </button>
        </div>
      </div>
      {/* Canvas host — provided canvas gets appended here */}
      <div ref={containerRef} style={{ width, height }} />
    </div>
  );
}
