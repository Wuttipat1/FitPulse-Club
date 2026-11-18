import type { BookingStatus, ClassLevel, MemberStatus, Role, ScheduleStatus } from '../types';

// ============================================================
// Class names
// ============================================================

type ClassValue = string | number | bigint | boolean | null | undefined | ClassValue[] | Record<string, unknown>;

/** Tiny clsx-style helper: cn('a', cond && 'b', { c: true }) */
export function cn(...inputs: ClassValue[]): string {
  const out: string[] = [];
  const walk = (v: ClassValue) => {
    if (!v) return;
    if (typeof v === 'string' || typeof v === 'number') out.push(String(v));
    else if (Array.isArray(v)) v.forEach(walk);
    else if (typeof v === 'object')
      Object.entries(v).forEach(([k, on]) => {
        if (on) out.push(k);
      });
  };
  inputs.forEach(walk);
  return out.join(' ');
}

// ============================================================
// Dates & times — all class dates are local "YYYY-MM-DD" + "HH:MM"
// ============================================================

const pad = (n: number) => String(n).padStart(2, '0');

/** Local date → "YYYY-MM-DD" */
export function toISODate(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayISO(): string {
  return toISODate(new Date());
}

export function addDaysISO(days: number, from: Date = new Date()): string {
  const d = new Date(from);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

/** Parse "YYYY-MM-DD" as a *local* date (avoids the UTC shift of new Date(str)). */
export function parseDate(date: string): Date {
  const [y, m, d] = date.split('T')[0].split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

/** Combine class date + "HH:MM" into a local Date. */
export function parseClassDateTime(date: string, time: string): Date {
  const d = parseDate(date);
  const [h, min] = time.split(':').map(Number);
  d.setHours(h || 0, min || 0, 0, 0);
  return d;
}

// ---------- Thai date format: DD/MM/BBBB (Buddhist Era year = CE + 543) ----------

export const BE_OFFSET = 543;

/** "2026-11-18" → "18/11/2569". Empty / invalid input → "—". */
export function formatThaiDate(date: string | Date | null | undefined): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? parseDate(date) : date;
  if (Number.isNaN(d.getTime())) return '—';
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear() + BE_OFFSET}`;
}

/**
 * "18/11/2569" → "2026-11-18". Returns null unless the text is a complete,
 * real calendar date with a Buddhist-Era year.
 */
export function parseThaiDate(text: string): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text.trim());
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]);
  const yearBE = Number(m[3]);
  if (yearBE < 2400 || yearBE > 2700) return null;
  const yearCE = yearBE - BE_OFFSET;
  const d = new Date(yearCE, month - 1, day);
  if (d.getFullYear() !== yearCE || d.getMonth() !== month - 1 || d.getDate() !== day) return null;
  return toISODate(d);
}

/** All dates in the app display as DD/MM/BBBB. */
export function formatDate(date: string | Date): string {
  return formatThaiDate(date);
}

export function formatLongDate(date: string | Date): string {
  return formatThaiDate(date);
}

/** "Today" / "Tomorrow" / "Wednesday" — a day name to sit next to a DD/MM/BBBB date. */
export function formatWeekday(date: string): string {
  if (date === todayISO()) return 'Today';
  if (date === addDaysISO(1)) return 'Tomorrow';
  if (date === addDaysISO(-1)) return 'Yesterday';
  return parseDate(date).toLocaleDateString('en-US', { weekday: 'long' });
}

/** "07:00" → "7:00 AM" */
export function formatTime(time: string): string {
  const [hStr, mStr = '00'] = time.split(':');
  const h = Number(hStr);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${mStr.slice(0, 2)} ${suffix}`;
}

export function formatTimeRange(start: string, end: string): string {
  return `${formatTime(start)} – ${formatTime(end)}`;
}

/** Duration in minutes between two "HH:MM" strings. */
export function durationMinutes(start: string, end: string): number {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  return eh * 60 + em - (sh * 60 + sm);
}

/** "Today" / "Tomorrow" / "20/11/2569" */
export function formatRelativeDay(date: string): string {
  if (date === todayISO()) return 'Today';
  if (date === addDaysISO(1)) return 'Tomorrow';
  if (date === addDaysISO(-1)) return 'Yesterday';
  return formatDate(date);
}

/** Timestamp from SQLite ("YYYY-MM-DD HH:MM:SS", UTC) → "5m ago" */
export function timeAgo(timestamp: string): string {
  const iso = timestamp.includes('T') ? timestamp : `${timestamp.replace(' ', 'T')}Z`;
  const diff = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(diff)) return '';
  const s = Math.floor(diff / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export function isPastClass(date: string, startTime: string): boolean {
  return parseClassDateTime(date, startTime).getTime() < Date.now();
}

export function daysUntil(date: string | null): number | null {
  if (!date) return null;
  const today = parseDate(todayISO());
  return Math.round((parseDate(date).getTime() - today.getTime()) / 86_400_000);
}

export interface Countdown {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  totalMs: number;
}

export function getCountdown(target: Date, now: number = Date.now()): Countdown {
  const totalMs = Math.max(0, target.getTime() - now);
  const totalSec = Math.floor(totalMs / 1000);
  return {
    days: Math.floor(totalSec / 86400),
    hours: Math.floor((totalSec % 86400) / 3600),
    minutes: Math.floor((totalSec % 3600) / 60),
    seconds: totalSec % 60,
    totalMs,
  };
}

/** Monday-based week key, e.g. "2026-11-16" for any day that week. */
export function weekKey(date: string | Date): string {
  const d = typeof date === 'string' ? parseDate(date) : new Date(date);
  const day = (d.getDay() + 6) % 7; // Mon=0
  d.setDate(d.getDate() - day);
  return toISODate(d);
}

/**
 * Weekly streak: number of consecutive weeks (ending this week, or last week if
 * nothing yet this week) with at least one attended class.
 */
export function computeWeeklyStreak(attendedDates: string[]): number {
  if (attendedDates.length === 0) return 0;
  const weeks = new Set(attendedDates.map((d) => weekKey(d)));
  const cursor = parseDate(weekKey(new Date()));
  if (!weeks.has(toISODate(cursor))) cursor.setDate(cursor.getDate() - 7);
  let streak = 0;
  while (weeks.has(toISODate(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 7);
  }
  return streak;
}

// ============================================================
// Formatting
// ============================================================

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function getInitials(first?: string | null, last?: string | null): string {
  return `${(first || '').charAt(0)}${(last || '').charAt(0)}`.toUpperCase() || '?';
}

export function fullName(first?: string | null, last?: string | null): string {
  return [first, last].filter(Boolean).join(' ');
}

export function pluralize(n: number, word: string, plural = `${word}s`): string {
  return `${n} ${n === 1 ? word : plural}`;
}

// ============================================================
// Status / intensity palettes
// ============================================================

export type Tone = 'volt' | 'cyan' | 'success' | 'warning' | 'danger' | 'neutral';

export const toneClasses: Record<Tone, string> = {
  volt: 'bg-volt/10 text-volt border-volt/30',
  cyan: 'bg-cyan/10 text-cyan border-cyan/30',
  success: 'bg-success/10 text-success border-success/30',
  warning: 'bg-warning/10 text-warning border-warning/30',
  danger: 'bg-danger/10 text-danger border-danger/30',
  neutral: 'bg-white/5 text-text-secondary border-white/10',
};

const statusTone: Record<string, Tone> = {
  // booking
  Booked: 'volt',
  Waitlist: 'warning',
  Attended: 'success',
  NoShow: 'danger',
  Cancelled: 'neutral',
  // schedule
  Open: 'cyan',
  Full: 'danger',
  // member / account
  Active: 'success',
  Expired: 'danger',
  Inactive: 'neutral',
  Pending: 'warning',
};

export function getStatusTone(status: BookingStatus | ScheduleStatus | MemberStatus | string): Tone {
  return statusTone[status] ?? 'neutral';
}

/** Tailwind classes for a status pill. */
export function getStatusColor(status: BookingStatus | ScheduleStatus | MemberStatus | string): string {
  return toneClasses[getStatusTone(status)];
}

export function getStatusLabel(status: BookingStatus | string): string {
  return status === 'NoShow' ? 'No-show' : status;
}

export interface IntensityInfo {
  label: string;
  /** 1–3 flames */
  intensity: 1 | 2 | 3;
  tone: Tone;
  textClass: string;
  /** Gradient for card headers */
  gradient: string;
  description: string;
}

export function getIntensityInfo(level: ClassLevel | string): IntensityInfo {
  switch (level) {
    case 'Advanced':
      return {
        label: 'Advanced',
        intensity: 3,
        tone: 'danger',
        textClass: 'text-danger',
        gradient: 'from-danger/30 via-warning/10 to-transparent',
        description: 'Max effort. Bring your A-game.',
      };
    case 'Intermediate':
      return {
        label: 'Intermediate',
        intensity: 2,
        tone: 'volt',
        textClass: 'text-volt',
        gradient: 'from-volt/25 via-volt/5 to-transparent',
        description: 'Steady burn. Push your limits.',
      };
    default:
      return {
        label: 'Beginner',
        intensity: 1,
        tone: 'cyan',
        textClass: 'text-cyan',
        gradient: 'from-cyan/25 via-cyan/5 to-transparent',
        description: 'Build the foundation.',
      };
  }
}

/** Capacity ratio → tone + flags used by CapacityBar & cards. */
export function getCapacityInfo(current: number, max: number) {
  const ratio = max > 0 ? Math.min(current / max, 1) : 0;
  const spotsLeft = Math.max(max - current, 0);
  const isFull = current >= max;
  const nearlyFull = !isFull && ratio >= 0.8;
  const tone: Tone = isFull ? 'danger' : nearlyFull ? 'warning' : ratio >= 0.5 ? 'volt' : 'cyan';
  return { ratio, spotsLeft, isFull, nearlyFull, tone };
}

// ============================================================
// Roles
// ============================================================

export function roleHome(role: Role | undefined | null): string {
  switch (role) {
    case 'Admin':
      return '/admin';
    case 'Trainer':
      return '/trainer';
    case 'Member':
      return '/member';
    default:
      return '/login';
  }
}

export const PHONE_REGEX = /^[0-9+()\-\s]{6,20}$/;
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
