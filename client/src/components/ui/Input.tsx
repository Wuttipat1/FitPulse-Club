import { useId, useState, type InputHTMLAttributes, type ReactNode } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  icon?: ReactNode;
  rightSlot?: ReactNode;
  containerClassName?: string;
}

export const fieldBase =
  'w-full h-11 rounded-xl bg-obsidian-light border border-border px-4 text-sm text-text-primary ' +
  'placeholder:text-text-muted transition-all duration-200 outline-none ' +
  'hover:border-border-hover focus:border-volt/60 focus:ring-2 focus:ring-volt/15 ' +
  'disabled:opacity-50 disabled:cursor-not-allowed [color-scheme:dark]';

export function Input({
  label,
  error,
  hint,
  icon,
  rightSlot,
  className,
  containerClassName,
  id,
  type,
  ...rest
}: InputProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const [showPw, setShowPw] = useState(false);
  const isPassword = type === 'password';

  return (
    <div className={cn('flex flex-col gap-1.5', containerClassName)}>
      {label && (
        <label htmlFor={inputId} className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
          {label}
        </label>
      )}
      <div className="relative">
        {icon && (
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted [&>svg]:h-4 [&>svg]:w-4">
            {icon}
          </span>
        )}
        <input
          id={inputId}
          type={isPassword && showPw ? 'text' : type}
          aria-invalid={!!error}
          className={cn(
            fieldBase,
            icon && 'pl-10',
            (isPassword || rightSlot) && 'pr-11',
            error && 'border-danger/60 focus:border-danger focus:ring-danger/15',
            className,
          )}
          {...rest}
        />
        {isPassword ? (
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setShowPw((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary cursor-pointer"
            aria-label={showPw ? 'Hide password' : 'Show password'}
          >
            {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        ) : (
          rightSlot && <span className="absolute right-2 top-1/2 -translate-y-1/2">{rightSlot}</span>
        )}
      </div>
      {error ? (
        <p className="text-xs text-danger">{error}</p>
      ) : hint ? (
        <p className="text-xs text-text-muted">{hint}</p>
      ) : null}
    </div>
  );
}
