import { Line } from '@react-three/drei';

export interface PixelProbeProps {
  /** X position of the probe. */
  x: number;
  /** Height of the probe line. */
  height?: number;
  /** Z position (depth axis). */
  zRange?: [number, number];
  color?: string;
}

/**
 * A vertical line representing a pixel probe for sampling alpha blending.
 */
export function PixelProbe({
  x,
  height = 3,
  zRange = [-1, 6],
  color = '#d29922',
}: PixelProbeProps) {
  return (
    <group>
      {/* Vertical probe line */}
      <Line
        points={[
          [x, -height / 2, 0],
          [x, height / 2, 0],
        ]}
        color={color}
        lineWidth={2}
      />

      {/* Depth ray (along Z axis) */}
      <Line
        points={[
          [x, 0, zRange[0]],
          [x, 0, zRange[1]],
        ]}
        color={color}
        lineWidth={1}
        dashed
        dashSize={0.1}
        gapSize={0.05}
        transparent
        opacity={0.4}
      />

      {/* Probe indicator dot */}
      <mesh position={[x, 0, 0]}>
        <sphereGeometry args={[0.06, 8, 8]} />
        <meshBasicMaterial color={color} />
      </mesh>
    </group>
  );
}
