# Code Review

Perform a thorough code review of the current changes or specified file.

## Arguments
- `$ARGUMENTS` — file path or "staged" for staged changes, or empty for all uncommitted changes

## Instructions

Review the code against these criteria and provide a structured report:

### 1. Correctness
- Logic errors, off-by-one, null/undefined handling
- Race conditions in async code
- Missing error handling

### 2. TypeScript
- Any use of `any` — suggest `unknown` + narrowing
- Missing or overly broad types
- Three.js types properly imported with `import type`

### 3. React / R3F Patterns
- Missing dependency array items in hooks
- State that should be derived instead of stored
- Components that should be split
- Missing cleanup in useEffect
- **useFrame violations**: setState in render loop, object creation in loop
- **Canvas/UI mixing**: DOM elements in canvas components or Three.js in UI

### 4. Performance (3D-specific)
- Unnecessary re-renders (missing memo/useMemo where it matters)
- Object creation in useFrame (new Vector3, etc.)
- Missing geometry/material disposal
- Large models without Suspense
- Zustand selectors: full store subscription vs targeted selector

### 5. Tailwind / Styling
- Inline styles that should be Tailwind classes (UI components only)
- Hardcoded colors instead of design tokens
- Missing pointer-events handling on overlay elements

### 6. Convention Compliance (per CLAUDE.md)
- Naming conventions
- Import ordering
- Canvas/UI separation
- Export style (named, not default)

### Output Format

```
## Code Review: {file/scope}

### Looks Good
- ...

### Suggestions
- ...

### Issues
- ...

### Summary
{1-2 sentence overall assessment}
```
