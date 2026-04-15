export interface LossChartProps {
  data: number[];
  width?: number;
  height?: number;
}

/**
 * Simple SVG line chart showing loss over optimization steps.
 */
export function LossChart({ data, width = 220, height = 80 }: LossChartProps) {
  if (data.length < 2) {
    return (
      <div className="flex items-center justify-center rounded-md border border-border bg-bg" style={{ width, height }}>
        <span className="text-xs text-text-muted">等待数据...</span>
      </div>
    );
  }

  const padding = { top: 10, right: 10, bottom: 20, left: 30 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const maxVal = Math.max(...data, 0.01);
  const minVal = 0;

  const points = data.map((val, i) => {
    const x = padding.left + (i / (data.length - 1)) * chartW;
    const y = padding.top + (1 - (val - minVal) / (maxVal - minVal)) * chartH;
    return `${x},${y}`;
  });

  const pathD = `M ${points.join(' L ')}`;

  // Area fill
  const firstX = padding.left;
  const lastX = padding.left + chartW;
  const bottomY = padding.top + chartH;
  const areaD = `${pathD} L ${lastX},${bottomY} L ${firstX},${bottomY} Z`;

  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium text-text-muted">Loss 曲线</span>
      <svg width={width} height={height} className="rounded-md border border-border bg-bg">
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const y = padding.top + ratio * chartH;
          return (
            <line
              key={ratio}
              x1={padding.left}
              y1={y}
              x2={padding.left + chartW}
              y2={y}
              stroke="var(--color-border)"
              strokeWidth={0.5}
            />
          );
        })}

        {/* Area fill */}
        <path d={areaD} fill="var(--color-primary)" opacity={0.1} />

        {/* Line */}
        <path d={pathD} fill="none" stroke="var(--color-primary)" strokeWidth={1.5} />

        {/* Current value dot */}
        {data.length > 0 && (
          <circle
            cx={padding.left + chartW}
            cy={padding.top + (1 - ((data[data.length - 1] ?? 0) - minVal) / (maxVal - minVal)) * chartH}
            r={3}
            fill="var(--color-primary)"
          />
        )}

        {/* Y-axis labels */}
        <text x={padding.left - 4} y={padding.top + 4} textAnchor="end" className="fill-text-muted text-[8px]">
          {maxVal.toFixed(2)}
        </text>
        <text x={padding.left - 4} y={padding.top + chartH + 4} textAnchor="end" className="fill-text-muted text-[8px]">
          0
        </text>

        {/* X-axis label */}
        <text x={padding.left + chartW / 2} y={height - 4} textAnchor="middle" className="fill-text-muted text-[8px]">
          Step {data.length - 1}
        </text>
      </svg>
    </div>
  );
}
