export interface ParamSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (value: number) => void;
}

export function ParamSlider({ label, value, min, max, step = 0.01, unit, onChange }: ParamSliderProps) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-text">{label}</label>
        <span className="font-mono text-xs text-text-muted">
          {value.toFixed(step >= 1 ? 0 : 2)}{unit ?? ''}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-border accent-primary"
      />
    </div>
  );
}
