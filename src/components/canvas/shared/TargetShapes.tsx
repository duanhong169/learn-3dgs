import { OPTIMIZATION_TARGETS } from '@/constants/gaussian';

/**
 * Target shapes for the optimization ground truth scene.
 * Simple colored meshes representing the "real" scene to reconstruct.
 */
export function TargetShapes() {
  return (
    <group>
      {OPTIMIZATION_TARGETS.map((target, i) => (
        <mesh key={i} position={target.position}>
          {target.type === 'sphere' && <sphereGeometry args={[target.scale[0] * 0.5, 16, 16]} />}
          {target.type === 'box' && <boxGeometry args={[target.scale[0], target.scale[1], target.scale[2]]} />}
          {target.type === 'cylinder' && (
            <cylinderGeometry args={[target.scale[0] * 0.5, target.scale[0] * 0.5, target.scale[1], 16]} />
          )}
          <meshStandardMaterial
            color={target.color}
            transparent
            opacity={0.3}
            wireframe
          />
        </mesh>
      ))}
    </group>
  );
}
