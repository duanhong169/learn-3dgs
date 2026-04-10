# Generate UI Component

Create a new HTML overlay component for the R3F project.

## Arguments
- `$ARGUMENTS` — component name and optional description (e.g., "InfoPanel a panel showing object details")

## Instructions

1. Parse the first word of `$ARGUMENTS` as the component name (PascalCase). The rest is the description.
2. Create the following files:

### `src/components/ui/{Name}/{Name}.tsx`
```tsx
import { cn } from '@/lib/utils';

export interface {Name}Props {
  className?: string;
  // TODO: add props
}

export function {Name}({ className }: {Name}Props) {
  return (
    <div className={cn('pointer-events-auto', className)}>
      {/* TODO: implement */}
    </div>
  );
}
```

### `src/components/ui/{Name}/{Name}.test.tsx`
```tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { {Name} } from './{Name}';

describe('{Name}', () => {
  it('renders without crashing', () => {
    render(<{Name} />);
    // TODO: add meaningful assertions
  });
});
```

### `src/components/ui/{Name}/index.ts`
```ts
export { {Name} } from './{Name}';
export type { {Name}Props } from './{Name}';
```

3. Add export to `src/components/ui/index.ts`.
4. If a description was provided, flesh out the props and JSX based on it.
5. Remember: UI components use `pointer-events-auto` for interactive elements since the overlay container is `pointer-events-none`.
6. Follow all conventions from CLAUDE.md (named exports, cn() for classes, etc.).
