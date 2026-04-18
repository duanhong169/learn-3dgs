import { useEffect, useRef, useState } from 'react';

import { hiCanvas, HI_W, HI_H } from '@/components/canvas/shared/CameraRenderedView';
import { useReconstructionStore } from '@/store/useReconstructionStore';
import { cn } from '@/lib/utils';

type SizeLevel = 1 | 2 | 3;

const BASE_WIDTH = 280;
const SIZE_LEVELS: SizeLevel[] = [1, 2, 3];

function computeSize(level: SizeLevel) {
  const width = BASE_WIDTH * level;
  const height = Math.round((width * HI_H) / HI_W);
  return { width, height };
}

/**
 * Fixed preview panel showing the virtual camera's rendered view.
 * Positioned at the bottom-left of the viewport. Only visible in
 * chapter 5 under cameraRender viewMode, when showCameraPreview is true.
 *
 * Reuses the hi-res canvas from CameraRenderedView — no extra rendering work.
 */
export function CameraPreviewPanel() {
  const containerRef = useRef<HTMLDivElement>(null);
  const toggleCameraPreview = useReconstructionStore((s) => s.toggleCameraPreview);
  const [sizeLevel, setSizeLevel] = useState<SizeLevel>(2);

  const { width, height } = computeSize(sizeLevel);

  // Mount/unmount: attach shared hiCanvas once; detach on unmount.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    hiCanvas.style.display = 'block';
    container.appendChild(hiCanvas);

    return () => {
      if (hiCanvas.parentElement === container) {
        container.removeChild(hiCanvas);
      }
    };
  }, []);

  // Keep the canvas CSS size in sync with the selected level.
  useEffect(() => {
    hiCanvas.style.width = `${width}px`;
    hiCanvas.style.height = `${height}px`;
  }, [width, height]);

  return (
    <div
      className="pointer-events-auto absolute bottom-4 left-4 z-10 overflow-hidden rounded-md border border-border bg-surface/95 shadow-lg backdrop-blur-sm"
      style={{ width }}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-3 py-1.5">
        <span className="text-xs font-medium text-text">相机视图预览</span>
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
            onClick={toggleCameraPreview}
            aria-label="隐藏预览"
            className="ml-1 flex h-6 w-6 items-center justify-center rounded text-sm leading-none text-danger transition-colors duration-75 hover:bg-danger/10 hover:text-danger"
          >
            ×
          </button>
        </div>
      </div>
      {/* Canvas host — hiCanvas gets appended here */}
      <div ref={containerRef} style={{ width, height }} />
    </div>
  );
}
