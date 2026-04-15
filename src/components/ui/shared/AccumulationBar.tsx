import { rgbToHex } from '@/utils/blending';

export interface AccumulationBarProps {
  steps: Array<{
    color: [number, number, number];
    contribution: number;
    accumulatedColor: [number, number, number];
  }>;
  /** How many steps to show (for step-through mode). */
  visibleSteps?: number;
}

/**
 * Horizontal color accumulation bar showing the alpha compositing process.
 */
export function AccumulationBar({ steps, visibleSteps }: AccumulationBarProps) {
  const displaySteps = visibleSteps !== undefined ? steps.slice(0, visibleSteps + 1) : steps;
  const lastStep = displaySteps[displaySteps.length - 1];
  const finalColor = lastStep?.accumulatedColor ?? [0, 0, 0];

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-medium text-text-muted">颜色累积过程</span>

      {/* Step-by-step breakdown */}
      <div className="flex flex-col gap-1.5">
        {displaySteps.map((step, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            {/* Step contribution swatch */}
            <div
              className="h-4 w-4 shrink-0 rounded-sm border border-border"
              style={{ backgroundColor: rgbToHex(step.color[0], step.color[1], step.color[2]) }}
            />
            <span className="font-mono text-text-muted">
              x{step.contribution.toFixed(2)}
            </span>
            <span className="text-text-muted">&rarr;</span>
            {/* Accumulated color */}
            <div
              className="h-4 flex-1 rounded-sm border border-border"
              style={{
                backgroundColor: rgbToHex(
                  step.accumulatedColor[0],
                  step.accumulatedColor[1],
                  step.accumulatedColor[2],
                ),
              }}
            />
          </div>
        ))}
      </div>

      {/* Final result bar */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-text">最终颜色:</span>
        <div
          className="h-6 flex-1 rounded-md border border-border"
          style={{
            backgroundColor: rgbToHex(finalColor[0], finalColor[1], finalColor[2]),
          }}
        />
      </div>
    </div>
  );
}
