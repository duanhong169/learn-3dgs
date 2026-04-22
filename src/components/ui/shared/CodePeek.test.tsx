import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import { CodePeek } from './CodePeek';

const SAMPLE_SRC = `import { foo } from './foo';

export function alpha(x: number) {
  return x * 2;
}

function beta(y: number) {
  return y + 1;
}

export function gamma(z: number) {
  const inner = z * 3;
  return inner;
}
`;

describe('CodePeek', () => {
  it('renders a trigger button containing the label', () => {
    render(<CodePeek source={SAMPLE_SRC} label="utils/sample.ts" defaultOpen />);
    // Label appears inside the floating panel (not on the trigger itself).
    expect(screen.getByRole('button', { name: /查看代码/ })).toBeDefined();
    expect(screen.getByText(/utils\/sample\.ts/)).toBeDefined();
  });

  it('does not render the floating panel by default', () => {
    render(<CodePeek source={SAMPLE_SRC} label="utils/sample.ts" />);
    // Panel uses role="dialog"; should be absent before the user clicks.
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('opens the floating panel when the trigger is clicked', () => {
    render(<CodePeek source={SAMPLE_SRC} label="utils/sample.ts" />);
    const trigger = screen.getAllByRole('button')[0]!; // trigger is the first button
    fireEvent.click(trigger);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeDefined();
    // Full source is visible (no functionName filter applied).
    expect(dialog.textContent).toContain('function alpha');
    expect(dialog.textContent).toContain('function beta');
    expect(dialog.textContent).toContain('function gamma');
  });

  it('closes the panel when × is clicked', () => {
    render(<CodePeek source={SAMPLE_SRC} label="utils/sample.ts" defaultOpen />);
    expect(screen.getByRole('dialog')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: '关闭' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('respects defaultOpen prop', () => {
    render(<CodePeek source={SAMPLE_SRC} label="utils/sample.ts" defaultOpen />);
    expect(screen.getByRole('dialog')).toBeDefined();
  });

  it('extracts a single named function when functionName is provided', () => {
    render(
      <CodePeek
        source={SAMPLE_SRC}
        label="sample.ts"
        functionName="alpha"
        defaultOpen
      />,
    );
    const code = document.querySelector('code');
    expect(code).not.toBeNull();
    expect(code!.textContent).toContain('function alpha');
    expect(code!.textContent).toContain('return x * 2');
    expect(code!.textContent).not.toContain('function beta');
    expect(code!.textContent).not.toContain('function gamma');
  });

  it('falls back to full source when functionName does not match', () => {
    render(
      <CodePeek
        source={SAMPLE_SRC}
        label="sample.ts"
        functionName="missingFn"
        defaultOpen
      />,
    );
    const code = document.querySelector('code');
    expect(code!.textContent).toContain('function alpha');
    expect(code!.textContent).toContain('function beta');
  });

  it('renders the optional caption inside the floating panel', () => {
    render(
      <CodePeek
        source={SAMPLE_SRC}
        label="sample.ts"
        caption="This shows the alpha function"
        defaultOpen
      />,
    );
    expect(screen.getByText('This shows the alpha function')).toBeDefined();
  });

  it('shows functionName() on the trigger when provided', () => {
    render(
      <CodePeek source={SAMPLE_SRC} label="utils/sample.ts" functionName="alpha" />,
    );
    // Trigger contains "alpha()" as a hint; full label only appears in the panel when opened.
    const trigger = screen.getByRole('button', { name: /查看代码/ });
    expect(trigger.textContent).toContain('alpha()');
  });

  it('extracts full body when the signature has an object-literal return type', () => {
    // Regression: previously the naive indexOf('{') would latch onto the
    // return-type `{` and the brace-counter would close inside the signature,
    // leaving the actual body (delta = x * 10) unextracted.
    const SRC = `export function delta(
  x: number,
  buf: Uint8ClampedArray,
): { touchedCount: number; earlyTerminatedPixels: number } {
  const y = x * 10;
  return { touchedCount: y, earlyTerminatedPixels: 0 };
}
`;
    render(
      <CodePeek source={SRC} label="sample.ts" functionName="delta" defaultOpen />,
    );
    const code = document.querySelector('code');
    expect(code!.textContent).toContain('function delta');
    // Body content must be present.
    expect(code!.textContent).toContain('const y = x * 10');
    expect(code!.textContent).toContain('touchedCount: y');
    // Also the closing brace of the function itself.
    expect(code!.textContent).toMatch(/\}\s*$/);
  });
});
