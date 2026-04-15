import { useRef, useEffect } from 'react';
import * as THREE from 'three';

export interface ScreenPlaneProps {
  /** Position of the plane center. */
  position?: [number, number, number];
  /** Width and height of the plane. */
  size?: [number, number];
  /** 2D ellipse parameters to draw. */
  ellipse?: {
    centerX: number;
    centerY: number;
    radiusX: number;
    radiusY: number;
    angle: number;
    color: string;
  } | null;
}

// Module-level singleton: avoids ref access during render
const sharedCanvas = (() => {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  return c;
})();
const sharedTexture = new THREE.CanvasTexture(sharedCanvas);

/**
 * A plane in 3D space that displays a 2D Gaussian splat drawn via CanvasTexture.
 */
export function ScreenPlane({
  position = [0, 0, -3],
  size = [3, 2],
  ellipse = null,
}: ScreenPlaneProps) {
  const meshRef = useRef<THREE.Mesh>(null);

  // Draw the 2D Gaussian ellipse on the canvas
  useEffect(() => {
    const ctx = sharedCanvas.getContext('2d');
    if (!ctx) return;

    const w = sharedCanvas.width;
    const h = sharedCanvas.height;

    // Clear with dark transparent background
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(13, 17, 23, 0.6)';
    ctx.fillRect(0, 0, w, h);

    // Draw grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 8; i++) {
      const x = (i / 8) * w;
      const y = (i / 8) * h;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    if (ellipse) {
      const cx = (ellipse.centerX + 1) * 0.5 * w;
      const cy = (1 - (ellipse.centerY + 1) * 0.5) * h;
      const rx = ellipse.radiusX * w * 0.15;
      const ry = ellipse.radiusY * h * 0.15;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(-ellipse.angle);

      const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, Math.max(rx, ry));
      gradient.addColorStop(0, ellipse.color + 'cc');
      gradient.addColorStop(0.5, ellipse.color + '66');
      gradient.addColorStop(1, ellipse.color + '00');

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.ellipse(0, 0, rx * 2, ry * 2, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = ellipse.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
      ctx.stroke();

      ctx.restore();
    }

    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.font = '14px sans-serif';
    ctx.fillText('Image Plane', 10, 20);

    sharedTexture.needsUpdate = true;
  }, [ellipse]);

  return (
    <mesh ref={meshRef} position={position}>
      <planeGeometry args={size} />
      <meshBasicMaterial
        map={sharedTexture}
        transparent
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}
