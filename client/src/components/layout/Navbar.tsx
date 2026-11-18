import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  CalendarCheck,
  CalendarDays,
  ChevronDown,
  ClipboardList,
  CreditCard,
  Dumbbell,
  LayoutDashboard,
  LogOut,
  Menu,
  User,
  UserCheck,
  X,
  Zap,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { toast } from '../../stores/toastStore';
import { cn, roleHome } from '../../lib/utils';
import type { Role } from '../../types';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
}

const NAV: Record<Role, NavItem[]> = {
  Member: [
    { to: '/member', label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: '/member/classes', label: 'Classes', icon: Dumbbell },
    { to: '/member/bookings', label: 'My Bookings', icon: CalendarCheck },
    { to: '/member/profile', label: 'Profile', icon: User },
  ],
  Trainer: [{ to: '/trainer', label: 'My Classes', icon: ClipboardList, end: true }],
  Admin: [
    { to: '/admin', label: 'Overview', icon: LayoutDashboard, end: true },
    { to: '/admin/trainers', label: 'Trainers', icon: UserCheck },
    { to: '/admin/schedule', label: 'Schedule', icon: CalendarDays },
    { to: '/admin/plans', label: 'Plans', icon: CreditCard },
  ],
};

const roleTone: Record<Role, string> = {
  Admin: 'text-cyan',
  Trainer: 'text-warning',
  Member: 'text-volt',
};

export function Navbar() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMobileOpen(false);
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [menuOpen]);

  if (!user) return null;
  const items = NAV[user.role] ?? [];
  const initials = user.username.slice(0, 2).toUpperCase();

  const handleLogout = () => {
    logout();
    toast.info('Signed out', 'See you at the next session 💪');
    navigate('/login', { replace: true });
  };

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-obsidian/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link to={roleHome(user.role)} className="group flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-volt text-obsidian transition-shadow group-hover:glow-volt">
            <Zap className="h-5 w-5" fill="currentColor" />
          </span>
          <span className="font-display text-xl font-bold tracking-wider">
            FIT<span className="text-volt">PULSE</span>
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1">
          {items.map((it) => (
            <NavLink
              key={it.to}
              to={it.to}
              end={it.end}
              className={({ isActive }) =>
                cn(
                  'relative flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive ? 'text-volt' : 'text-text-secondary hover:text-text-primary',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <it.icon className="h-4 w-4" />
                  {it.label}
                  {isActive && (
                    <motion.span
                      layoutId="nav-underline"
                      className="absolute inset-x-2 -bottom-[13px] h-0.5 rounded-full bg-volt shadow-[0_0_8px_#CCFF00]"
                    />
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {/* Avatar dropdown */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="flex items-center gap-2 rounded-full border border-border py-1 pl-1 pr-3 hover:border-border-hover transition-colors cursor-pointer"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-linear-to-br from-volt to-cyan font-display text-xs font-bold text-obsidian">
                {initials}
              </span>
              <span className="hidden sm:flex flex-col items-start leading-tight">
                <span className="text-sm font-semibold">{user.username}</span>
                <span className={cn('text-[10px] font-bold uppercase tracking-wider', roleTone[user.role])}>
                  {user.role}
                </span>
              </span>
              <ChevronDown className={cn('h-4 w-4 text-text-muted transition-transform', menuOpen && 'rotate-180')} />
            </button>

            <AnimatePresence>
              {menuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -6, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.97 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 mt-2 w-56 overflow-hidden rounded-xl border border-border-hover bg-surface shadow-2xl shadow-black/50"
                  role="menu"
                >
                  <div className="border-b border-border px-4 py-3">
                    <p className="text-sm font-semibold">{user.username}</p>
                    <p className={cn('text-xs font-semibold uppercase tracking-wider', roleTone[user.role])}>
                      {user.role} account
                    </p>
                  </div>
                  <div className="p-1">
                    <Link
                      to={roleHome(user.role)}
                      className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-text-secondary hover:bg-white/5 hover:text-text-primary"
                    >
                      <LayoutDashboard className="h-4 w-4" /> Dashboard
                    </Link>
                    {user.role === 'Member' && (
                      <Link
                        to="/member/profile"
                        className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-text-secondary hover:bg-white/5 hover:text-text-primary"
                      >
                        <User className="h-4 w-4" /> Profile & plan
                      </Link>
                    )}
                    <button
                      onClick={handleLogout}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-danger hover:bg-danger/10 cursor-pointer"
                    >
                      <LogOut className="h-4 w-4" /> Sign out
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Mobile toggle */}
          <button
            className="md:hidden rounded-lg p-2 text-text-secondary hover:bg-white/5 cursor-pointer"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile nav */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.nav
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="md:hidden overflow-hidden border-t border-border"
          >
            <div className="space-y-1 px-4 py-3">
              {items.map((it) => (
                <NavLink
                  key={it.to}
                  to={it.to}
                  end={it.end}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium',
                      isActive ? 'bg-volt/10 text-volt' : 'text-text-secondary hover:bg-white/5',
                    )
                  }
                >
                  <it.icon className="h-4 w-4" />
                  {it.label}
                </NavLink>
              ))}
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}
