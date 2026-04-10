# Refactor Code

Analyze and refactor the specified code following project conventions.

## Arguments
- `$ARGUMENTS` — file path or component/function name to refactor, plus optional goal (e.g., "src/components/canvas/Scene.tsx extract lighting into hook")

## Instructions

### Step 1: Analyze
- Read the target file(s)
- Identify code smells: long functions, deep nesting, duplicated logic, unclear names, mixed concerns
- Check for R3F-specific issues: setState in useFrame, missing disposal, Canvas/UI mixing

### Step 2: Plan
Present the refactoring plan BEFORE making changes:
```
## Refactoring Plan: {target}
1. {change description} — {reason}
2. {change description} — {reason}
...
```

### Step 3: Execute (after user confirms)
Apply the refactoring following these principles:
- **Preserve behavior** — refactoring must not change what the code does
- **Extract, don't rewrite** — prefer extracting functions/hooks/components over rewriting from scratch
- **One thing at a time** — each change should be independently reviewable
- Follow all CLAUDE.md conventions

### Common Refactoring Patterns (3D-specific)
- **Large scene** → Extract sub-groups or child components
- **Complex animation** → Extract into a custom hook using useFrame
- **Repeated material setup** → Extract shared materials with useMemo
- **Mixed Canvas/UI logic** → Separate into Zustand store actions
- **Prop drilling through scene** → Move to Zustand store
- **Magic numbers** → Extract to constants/scene.ts

### Step 4: Verify
- Run `npm run type-check` to confirm no type errors
- Run `npm run lint` to confirm style compliance
- Run related tests if they exist
