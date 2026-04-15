import { Suspense } from 'react';

import { Canvas } from '@react-three/fiber';

import { ChapterScene } from '@/components/canvas/ChapterScene';
import { AppShell } from '@/components/ui/AppShell';
import { ChapterOverlay } from '@/components/ui/ChapterOverlay';

export function App() {
  return (
    <AppShell>
      {/* 3D Canvas fills the main area */}
      <Canvas shadows camera={{ position: [4, 3, 4], fov: 50 }}>
        <Suspense fallback={null}>
          <ChapterScene />
        </Suspense>
      </Canvas>

      {/* HTML overlay on top of the canvas */}
      <div className="pointer-events-none absolute inset-0 z-10">
        <ChapterOverlay />
      </div>
    </AppShell>
  );
}
