# Generate 3D Object Component

Create a new Three.js/R3F component that renders inside `<Canvas>`.

## Arguments
- `$ARGUMENTS` — component name and optional description (e.g., "FloatingCrystal a crystal that floats and rotates")

## Instructions

1. Parse the first word of `$ARGUMENTS` as the component name (PascalCase). The rest is the description.
2. Create the following files:

### `src/components/canvas/{Name}/{Name}.tsx`
```tsx
import { useRef } from 'react';

import { useFrame } from '@react-three/fiber';

import type { Mesh } from 'three';
import type { Tuple3 } from '@/types/common';

export interface {Name}Props {
  position?: Tuple3;
  // TODO: add props
}

export function {Name}({ position = [0, 0, 0] }: {Name}Props) {
  const meshRef = useRef<Mesh>(null);

  useFrame((_, delta) => {
    if (!meshRef.current) return;
    // TODO: animation logic (mutate ref only, no setState)
    meshRef.current.rotation.y += delta;
  });

  return (
    <mesh ref={meshRef} position={position}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="#ff6b35" />
    </mesh>
  );
}
```

### `src/components/canvas/{Name}/index.ts`
```ts
export { {Name} } from './{Name}';
export type { {Name}Props } from './{Name}';
```

3. Add export to `src/components/canvas/index.ts`.
4. If a description was provided, flesh out the geometry, material, and animation.
5. Follow CLAUDE.md conventions:
   - Named exports only
   - useFrame: mutate refs, never setState
   - Type refs with Three.js types (`Mesh`, `Group`, etc.)
   - Use `Tuple3` for position/rotation/scale props
   - Import Three.js types with `import type`
