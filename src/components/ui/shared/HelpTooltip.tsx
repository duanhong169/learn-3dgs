import { useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';

export interface HelpTooltipProps {
  /** Tooltip text shown on hover. */
  content: string;
  /** Max width of the tooltip popup. */
  maxWidth?: number;
}

/**
 * A circled question mark icon that shows a tooltip on hover.
 * The tooltip is rendered via Portal to document.body to avoid
 * parent overflow/scroll issues.
 */
export function HelpTooltip({ content, maxWidth = 220 }: HelpTooltipProps) {
  const [tooltip, setTooltip] = useState<{ visible: boolean; top: number; left: number }>({
    visible: false,
    top: 0,
    left: 0,
  });
  const iconRef = useRef<HTMLSpanElement>(null);

  const handleMouseEnter = useCallback(() => {
    if (!iconRef.current) return;
    const rect = iconRef.current.getBoundingClientRect();

    // Position tooltip to the right of the icon by default
    let top = rect.top + rect.height / 2;
    let left = rect.right + 8;

    // If overflowing right edge, show to the left instead
    if (left + maxWidth > window.innerWidth - 8) {
      left = rect.left - maxWidth - 8;
    }

    // Clamp to viewport
    if (left < 8) left = 8;
    if (top < 8) top = 8;

    setTooltip({ visible: true, top, left });
  }, [maxWidth]);

  const handleMouseLeave = useCallback(() => {
    setTooltip((prev) => ({ ...prev, visible: false }));
  }, []);

  return (
    <>
      <span
        ref={iconRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className="inline-flex cursor-help items-center justify-center text-text-muted transition-colors duration-75 hover:text-primary"
        aria-label="帮助"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 16 16"
          fill="currentColor"
          className="shrink-0"
        >
          <path d="M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8Zm8-6.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM6.92 6.085h.001a.749.749 0 1 1-1.342-.67c.169-.339.516-.644.932-.856C6.922 4.34 7.379 4.2 7.88 4.2c.6 0 1.149.175 1.564.49.415.316.656.762.656 1.26 0 .36-.112.665-.282.927-.175.271-.418.486-.63.657l-.036.03c-.2.164-.374.306-.49.47a.749.749 0 0 1-.118.177c-.003.009-.003.013-.003.023v.5a.749.749 0 1 1-1.5 0v-.5c0-.376.144-.694.34-.95.2-.26.457-.472.664-.64l.04-.033c.199-.164.354-.297.475-.458a.39.39 0 0 0 .08-.218c0-.109-.065-.233-.225-.353-.165-.124-.414-.212-.726-.212-.303 0-.534.078-.683.154-.15.077-.246.168-.293.26ZM8 10.5a1 1 0 1 1 0 2 1 1 0 0 1 0-2Z" />
        </svg>
      </span>

      {tooltip.visible &&
        createPortal(
          <div
            className="pointer-events-none fixed z-[9999] rounded-md border border-border bg-surface px-3 py-2 shadow-lg"
            style={{
              top: tooltip.top,
              left: tooltip.left,
              maxWidth,
              transform: 'translateY(-50%)',
            }}
          >
            <p className="text-xs leading-relaxed text-text">{content}</p>
          </div>,
          document.body,
        )}
    </>
  );
}
