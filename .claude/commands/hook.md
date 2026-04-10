# Generate Custom Hook

Create a new custom React hook with the project's standard structure.

## Arguments
- `$ARGUMENTS` — hook name and description (e.g., "useOrbitAnimation orbits an object around a center point")

## Instructions

1. Parse the first word of `$ARGUMENTS` as the hook name (must start with `use`, camelCase).
2. Create the following files:

### `src/hooks/{hookName}.ts`
```ts
import { useState, useEffect } from 'react';

/**
 * {description from arguments}
 *
 * @example
 * const value = {hookName}(inputValue, 300);
 */
export function {hookName}() {
  // TODO: implement
}
```

### `src/hooks/{hookName}.test.ts`
```ts
import { renderHook } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { {hookName} } from './{hookName}';

describe('{hookName}', () => {
  it('works correctly', () => {
    const { result } = renderHook(() => {hookName}());
    // TODO: add assertions
  });
});
```

3. Flesh out the implementation based on the description.
4. Include cleanup logic (AbortController, cleanup functions) if the hook has side effects.
5. If the hook is for use inside `<Canvas>` (uses useFrame/useThree), note this in the JSDoc.
6. Add proper TypeScript generics if the hook should be flexible.
