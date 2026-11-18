import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '../../lib/utils';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  hover?: boolean;
  glow?: 'volt' | 'cyan' | false;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const paddings = { none: '', sm: 'p-4', md: 'p-5 sm:p-6', lg: 'p-6 sm:p-8' };

export function Card({ hover, glow, padding = 'md', className, children, ...rest }: CardProps) {
  return (
    <div
      className={cn(
        hover ? 'glass-card-hover' : 'glass-card',
        glow === 'volt' && 'glow-volt-subtle border-volt/20',
        glow === 'cyan' && 'border-cyan/20 shadow-[0_0_10px_rgba(0,240,255,0.12)]',
        paddings[padding],
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

interface CardHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function CardHeader({ title, subtitle, icon, action, className }: CardHeaderProps) {
  return (
    <div className={cn('mb-4 flex items-start justify-between gap-3', className)}>
      <div className="flex items-center gap-3 min-w-0">
        {icon && (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-volt/10 text-volt">
            {icon}
          </div>
        )}
        <div className="min-w-0">
          <h3 className="font-display text-lg font-semibold uppercase tracking-wide truncate">{title}</h3>
          {subtitle && <p className="text-sm text-text-secondary">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}
