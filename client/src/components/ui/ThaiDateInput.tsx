import { useEffect, useId, useRef, useState, type ChangeEvent } from 'react';
import { CalendarDays } from 'lucide-react';
import { cn, formatThaiDate, parseThaiDate } from '../../lib/utils';
import { fieldBase } from './Input';

export interface ThaiDateInputProps {
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

/** Keep digits only and re-insert the slashes: "18112569" → "18/11/2569". */
function mask(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

/**
 * Date field in Thai format DD/MM/BBBB (Buddhist Era year).
 * Type the date, or use the calendar button to pick one. The value passed
 * in and out is always ISO, so the API keeps receiving YYYY-MM-DD.
 */
export function ThaiDateInput({
  label,
  value,
  onChange,
  min,
  max,
  error,
  hint = 'DD/MM/BBBB — Buddhist year (พ.ศ.)',
  disabled,
  containerClassName,
}: ThaiDateInputProps) {
  const id = useId();
  const pickerRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState(() => (value ? formatThaiDate(value) : ''));
  const [touched, setTouched] = useState(false);

  // Follow changes made from outside (e.g. "Discard changes", calendar pick, form reset)
  useEffect(() => {
    const current = parseThaiDate(text);
    if (value && value !== current) setText(formatThaiDate(value));
    if (!value && current) setText('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const iso = parseThaiDate(text);
  let localError = '';
  if (text.length === 10 && !iso) {
    const yearPart = Number(text.slice(6));
    localError =
      yearPart > 0 && yearPart < 2400
        ? `Use the Buddhist year: ${yearPart} → ${yearPart + 543}`
        : 'Not a real date — use DD/MM/BBBB';
  } else if (touched && text.length > 0 && text.length < 10) {
    localError = 'Complete the date as DD/MM/BBBB';
  } else if (iso && min && iso < min) {
    localError = `Must be on or after ${formatThaiDate(min)}`;
  } else if (iso && max && iso > max) {
    localError = `Must be on or before ${formatThaiDate(max)}`;
  }
  const shownError = localError || error;

  const handleText = (e: ChangeEvent<HTMLInputElement>) => {
    let next = mask(e.target.value);
    // Backspacing over a slash should also remove the digit before it
    if (next.length < text.length && text.endsWith('/') && next === text.slice(0, -1)) {
      next = mask(next.slice(0, -1));
    }
    setText(next);
    const parsed = parseThaiDate(next);
    const inRange = parsed && (!min || parsed >= min) && (!max || parsed <= max);
    onChange(inRange ? parsed : '');
  };

  const openPicker = () => {
    const el = pickerRef.current;
    if (!el) return;
    try {
      el.showPicker();
    } catch {
      el.focus();
      el.click();
    }
  };

  const handlePicked = (e: ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.value; // ISO from the native picker
    if (!picked) return;
    setText(formatThaiDate(picked));
    setTouched(true);
    onChange(picked);
  };

  return (
    <div className={cn('flex flex-col gap-1.5', containerClassName)}>
      {label && (
        <label htmlFor={id} className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
          {label}
        </label>
      )}
      <div className="relative">
        <input
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder="DD/MM/BBBB"
          maxLength={10}
          value={text}
          onChange={handleText}
          onBlur={() => setTouched(true)}
          disabled={disabled}
          aria-invalid={!!shownError}
          className={cn(fieldBase, 'pr-11 tabular-nums tracking-wide', shownError && 'border-danger/60 focus:border-danger focus:ring-danger/15')}
        />
        <button
          type="button"
          onClick={openPicker}
          disabled={disabled}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-text-muted hover:bg-white/5 hover:text-volt disabled:opacity-40 cursor-pointer"
          aria-label="Open calendar"
        >
          <CalendarDays className="h-4 w-4" />
        </button>
        {/* Native picker, hidden: only used for its calendar popup */}
        <input
          ref={pickerRef}
          type="date"
          tabIndex={-1}
          aria-hidden="true"
          value={iso ?? ''}
          min={min}
          max={max}
          onChange={handlePicked}
          className="pointer-events-none absolute bottom-0 right-0 h-0 w-0 opacity-0 [color-scheme:dark]"
        />
      </div>
      {shownError ? (
        <p className="text-xs text-danger">{shownError}</p>
      ) : hint ? (
        <p className="text-xs text-text-muted">{hint}</p>
      ) : null}
    </div>
  );
}
