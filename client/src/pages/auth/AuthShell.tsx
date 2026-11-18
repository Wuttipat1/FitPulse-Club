import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Activity, CalendarCheck, Flame, Zap } from 'lucide-react';

/** Split-screen frame shared by Login & Register. */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      {/* Brand side */}
      <div className="relative hidden lg:flex flex-col justify-between overflow-hidden border-r border-border p-12">
        <div className="absolute inset-0 -z-10">
          <div className="absolute -left-32 top-10 h-[520px] w-[520px] rounded-full bg-volt/10 blur-3xl" />
          <div className="absolute bottom-0 right-0 h-[420px] w-[420px] rounded-full bg-cyan/10 blur-3xl" />
          <div
            className="absolute inset-0 opacity-[0.07]"
            style={{
              backgroundImage:
                'linear-gradient(rgba(255,255,255,.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.6) 1px, transparent 1px)',
              backgroundSize: '48px 48px',
              maskImage: 'radial-gradient(ellipse at center, black 30%, transparent 75%)',
            }}
          />
        </div>

        <Link to="/" className="flex items-center gap-2">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-volt text-obsidian glow-volt">
            <Zap className="h-6 w-6" fill="currentColor" />
          </span>
          <span className="font-display text-2xl font-bold tracking-wider">
            FIT<span className="text-volt">PULSE</span>
          </span>
        </Link>

        <div>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="font-display text-6xl xl:text-7xl font-bold uppercase leading-[0.95] tracking-tight"
          >
            Train <br />
            <span className="text-gradient-volt">harder.</span>
            <br />
            Book <span className="text-volt">faster.</span>
          </motion.h1>
          <p className="mt-6 max-w-md text-lg text-text-secondary">
            One-tap class booking, live capacity, and a waitlist that promotes you automatically the
            moment a spot opens.
          </p>

          <div className="mt-10 grid max-w-md grid-cols-3 gap-3">
            {[
              { icon: Flame, label: 'Streaks', value: 'Weekly' },
              { icon: CalendarCheck, label: 'Booking', value: '1-tap' },
              { icon: Activity, label: 'Waitlist', value: 'Auto' },
            ].map((f, i) => (
              <motion.div
                key={f.label}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + i * 0.1 }}
                className="glass-card p-4"
              >
                <f.icon className="h-5 w-5 text-volt" />
                <p className="mt-3 font-display text-xl font-bold uppercase">{f.value}</p>
                <p className="text-xs uppercase tracking-wider text-text-muted">{f.label}</p>
              </motion.div>
            ))}
          </div>
        </div>

        <p className="text-xs text-text-muted">© {new Date().getFullYear()} FitPulse Club</p>
      </div>

      {/* Form side */}
      <div className="flex items-center justify-center px-4 py-12 sm:px-8">
        <div className="w-full max-w-md">
          <Link to="/" className="mb-10 flex items-center gap-2 lg:hidden">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-volt text-obsidian">
              <Zap className="h-5 w-5" fill="currentColor" />
            </span>
            <span className="font-display text-xl font-bold tracking-wider">
              FIT<span className="text-volt">PULSE</span>
            </span>
          </Link>
          {children}
        </div>
      </div>
    </div>
  );
}
