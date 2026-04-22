import { useEffect, useMemo, useRef } from 'react';
import { create } from 'zustand';

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

/** Extract a single top-level function declaration by name. Falls back to full source if not found.
 *
 * Strategy (two-phase):
 *   1. Locate the body's opening `{` by scanning forward from the signature,
 *      balancing nested `()` / `[]` / `{}`, skipping strings and comments.
 *      The body `{` is the first `{` seen at bracket-depth 0 AFTER the
 *      parameter list closes. This correctly walks past multi-line object-
 *      literal return types like `(): { a: number } { body }`.
 *   2. Brace-count from the body `{` to its matching `}`, again skipping
 *      strings and comments.
 */
function extractFunction(source: string, functionName: string): string {
  const signatureRe = new RegExp(
    '(?:export\\s+)?function\\s+' + functionName + '\\b',
  );
  const sigMatch = signatureRe.exec(source);
  if (!sigMatch) return source;

  const start = sigMatch.index;
  const n = source.length;
  let i = start;

  // Helpers that advance `i` past string / comment / bracketed runs.
  const skipString = (quote: string): void => {
    i++; // opening quote
    while (i < n && source[i] !== quote) {
      if (source[i] === '\\' && i + 1 < n) i += 2;
      else i++;
    }
    if (i < n) i++; // closing quote
  };
  const skipLineComment = (): void => {
    while (i < n && source[i] !== '\n') i++;
  };
  const skipBlockComment = (): void => {
    i += 2;
    while (i < n && !(source[i] === '*' && source[i + 1] === '/')) i++;
    if (i < n) i += 2;
  };

  // Phase 1a: advance to the end of the parameter list `(…)`.
  // Find the first '(' at bracket-depth 0.
  while (i < n && source[i] !== '(') {
    const c = source[i]!;
    const c2 = source.substring(i, i + 2);
    if (c === '"' || c === "'" || c === '`') skipString(c);
    else if (c2 === '//') skipLineComment();
    else if (c2 === '/*') skipBlockComment();
    else i++;
  }
  if (i >= n) return source;
  // Now consume the balanced `(…)` for the param list.
  let parenDepth = 0;
  do {
    const c = source[i]!;
    const c2 = source.substring(i, i + 2);
    if (c === '"' || c === "'" || c === '`') skipString(c);
    else if (c2 === '//') skipLineComment();
    else if (c2 === '/*') skipBlockComment();
    else {
      if (c === '(') parenDepth++;
      else if (c === ')') parenDepth--;
      i++;
    }
  } while (i < n && parenDepth > 0);
  if (parenDepth !== 0) return source;

  // Phase 1b: now scan past any return-type annotation until we find the
  // body `{` at bracket-depth 0 AND brace-depth 0. We track `{` / `}` that
  // belong to return-type object literals separately from `()` / `[]` / `<>`
  // so a multi-line `: { ... }` return type doesn't get mistaken for a body.
  let bracketDepth = 0;
  let braceDepth = 0;
  let bodyOpenIdx = -1;
  while (i < n) {
    const c = source[i]!;
    const c2 = source.substring(i, i + 2);
    if (c === '"' || c === "'" || c === '`') {
      skipString(c);
      continue;
    }
    if (c2 === '//') {
      skipLineComment();
      continue;
    }
    if (c2 === '/*') {
      skipBlockComment();
      continue;
    }
    if (c === '(' || c === '[' || c === '<') {
      bracketDepth++;
      i++;
      continue;
    }
    if (c === ')' || c === ']' || c === '>') {
      if (bracketDepth > 0) bracketDepth--;
      i++;
      continue;
    }
    if (c === '{') {
      if (bracketDepth === 0 && braceDepth === 0) {
        // Look ahead: is this a return-type object literal or the body?
        // Heuristic: scan backwards over whitespace/comments for the nearest
        // non-blank token. If it's `)` or `>` , the function params / type
        // params have just closed and this `{` might either be the body
        // (no return type annotation) or the start of a `: { ... }` return
        // type — distinguish by whether we have seen a `:` at top level
        // since the params closed.
        //
        // Simpler: peek backward for the first non-space/non-comment char.
        // If it's `)` (params or generics close), this `{` is the body.
        // Otherwise it must be a return-type `{` and we should track it.
        let k = i - 1;
        while (k > 0 && /\s/.test(source[k]!)) k--;
        const prev = source[k];
        if (prev === ')' || prev === '>') {
          bodyOpenIdx = i;
          break;
        }
        // Otherwise we're inside a return-type annotation; start a brace run.
        braceDepth++;
        i++;
        continue;
      }
      braceDepth++;
      i++;
      continue;
    }
    if (c === '}') {
      if (braceDepth > 0) braceDepth--;
      i++;
      continue;
    }
    i++;
  }
  if (bodyOpenIdx < 0) return source;

  // Phase 2: brace-match from the body `{` to its matching `}`.
  i = bodyOpenIdx + 1;
  let depth = 1;
  while (i < n && depth > 0) {
    const c = source[i]!;
    const c2 = source.substring(i, i + 2);
    if (c === '"' || c === "'" || c === '`') {
      skipString(c);
      continue;
    }
    if (c2 === '//') {
      skipLineComment();
      continue;
    }
    if (c2 === '/*') {
      skipBlockComment();
      continue;
    }
    if (c === '{') depth++;
    else if (c === '}') depth--;
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
 *
 * Only one CodePeek panel can be open at a time across the whole app
 * (see `useCodePeekCoordinator`).
 */
/**
 * Tiny coordinator store: only one CodePeek panel can be open at a time.
 * We key by a component-local id (generated once per mount) so the trigger
 * that opened the current panel is the one highlighted.
 */
interface CodePeekCoordinatorState {
  openId: string | null;
  setOpen: (id: string | null) => void;
}
const useCodePeekCoordinator = create<CodePeekCoordinatorState>((set) => ({
  openId: null,
  setOpen: (id) => set({ openId: id }),
}));

let codePeekIdCounter = 0;

export function CodePeek({
  source,
  functionName,
  label,
  defaultOpen = false,
  caption,
  className,
}: CodePeekProps) {
  // Stable per-instance id so the coordinator can identify which trigger
  // currently owns the open panel.
  const idRef = useRef<string>(`codepeek-${++codePeekIdCounter}`);
  const id = idRef.current;
  const openId = useCodePeekCoordinator((s) => s.openId);
  const setOpenId = useCodePeekCoordinator((s) => s.setOpen);
  const open = openId === id;
  const setOpen = (next: boolean | ((v: boolean) => boolean)) => {
    const resolved = typeof next === 'function' ? next(open) : next;
    setOpenId(resolved ? id : null);
  };
  // Honour defaultOpen on mount — always win over any previous panel so tests
  // and intentional defaultOpen usages behave predictably.
  useEffect(() => {
    if (defaultOpen) setOpenId(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
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
