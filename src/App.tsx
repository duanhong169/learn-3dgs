import { Suspense } from 'react';

import { Canvas } from '@react-three/fiber';
import { Perf } from 'r3f-perf';

import { Scene } from '@/components/canvas';
import { Overlay } from '@/components/ui';

export function App() {
  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      <Canvas shadows camera={{ position: [3, 2.5, 4], fov: 50 }}>
        <Suspense fallback={null}>
          <Scene />
        </Suspense>
        <Perf position="top-left" />
      </Canvas>
      <Overlay />
    </div>
  );
}
