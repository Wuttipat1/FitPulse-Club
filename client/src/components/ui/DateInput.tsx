import { useEffect, useId, useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn, formatDisplayDate, parseDate, parseDisplayDate, toISODate, todayISO } from '../../lib/utils';
import { fieldBase } from './Input';

export interface DateInputProps {
  label?: string;
  /** ISO "YYYY-MM-DD", or '' when empty / not yet valid */
  value: string;
  /** Called with ISO "YYYY-MM-DD" once the text is a valid date, '' otherwise */
  onChange: (iso: string) => void;
  /** Earliest / latest allowed date, ISO */
  min?: string;
  max?: string;
  error?: string;
  hint?: string;
  disabled?: boolean;
  containerClassName?: string;
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

/** Keep digits only and re-insert the dashes: "20261118" → "2026-11-18". */
function mask(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 4) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}`;
}

/**
 * Date field in YYYY-MM-DD format (ISO 8601, same as the database).
 * Type the date (dashes are added for you) or pick it from the calendar.
 * The value passed in and out is ISO "YYYY-MM-DD".
 */
export function DateInput({
  label,
  value,
  onChange,
  min,
  max,
  error,
  hint = 'YYYY-MM-DD',
  disabled,
  containerClassName,
}: DateInputProps) {
  const id = useId();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [text, setText] = useState(() => (value ? formatDisplayDate(value) : ''));
  const [touched, setTouched] = useState(false);
  const [open, setOpen] = useState(false);

  // Follow changes made from outside (e.g. "Discard changes", form reset)
  useEffect(() => {
    const current = parseDisplayDate(text);
    if (value && value !== current) setText(formatDisplayDate(value));
    if (!value && current) setText('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  // Close the calendar on outside click
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const iso = parseDisplayDate(text);
  let localError = '';
  if (text.length === 10 && !iso) {
    const yearPart = Number(text.slice(0, 4));
    localError =
      yearPart >= 2400 && yearPart <= 2700
        ? `Use the Western year: ${yearPart} → ${yearPart - 543}`
        : 'Not a real date — use YYYY-MM-DD';
  } else if (touched && !open && text.length > 0 && text.length < 10) {
    localError = 'Complete the date as YYYY-MM-DD';
  } else if (iso && min && iso < min) {
    localError = `Must be on or after ${formatDisplayDate(min)}`;
  } else if (iso && max && iso > max) {
    localError = `Must be on or before ${formatDisplayDate(max)}`;
  }
  const shownError = localError || error;

  const handleText = (e: ChangeEvent<HTMLInputElement>) => {
    let next = mask(e.target.value);
    // Backspacing over a dash should also remove the digit before it
    if (next.length < text.length && text.endsWith('-') && next === text.slice(0, -1)) {
      next = mask(next.slice(0, -1));
    }
    setText(next);
    const parsed = parseDisplayDate(next);
    const inRange = parsed && (!min || parsed >= min) && (!max || parsed <= max);
    onChange(inRange ? parsed : '');
  };

  const pick = (picked: string) => {
    setText(formatDisplayDate(picked));
    setTouched(true);
    onChange(picked);
    setOpen(false);
  };

  const clear = () => {
    setText('');
    onChange('');
    setOpen(false);
  };

  return (
    <div className={cn('flex flex-col gap-1.5', containerClassName)}>
      {label && (
        <label htmlFor={id} className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
          {label}
        </label>
      )}
      <div className="relative" ref={wrapperRef}>
        <input
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder="YYYY-MM-DD"
          maxLength={10}
          value={text}
          onChange={handleText}
          onBlur={() => setTouched(true)}
          onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
          disabled={disabled}
          aria-invalid={!!shownError}
          className={cn(
            fieldBase,
            'pr-11 tabular-nums tracking-wide',
            shownError && 'border-danger/60 focus:border-danger focus:ring-danger/15',
          )}
        />
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          disabled={disabled}
          className={cn(
            'absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 transition-colors disabled:opacity-40 cursor-pointer',
            open ? 'bg-volt/10 text-volt' : 'text-text-muted hover:bg-white/5 hover:text-volt',
          )}
          aria-label="Open calendar"
          aria-expanded={open}
          aria-haspopup="dialog"
        >
          <CalendarDays className="h-4 w-4" />
        </button>

        <AnimatePresence>
          {open && (
            <CalendarPopover
              selected={iso}
              min={min}
              max={max}
              onPick={pick}
              onClear={clear}
              onClose={() => setOpen(false)}
            />
          )}
        </AnimatePresence>
      </div>
      {shownError ? (
        <p className="text-xs text-danger">{shownError}</p>
      ) : hint ? (
        <p className="text-xs text-text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Calendar popover — month grid
// ---------------------------------------------------------------------------

interface CalendarPopoverProps {
  selected: string | null;
  min?: string;
  max?: string;
  onPick: (iso: string) => void;
  onClear: () => void;
  onClose: () => void;
}

function CalendarPopover({ selected, min, max, onPick, onClear, onClose }: CalendarPopoverProps) {
  const today = todayISO();
  const todayInRange = (!min || today >= min) && (!max || today <= max);

  // Start on the selected date, else today, else the nearest allowed date
  const start = parseDate(selected ?? (todayInRange ? today : max && today > max ? max : min ?? today));
  const [view, setView] = useState({ y: start.getFullYear(), m: start.getMonth() });

  // Typing a full date while the calendar is open jumps the calendar to it
  useEffect(() => {
    if (!selected) return;
    const d = parseDate(selected);
    setView({ y: d.getFullYear(), m: d.getMonth() });
  }, [selected]);

  const minD = min ? parseDate(min) : null;
  const maxD = max ? parseDate(max) : null;
  const firstYear = minD ? minD.getFullYear() : new Date().getFullYear() - 100;
  const lastYear = maxD ? maxD.getFullYear() : new Date().getFullYear() + 5;
  const years = useMemo(() => {
    const ys: number[] = [];
    for (let y = lastYear; y >= firstYear; y--) ys.push(y); // newest first
    return ys;
  }, [firstYear, lastYear]);

  const monthIndex = view.y * 12 + view.m;
  const canPrev = !minD || monthIndex > minD.getFullYear() * 12 + minD.getMonth();
  const canNext = !maxD || monthIndex < maxD.getFullYear() * 12 + maxD.getMonth();
  const shift = (delta: number) => {
    const n = monthIndex + delta;
    setView({ y: Math.floor(n / 12), m: ((n % 12) + 12) % 12 });
  };

  // 6 weeks × 7 days, starting on the Sunday on/before the 1st
  const cells = useMemo(() => {
    const offset = new Date(view.y, view.m, 1).getDay();
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(view.y, view.m, 1 - offset + i);
      const iso = toISODate(d);
      return {
        iso,
        day: d.getDate(),
        inMonth: d.getMonth() === view.m,
        disabled: (!!min && iso < min) || (!!max && iso > max),
      };
    });
  }, [view, min, max]);

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onClose();
    }
  };

  const selectCls =
    'appearance-none rounded-lg border border-border bg-obsidian-light py-1 pl-2.5 pr-7 text-sm font-semibold text-text-primary outline-none hover:border-border-hover focus:border-volt/60 cursor-pointer [color-scheme:dark]';

  return (
    <motion.div
      role="dialog"
      aria-label="Choose date"
      onKeyDown={onKey}
      initial={{ opacity: 0, y: -6, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -6, scale: 0.98 }}
      transition={{ duration: 0.15 }}
      className="absolute left-0 top-full z-50 mt-2 w-[19rem] rounded-2xl border border-border-hover bg-surface p-3 shadow-2xl shadow-black/60"
    >
      {/* Header: ‹  [Month ▾] [Year (BE) ▾]  › */}
      <div className="mb-2 flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => shift(-1)}
          disabled={!canPrev}
          className="rounded-lg p-1.5 text-text-secondary hover:bg-white/5 hover:text-text-primary disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
          aria-label="Previous month"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="flex flex-1 justify-center gap-1.5">
          <div className="relative">
            <select
              aria-label="Month"
              value={view.m}
              onChange={(e) => setView((v) => ({ ...v, m: Number(e.target.value) }))}
              className={selectCls}
            >
              {MONTHS.map((name, i) => (
                <option key={name} value={i} className="bg-surface">
                  {name}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" />
          </div>
          <div className="relative">
            <select
              aria-label="Year"
              value={view.y}
              onChange={(e) => setView((v) => ({ ...v, y: Number(e.target.value) }))}
              className={cn(selectCls, 'tabular-nums')}
            >
              {years.map((y) => (
                <option key={y} value={y} className="bg-surface">
                  {y}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" />
          </div>
        </div>
        <button
          type="button"
          onClick={() => shift(1)}
          disabled={!canNext}
          className="rounded-lg p-1.5 text-text-secondary hover:bg-white/5 hover:text-text-primary disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
          aria-label="Next month"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Weekday labels */}
      <div className="grid grid-cols-7 text-center text-[11px] font-semibold uppercase tracking-wider text-text-muted">
        {WEEKDAYS.map((w) => (
          <div key={w} className="py-1.5">
            {w}
          </div>
        ))}
      </div>

      {/* Days */}
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((c) => {
          const isSelected = c.iso === selected;
          const isToday = c.iso === today;
          return (
            <button
              key={c.iso}
              type="button"
              disabled={c.disabled}
              onClick={() => onPick(c.iso)}
              aria-label={c.iso}
              aria-pressed={isSelected}
              className={cn(
                'h-9 rounded-lg text-sm tabular-nums transition-colors cursor-pointer',
                'disabled:cursor-not-allowed disabled:opacity-25 disabled:hover:bg-transparent',
                isSelected
                  ? 'bg-volt font-bold text-obsidian'
                  : isToday
                    ? 'border border-volt/50 font-semibold text-volt hover:bg-volt/10'
                    : c.inMonth
                      ? 'text-text-primary hover:bg-white/5'
                      : 'text-text-muted/60 hover:bg-white/5',
              )}
            >
              {c.day}
            </button>
          );
        })}
      </div>

      {/* Footer */}
      <div className="mt-2 flex items-center justify-between border-t border-border pt-2 text-sm">
        <button type="button" onClick={onClear} className="rounded-lg px-2 py-1 font-semibold text-text-secondary hover:bg-white/5 hover:text-text-primary cursor-pointer">
          Clear
        </button>
        <span className="text-xs tabular-nums text-text-muted">{selected ?? 'YYYY-MM-DD'}</span>
        <button
          type="button"
          onClick={() => todayInRange && onPick(today)}
          disabled={!todayInRange}
          className="rounded-lg px-2 py-1 font-semibold text-volt hover:bg-volt/10 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
        >
          Today
        </button>
      </div>
    </motion.div>
  );
}
