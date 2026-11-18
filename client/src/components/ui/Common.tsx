import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';

// ---------- Page header ----------
export function PageHeader({
  eyebrow,
  title,
  subtitle,
  action,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && (
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.25em] text-volt">{eyebrow}</p>
        )}
        <h1 className="font-display text-3xl sm:text-4xl font-bold uppercase tracking-tight">{title}</h1>
        {subtitle && <p className="mt-2 max-w-2xl text-text-secondary">{subtitle}</p>}
      </div>
      {action && <div className="flex shrink-0 gap-2">{action}</div>}
    </div>
  );
}

// ---------- Stat card ----------
export function StatCard({
  label,
  value,
  icon,
  hint,
  accent = 'volt',
  delay = 0,
  children,
}: {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  hint?: ReactNode;
  accent?: 'volt' | 'cyan' | 'warning' | 'danger' | 'success';
  delay?: number;
  children?: ReactNode;
}) {
  const accents = {
    volt: 'text-volt bg-volt/10',
    cyan: 'text-cyan bg-cyan/10',
    warning: 'text-warning bg-warning/10',
    danger: 'text-danger bg-danger/10',
    success: 'text-success bg-success/10',
  };
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      className="glass-card relative overflow-hidden p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">{label}</p>
          <p className="mt-2 font-display text-3xl font-bold tabular-nums">{value}</p>
          {hint && <p className="mt-1 text-xs text-text-secondary">{hint}</p>}
        </div>
        {icon && (
          <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', accents[accent])}>
            {icon}
          </div>
        )}
      </div>
      {children}
    </motion.div>
  );
}

// ---------- Empty state ----------
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-2xl border border-dashed border-border-hover px-6 py-14 text-center',
        className,
      )}
    >
      {icon && (
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5 text-text-muted [&>svg]:h-7 [&>svg]:w-7">
          {icon}
        </div>
      )}
      <h3 className="font-display text-lg font-semibold uppercase tracking-wide">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-text-secondary">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

// ---------- Tabs ----------
export interface TabItem<T extends string> {
  value: T;
  label: string;
  count?: number;
  icon?: ReactNode;
}

export function Tabs<T extends string>({
  items,
  value,
  onChange,
  layoutId = 'tabs-pill',
  className,
}: {
  items: TabItem<T>[];
  value: T;
  onChange: (v: T) => void;
  layoutId?: string;
  className?: string;
}) {
  return (
    <div className={cn('inline-flex rounded-xl border border-border bg-obsidian-light p-1', className)}>
      {items.map((it) => {
        const active = it.value === value;
        return (
          <button
            key={it.value}
            type="button"
            onClick={() => onChange(it.value)}
            className={cn(
              'relative flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors cursor-pointer',
              active ? 'text-obsidian' : 'text-text-secondary hover:text-text-primary',
            )}
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                className="absolute inset-0 rounded-lg bg-volt"
                transition={{ type: 'spring', damping: 28, stiffness: 380 }}
              />
            )}
            <span className="relative z-10 flex items-center gap-2 [&>svg]:h-4 [&>svg]:w-4">
              {it.icon}
              {it.label}
              {it.count !== undefined && (
                <span
                  className={cn(
                    'rounded-full px-1.5 text-[10px] font-bold tabular-nums',
                    active ? 'bg-obsidian/15 text-obsidian' : 'bg-white/10 text-text-secondary',
                  )}
                >
                  {it.count}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ---------- Intensity flames ----------
export function IntensityMeter({ level, className }: { level: 1 | 2 | 3; className?: string }) {
  return (
    <span className={cn('inline-flex items-end gap-0.5', className)} aria-label={`Intensity ${level} of 3`}>
      {[1, 2, 3].map((i) => (
        <span
          key={i}
          className={cn(
            'w-1.5 rounded-sm transition-colors',
            i === 1 ? 'h-2' : i === 2 ? 'h-3' : 'h-4',
            i <= level ? 'bg-current' : 'bg-white/10',
          )}
        />
      ))}
    </span>
  );
}

// ---------- Avatar ----------
export function Avatar({
  initials,
  size = 'md',
  className,
}: {
  initials: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}) {
  const sizes = { sm: 'h-8 w-8 text-xs', md: 'h-10 w-10 text-sm', lg: 'h-14 w-14 text-lg', xl: 'h-20 w-20 text-2xl' };
  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full bg-linear-to-br from-volt to-cyan font-display font-bold text-obsidian',
        sizes[size],
        className,
      )}
    >
      {initials}
    </div>
  );
}
