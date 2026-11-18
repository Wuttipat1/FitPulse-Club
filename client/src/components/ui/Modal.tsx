import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  /** Prevent closing via backdrop / Esc (e.g. while submitting) */
  locked?: boolean;
}

const sizes = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl' };

export function Modal({
  open,
  onClose,
  title,
  description,
  icon,
  children,
  footer,
  size = 'md',
  locked = false,
}: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !locked) onClose();
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, locked, onClose]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <motion.div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => !locked && onClose()}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            className={cn(
              'relative w-full glass-card bg-surface! border-border-hover shadow-2xl shadow-black/60',
              'rounded-b-none sm:rounded-2xl max-h-[92vh] flex flex-col',
              sizes[size],
            )}
            initial={{ opacity: 0, y: 40, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.97 }}
            transition={{ type: 'spring', damping: 26, stiffness: 320 }}
          >
            {(title || icon) && (
              <div className="flex items-start gap-3 px-6 pt-6">
                {icon && (
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-volt/10 text-volt">
                    {icon}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  {title && (
                    <h2 className="font-display text-xl font-semibold uppercase tracking-wide">{title}</h2>
                  )}
                  {description && <p className="mt-1 text-sm text-text-secondary">{description}</p>}
                </div>
                <button
                  onClick={onClose}
                  disabled={locked}
                  className="rounded-lg p-1.5 text-text-muted hover:bg-white/5 hover:text-text-primary transition-colors disabled:opacity-40 cursor-pointer"
                  aria-label="Close"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            )}
            {children && <div className="overflow-y-auto px-6 py-5">{children}</div>}
            {footer && (
              <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 border-t border-border px-6 py-4">
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
