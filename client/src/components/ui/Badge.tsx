import type { ReactNode } from 'react';
import { cn, getStatusLabel, getStatusTone, toneClasses, type Tone } from '../../lib/utils';

export interface BadgeProps {
  children?: ReactNode;
  tone?: Tone;
  /** Shortcut: derive tone + label from a status string */
  status?: string;
  dot?: boolean;
  pulse?: boolean;
  icon?: ReactNode;
  size?: 'sm' | 'md';
  className?: string;
}

const dotColor: Record<Tone, string> = {
  volt: 'bg-volt',
  cyan: 'bg-cyan',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  neutral: 'bg-text-muted',
};

export function Badge({ children, tone, status, dot, pulse, icon, size = 'sm', className }: BadgeProps) {
  const t: Tone = tone ?? (status ? getStatusTone(status) : 'neutral');
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border font-semibold uppercase tracking-wider whitespace-nowrap',
        size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-3 py-1 text-xs',
        toneClasses[t],
        className,
      )}
    >
      {dot && (
        <span className="relative flex h-1.5 w-1.5">
          {pulse && (
            <span className={cn('absolute inline-flex h-full w-full animate-ping rounded-full opacity-75', dotColor[t])} />
          )}
          <span className={cn('relative inline-flex h-1.5 w-1.5 rounded-full', dotColor[t])} />
        </span>
      )}
      {icon}
      {children ?? (status ? getStatusLabel(status) : null)}
    </span>
  );
}
