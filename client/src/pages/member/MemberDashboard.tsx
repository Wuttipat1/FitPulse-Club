import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  CalendarCheck,
  CalendarClock,
  Clock,
  CreditCard,
  Dumbbell,
  Flame,
  MapPin,
  Sparkles,
  Timer,
  Trophy,
  TriangleAlert,
  User,
} from 'lucide-react';
import { Badge, Button, Card, CardHeader, EmptyState, IntensityMeter, Skeleton, StatCard } from '../../components/ui';
import { api } from '../../lib/api';
import { useFetch, useNow } from '../../lib/hooks';
import {
  cn,
  computeWeeklyStreak,
  daysUntil,
  formatRelativeDay,
  formatThaiDate,
  formatTimeRange,
  getCountdown,
  getIntensityInfo,
  parseClassDateTime,
  todayISO,
} from '../../lib/utils';
import type { MemberProfile, MyBooking } from '../../types';

export default function MemberDashboard() {
  const { data, loading, error, reload } = useFetch(
    () => Promise.all([api.members.me(), api.bookings.my()]),
    [],
  );
  const profile = data?.[0] ?? null;
  const bookings = data?.[1] ?? [];

  if (loading) return <DashboardSkeleton />;
  if (error || !profile)
    return (
      <EmptyState
        icon={<TriangleAlert />}
        title="Couldn't load your dashboard"
        description={error ?? undefined}
        action={<Button onClick={reload}>Try again</Button>}
      />
    );

  return <DashboardContent profile={profile} bookings={bookings} />;
}

