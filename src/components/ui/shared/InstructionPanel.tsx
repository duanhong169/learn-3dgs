import { cn } from '@/lib/utils';
import { useChapterStore } from '@/store/useChapterStore';
import { CHAPTERS } from '@/constants/chapters';
import { TransitionPanel } from './TransitionPanel';

export interface InstructionPanelProps {
  steps: string[];
}

export function InstructionPanel({ steps }: InstructionPanelProps) {
  const instructionStep = useChapterStore((s) => s.instructionStep);
  const activeChapter = useChapterStore((s) => s.activeChapter);
  const nextStep = useChapterStore((s) => s.nextStep);
  const prevStep = useChapterStore((s) => s.prevStep);

  const chapter = CHAPTERS.find((c) => c.id === activeChapter);
  const totalSteps = chapter?.totalSteps ?? steps.length;
  const currentText = steps[instructionStep] ?? '';
  const isLastStep = instructionStep === totalSteps - 1;

  return (
    <div className="pointer-events-auto absolute bottom-4 right-4 z-10 max-w-md rounded-md border border-border bg-surface/95 p-4 shadow-lg backdrop-blur-sm">
      {/* 承上启下 card on the final step */}
      {isLastStep && <TransitionPanel currentId={activeChapter} />}

      {/* Step indicator */}
      <div className="mb-2 flex items-center gap-2">
        <span className="text-xs font-medium text-text-muted">
          步骤 {instructionStep + 1} / {totalSteps}
        </span>
        {/* Step dots */}
        <div className="flex gap-1">
          {Array.from({ length: totalSteps }, (_, i) => (
            <div
              key={i}
              className={cn(
                'h-1.5 w-1.5 rounded-full transition-colors duration-75',
                i === instructionStep ? 'bg-primary' : i < instructionStep ? 'bg-primary/40' : 'bg-border',
              )}
            />
          ))}
        </div>
      </div>

      {/* Instruction text */}
      <p className="mb-3 text-sm leading-relaxed text-text">{currentText}</p>

      {/* Navigation buttons */}
      <div className="flex justify-between">
        <button
          onClick={prevStep}
          disabled={instructionStep === 0}
          className={cn(
            'rounded-md px-3 py-1.5 text-xs font-medium transition-colors duration-75',
            instructionStep === 0
              ? 'cursor-not-allowed text-text-muted'
              : 'text-primary hover:bg-primary/10',
          )}
        >
          &larr; 上一步
        </button>
        <button
          onClick={nextStep}
          disabled={instructionStep >= totalSteps - 1}
          className={cn(
            'rounded-md px-3 py-1.5 text-xs font-medium transition-colors duration-75',
            instructionStep >= totalSteps - 1
              ? 'cursor-not-allowed text-text-muted'
              : 'bg-primary text-white hover:bg-primary/90',
          )}
        >
          下一步 &rarr;
        </button>
      </div>
    </div>
  );
}
