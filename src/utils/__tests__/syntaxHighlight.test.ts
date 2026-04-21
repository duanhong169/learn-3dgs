import { describe, it, expect } from 'vitest';

import { tokenizeTypeScript } from '@/utils/syntaxHighlight';

describe('tokenizeTypeScript', () => {
  it('preserves total source length via concatenated token text', () => {
    const src = `const x: number = 42;\n// hi\nfunction f() { return 'ok'; }`;
    const tokens = tokenizeTypeScript(src);
    expect(tokens.map((t) => t.text).join('')).toBe(src);
  });

  it('tags keywords', () => {
    const tokens = tokenizeTypeScript('const x = 1;');
    expect(tokens.find((t) => t.text === 'const')?.kind).toBe('keyword');
  });

  it('tags strings including escape sequences', () => {
    const tokens = tokenizeTypeScript(`const s = "he\\"llo";`);
    const str = tokens.find((t) => t.kind === 'string');
    expect(str).toBeDefined();
    expect(str!.text).toBe('"he\\"llo"');
  });

  it('tags template literals', () => {
    const tokens = tokenizeTypeScript('const s = `hi`;');
    expect(tokens.find((t) => t.kind === 'string')?.text).toBe('`hi`');
  });

  it('tags line comments up to the newline only', () => {
    const tokens = tokenizeTypeScript('x = 1; // trailing\ny = 2;');
    const cmt = tokens.find((t) => t.kind === 'comment');
    expect(cmt!.text).toBe('// trailing');
    // The newline should still be present in the text stream after the comment.
    const joined = tokens.map((t) => t.text).join('');
    expect(joined).toContain('// trailing\n');
  });

  it('tags block comments', () => {
    const tokens = tokenizeTypeScript('/* multi\nline */ x');
    expect(tokens[0]!.kind).toBe('comment');
    expect(tokens[0]!.text).toBe('/* multi\nline */');
  });

  it('tags numbers including decimals and exponents', () => {
    const tokens = tokenizeTypeScript('const a = 3.14e-2;');
    expect(tokens.find((t) => t.kind === 'number')?.text).toBe('3.14e-2');
  });

  it('tags PascalCase identifiers as types', () => {
    const tokens = tokenizeTypeScript('const m: Matrix2 = foo();');
    expect(tokens.find((t) => t.text === 'Matrix2')?.kind).toBe('type');
  });

  it('tags function-call identifiers', () => {
    const tokens = tokenizeTypeScript('doThing()');
    expect(tokens.find((t) => t.text === 'doThing')?.kind).toBe('function');
  });

  it('does not treat property access as a function call without parens', () => {
    const tokens = tokenizeTypeScript('obj.value');
    const value = tokens.find((t) => t.text === 'value');
    expect(value?.kind).not.toBe('function');
  });

  it('handles unterminated strings gracefully (no throw)', () => {
    expect(() => tokenizeTypeScript('const s = "no close')).not.toThrow();
  });
});
