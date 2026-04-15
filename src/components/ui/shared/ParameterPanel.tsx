import { cn } from '@/lib/utils';
import { HelpTooltip } from './HelpTooltip';

export interface ParameterPanelProps {
  title: string;
  children: React.ReactNode;
  className?: string;
  /** Optional tooltip shown next to the title. */
  tooltip?: string;
}

export function ParameterPanel({ title, children, className, tooltip }: ParameterPanelProps) {
  return (
    <div
      className={cn(
        'pointer-events-auto rounded-md border border-border bg-surface/95 p-4 shadow-lg backdrop-blur-sm',
        className,
      )}
    >
      <h3 className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-text-muted">
        {title}
        {tooltip && <HelpTooltip content={tooltip} />}
      </h3>
      <div className="flex flex-col gap-3">{children}</div>
    </div>
  );
}
