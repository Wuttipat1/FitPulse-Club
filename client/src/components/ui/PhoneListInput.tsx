import { useState, type KeyboardEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Phone, Plus, X } from 'lucide-react';
import { cn, PHONE_REGEX } from '../../lib/utils';
import { fieldBase } from './Input';

export interface PhoneListInputProps {
  value: string[];
  onChange: (phones: string[]) => void;
  label?: string;
  max?: number;
  error?: string;
}

/** Multi-value phone input (member_phone / trainer_phone are multi-valued attributes). */
export function PhoneListInput({ value, onChange, label = 'Phone numbers', max = 5, error }: PhoneListInputProps) {
  const [draft, setDraft] = useState('');
  const [localError, setLocalError] = useState('');

  const add = () => {
    const phone = draft.trim();
    if (!phone) return;
    if (!PHONE_REGEX.test(phone)) return setLocalError('Enter a valid phone number');
    if (value.includes(phone)) return setLocalError('Number already added');
    if (value.length >= max) return setLocalError(`Up to ${max} numbers`);
    onChange([...value, phone]);
    setDraft('');
    setLocalError('');
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      add();
    }
  };

  const shownError = localError || error;

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
        {label} <span className="normal-case tracking-normal text-text-muted">({value.length}/{max})</span>
      </label>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Phone className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
          <input
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              setLocalError('');
            }}
            onKeyDown={onKeyDown}
            placeholder="081-234-5678"
            inputMode="tel"
            className={cn(fieldBase, 'pl-10', shownError && 'border-danger/60')}
          />
        </div>
        <button
          type="button"
          onClick={add}
          disabled={!draft.trim() || value.length >= max}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-volt/40 text-volt hover:bg-volt/10 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
          aria-label="Add phone"
        >
          <Plus className="h-5 w-5" />
        </button>
      </div>
      {shownError && <p className="text-xs text-danger">{shownError}</p>}
      {value.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-2">
          <AnimatePresence initial={false}>
            {value.map((p, i) => (
              <motion.span
                key={p}
                layout
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="inline-flex items-center gap-2 rounded-full border border-cyan/30 bg-cyan/10 py-1 pl-3 pr-1.5 text-xs font-medium text-cyan"
              >
                {i === 0 && <span className="text-[9px] font-bold uppercase tracking-wider text-cyan/70">Primary</span>}
                {p}
                <button
                  type="button"
                  onClick={() => onChange(value.filter((x) => x !== p))}
                  className="rounded-full p-0.5 hover:bg-cyan/20 cursor-pointer"
                  aria-label={`Remove ${p}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </motion.span>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
