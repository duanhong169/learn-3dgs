/**
 * Compute alpha compositing for sorted splats at a given position.
 *
 * Uses front-to-back accumulation:
 * C_final = Σ cᵢ · αᵢ · Tᵢ
 * where Tᵢ = Π_{j<i} (1 - αⱼ)
 */
export function alphaComposite(
  colors: Array<[number, number, number]>,
  opacities: number[],
): {
  finalColor: [number, number, number];
  /** Remaining transmittance after all splats — multiply with background color to composite. */
  finalTransmittance: number;
  steps: AlphaBlendStep[];
} {
  const steps: AlphaBlendStep[] = [];
  let transmittance = 1;
  let r = 0;
  let g = 0;
  let b = 0;

  for (let i = 0; i < colors.length; i++) {
    const alpha = opacities[i] ?? 0;
    const color = colors[i] ?? [0, 0, 0] as [number, number, number];
    const contribution = alpha * transmittance;

    r += color[0] * contribution;
    g += color[1] * contribution;
    b += color[2] * contribution;

    steps.push({
      index: i,
      color,
      alpha,
      transmittance,
      contribution,
      accumulatedColor: [r, g, b],
    });

    transmittance *= 1 - alpha;

    // Early termination when nearly opaque
    if (transmittance < 0.001) break;
  }

  return {
    finalColor: [r, g, b],
    finalTransmittance: transmittance,
    steps,
  };
}

/** A single step in the alpha compositing process. */
export interface AlphaBlendStep {
  index: number;
  color: [number, number, number];
  alpha: number;
  transmittance: number;
  contribution: number;
  accumulatedColor: [number, number, number];
}

/**
 * Evaluate a 1D Gaussian at position x relative to the splat center.
 * Returns the density value [0, 1].
 */
export function evaluateGaussian1D(x: number, center: number, sigma: number): number {
  const d = (x - center) / sigma;
  return Math.exp(-0.5 * d * d);
}

/**
 * Convert a hex color string to RGB [0–1] tuple.
 */
export function hexToRGB(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return [0, 0, 0];
  return [
    parseInt(result[1] ?? '0', 16) / 255,
    parseInt(result[2] ?? '0', 16) / 255,
    parseInt(result[3] ?? '0', 16) / 255,
  ];
}

/**
 * Convert RGB [0–1] tuple to hex color string.
 */
export function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (c: number) => {
    const val = Math.round(Math.min(1, Math.max(0, c)) * 255);
    return val.toString(16).padStart(2, '0');
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}
