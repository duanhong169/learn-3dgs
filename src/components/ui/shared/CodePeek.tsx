import { useMemo, useState } from 'react';

import { cn } from '@/lib/utils';
import { useChapterStore } from '@/store/useChapterStore';
import { tokenizeTypeScript } from '@/utils/syntaxHighlight';

import type { HighlightToken, TokenKind } from '@/utils/syntaxHighlight';

export interface CodePeekProps {
  /** Raw source string. Callers should import via `import src from '@/utils/foo.ts?raw'`. */
  source: string;
  /** Optional — extract only the named top-level function body. */
  functionName?: string;
  /** File display name, e.g. 'utils/tileRaster.ts'. */
  label: string;
  /** Starts expanded. Defaults to false. */
  defaultOpen?: boolean;
  /** Optional short caption rendered above the code. */
  caption?: string;
  className?: string;
}

/** Extract a single top-level function declaration by name. Falls back to full source if not found. */
function extractFunction(source: string, functionName: string): string {
  // Find `function NAME` or `export function NAME` at a word boundary.
  const signatureRe = new RegExp(
    '(?:export\\s+)?function\\s+' + functionName + '\\b',
  );
  const sigMatch = signatureRe.exec(source);
  if (!sigMatch) return source;

  const start = sigMatch.index;
  // Walk forward from start, tracking brace depth inside the function body.
  const openIdx = source.indexOf('{', start);
  if (openIdx === -1) return source;

  let depth = 1;
  let i = openIdx + 1;
  while (i < source.length && depth > 0) {
    const ch = source[i]!;
    if (ch === '{') depth++;
    else if (ch === '}') depth--;
    i++;
  }
  if (depth !== 0) return source;
  return source.slice(start, i);
}

/**
 * CodePeek — a compact trigger button that opens a floating panel with the
 * referenced source code. Floats at the bottom-left of the viewport (independent
 * from the right-side parameter panel), so it never gets squeezed by sidebar
 * width or causes horizontal overflow.
 */
export function CodePeek({
  source,
  functionName,
  label,
  defaultOpen = false,
  caption,
  className,
}: CodePeekProps) {
  const [open, setOpen] = useState(defaultOpen);
  const sidebarCollapsed = useChapterStore((s) => s.sidebarCollapsed);
  const displayed = functionName ? extractFunction(source, functionName) : source;
  // Tokenize only when the panel is open — saves work on mount when the user
  // hasn't asked to see code yet.
  const tokens = useMemo(
    () => (open ? tokenizeTypeScript(displayed) : null),
    [open, displayed],
  );

  // Sidebar is 240px wide when expanded (w-60 in Tailwind).
  // When collapsed, the panel can hug the left edge of the viewport.
  const leftOffsetPx = sidebarCollapsed ? 16 : 240 + 16;

  return (
    <>
      {/* Trigger button — compact single-row pill. The full label/functionName
          is shown inside the floating panel, so the trigger only needs enough
          info to hint at what will appear. */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'pointer-events-auto flex w-full items-center gap-2 rounded-md border border-border bg-surface/95 px-3 py-2 text-xs font-medium text-text-muted shadow-sm transition-colors duration-75 hover:border-primary/40 hover:text-text',
          open && 'border-primary/40 text-primary',
          className,
        )}
      >
        <span className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-primary">
          &lt;/&gt;
        </span>
        <span className="flex-1 truncate text-left">
          查看代码
          {functionName && (
            <span className="ml-1.5 font-mono text-[10px] text-text-muted">
              {functionName}()
            </span>
          )}
        </span>
        <span className="shrink-0 text-[10px] text-text-muted">{open ? '▾' : '▸'}</span>
      </button>

      {/* Floating panel — fixed to the viewport, but offset by the sidebar
          width when it is expanded so the panel sits inside the main content
          area rather than underneath the sidebar. */}
      {open && (
        <div
          className="pointer-events-auto fixed bottom-4 z-30 flex max-h-[70vh] flex-col rounded-md border border-border bg-surface/98 shadow-xl backdrop-blur-sm"
          style={{
            left: `${leftOffsetPx}px`,
            width: `min(560px, calc(100vw - ${leftOffsetPx + 16}px))`,
          }}
          role="dialog"
          aria-label={`代码 ${label}`}
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-2 border-b border-border px-3 py-2">
            <div className="flex min-w-0 flex-col gap-0.5">
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-[10px] uppercase tracking-wider text-primary">
                  &lt;/&gt;
                </span>
                <span className="text-xs font-semibold text-text">查看代码</span>
              </div>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 font-mono text-[11px] text-text-muted">
                <span className="truncate">{label}</span>
                {functionName && (
                  <span className="text-primary">· {functionName}()</span>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="关闭"
              className="rounded-sm px-1.5 text-sm leading-none text-text-muted hover:bg-bg hover:text-text"
            >
              ×
            </button>
          </div>

          {/* Body */}
          <div className="flex flex-1 flex-col gap-2 overflow-hidden px-3 py-2">
            {caption && (
              <p className="shrink-0 text-xs leading-relaxed text-text-muted">
                {caption}
              </p>
            )}
            <pre className="flex-1 overflow-auto rounded-sm bg-bg p-2 font-mono text-[11px] leading-relaxed text-text">
              <code>{tokens ? renderTokens(tokens) : displayed}</code>
            </pre>
          </div>
        </div>
      )}
    </>
  );
}

const TOKEN_CLASS: Record<TokenKind, string> = {
  text: '',
  comment: 'text-[var(--color-syntax-comment)] italic',
  string: 'text-[var(--color-syntax-string)]',
  number: 'text-[var(--color-syntax-number)]',
  keyword: 'text-[var(--color-syntax-keyword)] font-medium',
  type: 'text-[var(--color-syntax-type)]',
  function: 'text-[var(--color-syntax-function)]',
  regex: 'text-[var(--color-syntax-string)]',
};

/** Render tokens as spans. Plain `text` tokens are emitted as bare strings to
 *  keep the DOM small for whitespace-heavy sources. */
function renderTokens(tokens: HighlightToken[]): React.ReactNode[] {
  return tokens.map((t, i) => {
    if (t.kind === 'text') return t.text;
    return (
      <span key={i} className={TOKEN_CLASS[t.kind]}>
        {t.text}
      </span>
    );
  });
}
