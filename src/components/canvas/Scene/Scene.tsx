import { Environment, Grid, OrbitControls } from '@react-three/drei';
import { useControls } from 'leva';

import { InteractiveBox } from '@/components/canvas/InteractiveBox';
import { OBJECT_COLORS } from '@/constants/scene';

export function Scene() {
  const { showGrid, environment } = useControls('Scene', {
    showGrid: true,
    environment: {
      options: ['studio', 'city', 'sunset', 'dawn', 'night', 'warehouse', 'forest', 'apartment', 'park', 'lobby'],
      value: 'studio',
    },
  });

  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.4} />
      <directionalLight
        position={[8, 10, 5]}
        intensity={1.2}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />

      {/* Environment map for reflections */}
      <Environment preset={environment as 'studio'} background={false} />

      {/* Interactive objects */}
      <InteractiveBox id="box-1" position={[-2, 0.5, 0]} color={OBJECT_COLORS[0]} />
      <InteractiveBox id="box-2" position={[0, 0.5, 0]} color={OBJECT_COLORS[1]} />
      <InteractiveBox id="box-3" position={[2, 0.5, 0]} color={OBJECT_COLORS[2]} />

      {/* Ground shadow catcher — slightly below grid to avoid z-fighting */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.001, 0]} receiveShadow>
        <planeGeometry args={[50, 50]} />
        <shadowMaterial opacity={0.15} />
      </mesh>

      {/* Grid helper */}
      {showGrid && (
        <Grid
          args={[20, 20]}
          cellSize={1}
          cellThickness={0.5}
          cellColor="#6e6e6e"
          sectionSize={5}
          sectionThickness={1}
          sectionColor="#9d4b4b"
          fadeDistance={30}
          infiniteGrid
        />
      )}

      {/* Camera controls */}
      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.05}
        minDistance={3}
        maxDistance={20}
        maxPolarAngle={Math.PI / 2.1}
      />
    </>
  );
}
