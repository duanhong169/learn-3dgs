import { cn } from '@/lib/utils';

export interface MatrixDisplayProps {
  label: string;
  values: string[][];
  className?: string;
}

export function MatrixDisplay({ label, values, className }: MatrixDisplayProps) {

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <span className="text-xs font-medium text-text-muted">{label}</span>
      <div className="inline-flex items-center gap-0.5">
        {/* Left bracket */}
        <span className="text-lg font-light text-text-muted">[</span>
        <div className="flex flex-col gap-0.5">
          {values.map((row, i) => (
            <div key={i} className="flex gap-2">
              {row.map((val, j) => (
                <span
                  key={j}
                  className="w-12 text-right font-mono text-xs text-text"
                >
                  {val}
                </span>
              ))}
            </div>
          ))}
        </div>
        {/* Right bracket */}
        <span className="text-lg font-light text-text-muted">]</span>
      </div>
    </div>
  );
}
