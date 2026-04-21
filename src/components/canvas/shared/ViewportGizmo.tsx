import { GizmoHelper, GizmoViewport } from '@react-three/drei';

/**
 * Fixed orientation gizmo anchored to the top-left of the viewport.
 *
 * Drei's `GizmoHelper` renders an HUD that tracks the main camera's rotation,
 * giving users a persistent axis reference across all chapters. Clicking an
 * axis label tweens the camera to look down that axis.
 *
 * Colors follow the three.js convention:
 *   +X red, +Y green, +Z blue
 *
 * This component takes no props — it's meant to be dropped into `ChapterScene`
 * once so every chapter shares the exact same axis indicator.
 */
export function ViewportGizmo() {
  return (
    <GizmoHelper alignment="top-left" margin={[80, 80]}>
      <GizmoViewport
        axisColors={['#f85149', '#3fb950', '#58a6ff']}
        labelColor="#ffffff"
      />
    </GizmoHelper>
  );
}