function DashboardContent({ profile, bookings }: { profile: MemberProfile; bookings: MyBooking[] }) {
  const stats = useMemo(() => {
    const now = Date.now();
    const thisMonth = todayISO().slice(0, 7);
    const attended = bookings.filter((b) => b.booking_status === 'Attended');
    const upcoming = bookings
      .filter(
        (b) =>
          (b.booking_status === 'Booked' || b.booking_status === 'Waitlist') &&
          parseClassDateTime(b.class_date, b.end_time).getTime() > now,
      )
      .sort(
        (a, b) =>
          parseClassDateTime(a.class_date, a.start_time).getTime() -
          parseClassDateTime(b.class_date, b.start_time).getTime(),
      );
    const nextClass = upcoming.find((b) => b.booking_status === 'Booked') ?? null;
    // Mirrors the server's quota rule: Booked/Attended/NoShow in the current calendar month
    const monthUsed = bookings.filter(
      (b) => ['Booked', 'Attended', 'NoShow'].includes(b.booking_status) && b.class_date.startsWith(thisMonth),
    ).length;
    return {
      attendedCount: attended.length,
      streak: computeWeeklyStreak(attended.map((b) => b.class_date)),
      upcoming,
      nextClass,
      monthUsed,
      waitlisted: upcoming.filter((b) => b.booking_status === 'Waitlist').length,
    };
  }, [bookings]);

  const daysLeft = daysUntil(profile.end_date);
  const hasPlan = profile.member_status === 'Active';
  const quota = profile.class_quota;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="space-y-8">
      {/* Hero */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl border border-border bg-linear-to-br from-surface via-obsidian-light to-obsidian p-6 sm:p-8"
      >
        <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-volt/10 blur-3xl" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-volt">{greeting}</p>
            <h1 className="mt-2 font-display text-4xl sm:text-5xl font-bold uppercase tracking-tight">
              Let's go, <span className="text-gradient-volt">{profile.first_name}</span>
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Badge status={profile.member_status} dot pulse={hasPlan} size="md">
                {hasPlan ? profile.plan_name : profile.member_status === 'Expired' ? 'Plan expired' : 'No plan'}
              </Badge>
              {hasPlan && daysLeft !== null && (
                <span className={cn('text-sm', daysLeft <= 5 ? 'text-warning' : 'text-text-secondary')}>
                  {daysLeft <= 0 ? 'Expires today' : `${daysLeft} days left`}
                </span>
              )}
            </div>
          </div>

          {/* Streak */}
          <div className="flex items-center gap-4 rounded-2xl border border-warning/20 bg-warning/5 px-5 py-4">
            <motion.div
              animate={stats.streak > 0 ? { scale: [1, 1.12, 1] } : undefined}
              transition={{ repeat: Infinity, duration: 1.8 }}
              className={cn(
                'flex h-14 w-14 items-center justify-center rounded-2xl',
                stats.streak > 0 ? 'bg-warning/15 text-warning shadow-[0_0_24px_rgba(245,158,11,0.35)]' : 'bg-white/5 text-text-muted',
              )}
            >
              <Flame className="h-8 w-8" fill={stats.streak > 0 ? 'currentColor' : 'none'} />
            </motion.div>
            <div>
              <p className="font-display text-4xl font-bold leading-none tabular-nums">{stats.streak}</p>
              <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-text-secondary">
                Week streak
              </p>
              <p className="text-xs text-text-muted">
                {stats.streak > 0 ? 'Keep it alive this week!' : 'Attend a class to start one'}
              </p>
            </div>
          </div>
        </div>
      </motion.section>

      {!hasPlan && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col gap-4 rounded-2xl border border-volt/30 bg-volt/5 p-5 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-start gap-3">
            <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-volt" />
            <div>
              <p className="font-semibold">
                {profile.member_status === 'Expired' ? 'Your membership has expired' : 'Activate a membership plan'}
              </p>
              <p className="text-sm text-text-secondary">You need an active plan to book classes.</p>
            </div>
          </div>
          <Link to="/member/profile#plans">
            <Button iconRight={<ArrowRight className="h-4 w-4" />}>Choose a plan</Button>
          </Link>
        </motion.div>
      )}

      {/* Countdown + Stats */}
      <div className="grid gap-4 lg:grid-cols-3">
        <NextClassCountdown booking={stats.nextClass} />
        <div className="grid gap-4 sm:grid-cols-3 lg:col-span-2 lg:grid-cols-2">
          <StatCard
            label="This month"
            value={
              <>
                {stats.monthUsed}
                <span className="text-lg text-text-muted">/{quota ?? '∞'}</span>
              </>
            }
            hint={quota ? `${Math.max(quota - stats.monthUsed, 0)} classes remaining` : 'Unlimited classes'}
            icon={<CalendarCheck className="h-5 w-5" />}
            delay={0.05}
          >
            {quota ? (
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/5">
                <motion.div
                  className="h-full rounded-full bg-volt"
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min((stats.monthUsed / quota) * 100, 100)}%` }}
                  transition={{ duration: 0.8 }}
                />
              </div>
            ) : null}
          </StatCard>
          <StatCard
            label="Classes attended"
            value={stats.attendedCount}
            hint="All-time check-ins"
            icon={<Trophy className="h-5 w-5" />}
            accent="cyan"
            delay={0.1}
          />
          <StatCard
            label="Upcoming"
            value={stats.upcoming.length}
            hint={stats.waitlisted ? `${stats.waitlisted} on waitlist` : 'Booked & ready'}
            icon={<CalendarClock className="h-5 w-5" />}
            accent="success"
            delay={0.15}
          />
          <StatCard
            label="Plan"
            value={hasPlan && daysLeft !== null ? `${Math.max(daysLeft, 0)}d` : '—'}
            hint={hasPlan ? `Ends ${formatThaiDate(profile.end_date)}` : 'No active plan'}
            icon={<CreditCard className="h-5 w-5" />}
            accent={hasPlan && daysLeft !== null && daysLeft <= 5 ? 'warning' : 'volt'}
            delay={0.2}
          />
        </div>
      </div>

      {/* Upcoming list */}
      <Card>
        <CardHeader
          title="Up next"
          subtitle="Your booked & waitlisted sessions"
          icon={<Dumbbell className="h-5 w-5" />}
          action={
            <Link to="/member/bookings" className="text-sm font-semibold text-volt hover:underline">
              View all
            </Link>
          }
        />
        {stats.upcoming.length === 0 ? (
          <EmptyState
            icon={<CalendarClock />}
            title="Nothing booked yet"
            description="Find a class that fits your vibe and lock in your spot."
            action={
              <Link to="/member/classes">
                <Button iconRight={<ArrowRight className="h-4 w-4" />}>Browse classes</Button>
              </Link>
            }
          />
        ) : (
          <ul className="divide-y divide-border">
            {stats.upcoming.slice(0, 5).map((b, i) => {
              const intensity = getIntensityInfo(b.level);
              return (
                <motion.li
                  key={b.booking_id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex items-center gap-4 py-3"
                >
                  <div className="w-16 shrink-0 text-center">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
                      {formatRelativeDay(b.class_date)}
                    </p>
                    <p className="font-display text-lg font-bold">{b.start_time}</p>
                  </div>
                  <div className={cn('h-10 w-1 rounded-full', intensity.textClass, 'bg-current')} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{b.type_name}</p>
                    <p className="flex flex-wrap items-center gap-x-3 text-xs text-text-secondary">
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" /> {b.trainer_first_name}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" /> {b.room_name}
                      </span>
                    </p>
                  </div>
                  <span className={cn('hidden sm:inline-flex', intensity.textClass)}>
                    <IntensityMeter level={intensity.intensity} />
                  </span>
                  <Badge status={b.booking_status}>
                    {b.booking_status === 'Waitlist' ? `Waitlist #${b.waitlist_position}` : undefined}
                  </Badge>
                </motion.li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}

function NextClassCountdown({ booking }: { booking: MyBooking | null }) {
  const now = useNow(1000);

  if (!booking) {
    return (
      <Card className="flex flex-col justify-between" glow="volt">
        <div>
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-text-muted">
            <Timer className="h-4 w-4" /> Next class
          </p>
          <p className="mt-4 font-display text-2xl font-bold uppercase">No class booked</p>
          <p className="mt-1 text-sm text-text-secondary">Your countdown starts the moment you book.</p>
        </div>
        <Link to="/member/classes" className="mt-6">
          <Button fullWidth iconRight={<ArrowRight className="h-4 w-4" />}>
            Find a class
          </Button>
        </Link>
      </Card>
    );
  }

  const start = parseClassDateTime(booking.class_date, booking.start_time);
  const cd = getCountdown(start, now);
  const live = cd.totalMs === 0;
  const units = cd.days > 0
    ? [
        { v: cd.days, l: 'days' },
        { v: cd.hours, l: 'hrs' },
        { v: cd.minutes, l: 'min' },
      ]
    : [
        { v: cd.hours, l: 'hrs' },
        { v: cd.minutes, l: 'min' },
        { v: cd.seconds, l: 'sec' },
      ];

  return (
    <Card glow="volt" className="relative overflow-hidden">
      <div className="absolute -right-10 -bottom-10 h-40 w-40 rounded-full bg-volt/10 blur-2xl" />
      <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-volt">
        <Timer className="h-4 w-4" /> {live ? 'Happening now' : 'Next class in'}
      </p>
      <div className="mt-4 grid grid-cols-3 gap-2">
        {units.map((u) => (
          <div key={u.l} className="rounded-xl border border-border bg-obsidian/60 py-3 text-center">
            <motion.p
              key={u.v}
              initial={{ y: -8, opacity: 0.4 }}
              animate={{ y: 0, opacity: 1 }}
              className="font-display text-4xl font-bold tabular-nums text-volt"
            >
              {String(u.v).padStart(2, '0')}
            </motion.p>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">{u.l}</p>
          </div>
        ))}
      </div>
      <div className="relative mt-5">
        <p className="font-display text-xl font-bold uppercase">{booking.type_name}</p>
        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-text-secondary">
          <span className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            {formatRelativeDay(booking.class_date)}, {formatTimeRange(booking.start_time, booking.end_time)}
          </span>
          <span className="flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5" />
            {booking.room_name}
          </span>
        </p>
      </div>
    </Card>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      <Skeleton className="h-44 w-full rounded-3xl" />
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-64 rounded-2xl" />
        <div className="grid gap-4 sm:grid-cols-2 lg:col-span-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
      </div>
      <Skeleton className="h-72 rounded-2xl" />
    </div>
  );
}
