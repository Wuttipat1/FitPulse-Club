import { AnimatePresence, motion } from 'framer-motion';
import { CircleAlert, CircleCheck, Info, TriangleAlert, X } from 'lucide-react';
import { useToastStore } from '../../stores/toastStore';
import { cn } from '../../lib/utils';
import type { ToastType } from '../../types';

const styles: Record<ToastType, { icon: typeof Info; accent: string; bar: string }> = {
  success: { icon: CircleCheck, accent: 'text-volt', bar: 'bg-volt' },
  error: { icon: CircleAlert, accent: 'text-danger', bar: 'bg-danger' },
  warning: { icon: TriangleAlert, accent: 'text-warning', bar: 'bg-warning' },
  info: { icon: Info, accent: 'text-cyan', bar: 'bg-cyan' },
};

/** Mount once near the app root. */
export function ToastViewport() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 left-4 sm:left-auto z-[80] flex flex-col items-end gap-3">
      <AnimatePresence initial={false}>
        {toasts.map((t) => {
          const s = styles[t.type];
          const Icon = s.icon;
          return (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, x: 60, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 60, scale: 0.95, transition: { duration: 0.18 } }}
              transition={{ type: 'spring', damping: 24, stiffness: 300 }}
              className="pointer-events-auto relative w-full sm:w-96 overflow-hidden rounded-2xl border border-border-hover bg-surface/95 backdrop-blur-xl shadow-2xl shadow-black/50"
              role="status"
            >
              <div className="flex items-start gap-3 p-4 pr-10">
                <Icon className={cn('mt-0.5 h-5 w-5 shrink-0', s.accent)} />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-text-primary">{t.title}</p>
                  {t.message && <p className="mt-0.5 text-sm text-text-secondary">{t.message}</p>}
                </div>
              </div>
              <button
                onClick={() => dismiss(t.id)}
                className="absolute right-3 top-3 rounded-md p-1 text-text-muted hover:text-text-primary hover:bg-white/5 cursor-pointer"
                aria-label="Dismiss"
              >
                <X className="h-4 w-4" />
              </button>
              {t.duration > 0 && (
                <motion.div
                  className={cn('absolute bottom-0 left-0 h-0.5', s.bar)}
                  initial={{ width: '100%' }}
                  animate={{ width: '0%' }}
                  transition={{ duration: t.duration / 1000, ease: 'linear' }}
                />
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
