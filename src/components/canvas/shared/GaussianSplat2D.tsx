import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

import type { Mesh } from 'three';

export interface GaussianSplat2DProps {
  position?: [number, number, number];
  color?: string;
  opacity?: number;
  scale?: number;
  /** Whether this splat should be visible (for step-through mode). */
  visible?: boolean;
}

/**
 * A 2D Gaussian splat rendered as a camera-facing billboard quad with Gaussian falloff texture.
 */
export function GaussianSplat2D({
  position = [0, 0, 0],
  color = '#4ecdc4',
  opacity = 0.7,
  scale = 1,
  visible = true,
}: GaussianSplat2DProps) {
  const meshRef = useRef<Mesh>(null);

  // Create texture with Gaussian density pattern
  const texture = useMemo(() => {
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    // Radial gradient for Gaussian falloff
    const gradient = ctx.createRadialGradient(
      size / 2, size / 2, 0,
      size / 2, size / 2, size / 2,
    );
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(0.3, 'rgba(255, 255, 255, 0.6)');
    gradient.addColorStop(0.7, 'rgba(255, 255, 255, 0.15)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);

    const tex = new THREE.CanvasTexture(canvas);
    return tex;
  }, []);

  // Billboard: always face the camera
  useFrame(({ camera }) => {
    if (!meshRef.current) return;
    meshRef.current.quaternion.copy(camera.quaternion);
  });

  if (!visible) return null;

  return (
    <mesh ref={meshRef} position={position} scale={[scale, scale, 1]}>
      <planeGeometry args={[2, 2]} />
      <meshBasicMaterial
        map={texture}
        color={color}
        transparent
        opacity={opacity}
        depthWrite={false}
        side={THREE.DoubleSide}
        blending={THREE.NormalBlending}
      />
    </mesh>
  );
}
