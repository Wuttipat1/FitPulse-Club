import { motion } from 'framer-motion';
import { Users } from 'lucide-react';
import { cn, getCapacityInfo } from '../../lib/utils';

export interface CapacityBarProps {
  current: number;
  max: number;
  showLabel?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

const barColor = {
  cyan: 'bg-cyan',
  volt: 'bg-volt',
  warning: 'bg-warning',
  danger: 'bg-danger',
  success: 'bg-success',
  neutral: 'bg-text-muted',
};

const textColor = {
  cyan: 'text-cyan',
  volt: 'text-volt',
  warning: 'text-warning',
  danger: 'text-danger',
  success: 'text-success',
  neutral: 'text-text-muted',
};

/**
 * Visual capacity meter. Pulses + glows when nearly full (≥80%),
 * turns red with a FULL label at capacity.
 */
export function CapacityBar({ current, max, showLabel = true, size = 'md', className }: CapacityBarProps) {
  const { ratio, spotsLeft, isFull, nearlyFull, tone } = getCapacityInfo(current, max);

  return (
    <div className={cn('w-full', className)}>
      {showLabel && (
        <div className="mb-1.5 flex items-center justify-between text-xs">
          <span className="flex items-center gap-1.5 text-text-secondary">
            <Users className="h-3.5 w-3.5" />
            <span className="tabular-nums font-medium text-text-primary">{current}</span>
            <span className="text-text-muted">/ {max}</span>
          </span>
          <span className={cn('font-semibold uppercase tracking-wider', textColor[tone], nearlyFull && 'pulse-ring')}>
            {isFull ? 'Full' : nearlyFull ? `${spotsLeft} left!` : `${spotsLeft} spots`}
          </span>
        </div>
      )}
      <div
        className={cn(
          'relative w-full overflow-hidden rounded-full bg-white/5',
          size === 'sm' ? 'h-1.5' : 'h-2',
        )}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={current}
      >
        <motion.div
          className={cn(
            'absolute inset-y-0 left-0 rounded-full',
            barColor[tone],
            (nearlyFull || isFull) && 'shadow-[0_0_12px_currentColor]',
            nearlyFull && 'pulse-ring',
            textColor[tone],
          )}
          initial={{ width: 0 }}
          animate={{ width: `${Math.max(ratio * 100, current > 0 ? 4 : 0)}%` }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>
    </div>
  );
}
