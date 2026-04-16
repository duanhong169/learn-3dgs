import { useMemo } from 'react';
import { Line } from '@react-three/drei';
import * as THREE from 'three';

export interface AxisArrowsProps {
  /** Length of each axis arrow. */
  length?: number;
  /** Position offset for the arrows group. */
  position?: [number, number, number];
  /** Scale to match the parent Gaussian's scale. */
  scale?: [number, number, number];
  /** Rotation (degrees) to match the Gaussian. */
  rotation?: [number, number, number];
}

/** A cone tip that points along a given direction vector. */
function ArrowTip({
  position,
  direction,
  color,
}: {
  position: [number, number, number];
  direction: [number, number, number];
  color: string;
}) {
  // Compute quaternion that rotates Y+ (cone default) to the target direction
  const quaternion = useMemo(() => {
    const dir = new THREE.Vector3(...direction).normalize();
    const quat = new THREE.Quaternion();
    quat.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    return quat;
  }, [direction]);

  return (
    <mesh position={position} quaternion={quaternion}>
      <coneGeometry args={[0.05, 0.15, 8]} />
      <meshBasicMaterial color={color} />
    </mesh>
  );
}

/**
 * RGB-colored axis arrows showing the principal axes of a Gaussian.
 * X = Red, Y = Green, Z = Blue.
 */
export function AxisArrows({
  length = 2,
  position = [0, 0, 0],
  scale = [1, 1, 1],
  rotation = [0, 0, 0],
}: AxisArrowsProps) {
  const rotRad: [number, number, number] = useMemo(
    () => [
      (rotation[0] * Math.PI) / 180,
      (rotation[1] * Math.PI) / 180,
      (rotation[2] * Math.PI) / 180,
    ],
    [rotation],
  );

  const axes = useMemo(() => [
    { dir: [1, 0, 0] as [number, number, number], color: '#f85149', axisScale: scale[0] },
    { dir: [0, 1, 0] as [number, number, number], color: '#3fb950', axisScale: scale[1] },
    { dir: [0, 0, 1] as [number, number, number], color: '#58a6ff', axisScale: scale[2] },
  ], [scale]);

  return (
    <group position={position} rotation={rotRad}>
      {axes.map((axis, i) => {
        const scaledLength = length * axis.axisScale;
        const end: [number, number, number] = [
          axis.dir[0] * scaledLength,
          axis.dir[1] * scaledLength,
          axis.dir[2] * scaledLength,
        ];

        return (
          <group key={i}>
            <Line
              points={[[0, 0, 0], end]}
              color={axis.color}
              lineWidth={2}
            />
            <ArrowTip position={end} direction={axis.dir} color={axis.color} />
          </group>
        );
      })}
    </group>
  );
}
