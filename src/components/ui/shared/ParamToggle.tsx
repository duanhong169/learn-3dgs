import { cn } from '@/lib/utils';
import { HelpTooltip } from './HelpTooltip';

export interface ParamToggleProps {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  /** Optional tooltip shown as a circled question mark icon. */
  tooltip?: string;
}

export function ParamToggle({ label, value, onChange, tooltip }: ParamToggleProps) {
  return (
    <label className="flex cursor-pointer items-center justify-between">
      <span className="flex items-center gap-1.5 text-xs font-medium text-text">
        {label}
        {tooltip && <HelpTooltip content={tooltip} />}
      </span>
      <button
        role="switch"
        aria-checked={value}
        onClick={() => onChange(!value)}
        className={cn(
          'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-75',
          value ? 'bg-primary' : 'bg-border',
        )}
      >
        <span
          className={cn(
            'inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform duration-75',
            value ? 'translate-x-4' : 'translate-x-0.5',
          )}
        />
      </button>
    </label>
  );
}
