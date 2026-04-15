export interface ParamColorPickerProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

export function ParamColorPicker({ label, value, onChange }: ParamColorPickerProps) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs font-medium text-text">{label}</span>
      <div className="flex items-center gap-2">
        <span className="font-mono text-xs text-text-muted">{value}</span>
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-6 w-6 cursor-pointer rounded border border-border bg-transparent"
        />
      </div>
    </div>
  );
}
