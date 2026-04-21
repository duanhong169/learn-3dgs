/**
 * Lightweight TypeScript syntax highlighter.
 *
 * Not a full parser — just a single-pass tokenizer that handles comments,
 * strings, numbers, keywords, types, and function calls. Good enough for
 * displaying short source snippets in the CodePeek panel without shipping
 * a full highlight library.
 *
 * Output: an array of `{ kind, text }` tokens. Whitespace is preserved as
 * `{ kind: 'text', text }` so callers can render a plain `<code>` / `<pre>`.
 */

export type TokenKind =
  | 'text'
  | 'comment'
  | 'string'
  | 'number'
  | 'keyword'
  | 'type'
  | 'function'
  | 'regex';

export interface HighlightToken {
  kind: TokenKind;
  text: string;
}

const KEYWORDS = new Set([
  'import', 'from', 'export', 'default', 'as',
  'const', 'let', 'var',
  'function', 'return', 'async', 'await', 'yield',
  'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break', 'continue',
  'try', 'catch', 'finally', 'throw',
  'class', 'extends', 'implements', 'new', 'this', 'super',
  'interface', 'type', 'enum', 'namespace', 'declare',
  'public', 'private', 'protected', 'readonly', 'static', 'abstract', 'override',
  'in', 'of', 'instanceof', 'typeof', 'keyof', 'infer',
  'true', 'false', 'null', 'undefined', 'void',
]);

const BUILTIN_TYPES = new Set([
  'string', 'number', 'boolean', 'bigint', 'symbol',
  'any', 'unknown', 'never', 'object',
  'Array', 'ReadonlyArray', 'Readonly', 'Partial', 'Required', 'Pick', 'Omit',
  'Record', 'Map', 'Set', 'WeakMap', 'WeakSet',
  'Promise', 'Date', 'Error', 'RegExp', 'Math', 'JSON',
  'Uint8Array', 'Uint8ClampedArray', 'Float32Array', 'Int32Array',
  'Matrix2', 'Matrix3', 'Tuple3',
]);

const IDENT_START = /[a-zA-Z_$]/;
const IDENT_PART = /[a-zA-Z0-9_$]/;
const NUMBER_START = /[0-9]/;

/**
 * Tokenize TypeScript source into highlight spans.
 * Never throws; unrecognised characters fall through as `text`.
 */
export function tokenizeTypeScript(src: string): HighlightToken[] {
  const out: HighlightToken[] = [];
  let i = 0;
  const n = src.length;
  let pendingText = '';

  const flushText = () => {
    if (pendingText) {
      out.push({ kind: 'text', text: pendingText });
      pendingText = '';
    }
  };

  while (i < n) {
    const ch = src[i]!;
    const ch2 = src.substring(i, i + 2);

    // --- Line comment ---
    if (ch2 === '//') {
      flushText();
      const start = i;
      while (i < n && src[i] !== '\n') i++;
      out.push({ kind: 'comment', text: src.slice(start, i) });
      continue;
    }

    // --- Block comment ---
    if (ch2 === '/*') {
      flushText();
      const start = i;
      i += 2;
      while (i < n && src.substring(i, i + 2) !== '*/') i++;
      if (i < n) i += 2;
      out.push({ kind: 'comment', text: src.slice(start, i) });
      continue;
    }

    // --- String (single, double, or backtick) ---
    if (ch === '"' || ch === "'" || ch === '`') {
      flushText();
      const quote = ch;
      const start = i;
      i++;
      while (i < n && src[i] !== quote) {
        if (src[i] === '\\' && i + 1 < n) i += 2;
        else i++;
      }
      if (i < n) i++;
      out.push({ kind: 'string', text: src.slice(start, i) });
      continue;
    }

    // --- Number ---
    if (NUMBER_START.test(ch) || (ch === '.' && i + 1 < n && NUMBER_START.test(src[i + 1]!))) {
      flushText();
      const start = i;
      while (i < n && /[0-9.eE+\-_xXoObBhH]/.test(src[i]!)) {
        // Break on '+' or '-' unless preceded by 'e'/'E'.
        const c = src[i]!;
        if ((c === '+' || c === '-') && i > start) {
          const prev = src[i - 1]!;
          if (prev !== 'e' && prev !== 'E') break;
        }
        i++;
      }
      out.push({ kind: 'number', text: src.slice(start, i) });
      continue;
    }

    // --- Identifier / keyword / type ---
    if (IDENT_START.test(ch)) {
      flushText();
      const start = i;
      while (i < n && IDENT_PART.test(src[i]!)) i++;
      const word = src.slice(start, i);
      let kind: TokenKind = 'text';
      if (KEYWORDS.has(word)) kind = 'keyword';
      else if (BUILTIN_TYPES.has(word)) kind = 'type';
      else if (/^[A-Z]/.test(word)) kind = 'type';
      else {
        // Peek for function-call: identifier followed by optional spaces + '('.
        let j = i;
        while (j < n && (src[j] === ' ' || src[j] === '\t')) j++;
        if (src[j] === '(') kind = 'function';
      }
      out.push({ kind, text: word });
      continue;
    }

    // --- Fallthrough: ordinary punctuation / whitespace ---
    pendingText += ch;
    i++;
  }

  flushText();
  return out;
}
