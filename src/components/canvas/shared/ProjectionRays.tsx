import { Line } from '@react-three/drei';

export interface ProjectionRaysProps {
  /** Start point (3D Gaussian center). */
  from: [number, number, number];
  /** End point (camera position). */
  to: [number, number, number];
  /** Point on the image plane. */
  imagePlanePoint?: [number, number, number];
  color?: string;
  visible?: boolean;
}

/**
 * Dashed lines showing the projection from a 3D Gaussian through the camera onto the image plane.
 */
export function ProjectionRays({
  from,
  to,
  imagePlanePoint,
  color = '#58a6ff',
  visible = true,
}: ProjectionRaysProps) {
  if (!visible) return null;

  return (
    <group>
      {/* Main ray: Gaussian center → camera */}
      <Line
        points={[from, to]}
        color={color}
        lineWidth={1}
        dashed
        dashSize={0.1}
        gapSize={0.05}
        transparent
        opacity={0.6}
      />

      {/* Ray to image plane intersection */}
      {imagePlanePoint && (
        <>
          <Line
            points={[from, imagePlanePoint]}
            color="#d29922"
            lineWidth={1.5}
            dashed
            dashSize={0.08}
            gapSize={0.04}
            transparent
            opacity={0.8}
          />
          {/* Intersection dot on image plane */}
          <mesh position={imagePlanePoint}>
            <sphereGeometry args={[0.04, 8, 8]} />
            <meshBasicMaterial color="#d29922" />
          </mesh>
        </>
      )}
    </group>
  );
}
