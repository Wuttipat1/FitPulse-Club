import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Activity,
  ArrowRight,
  CalendarDays,
  CalendarPlus,
  Clock,
  Gauge,
  MapPin,
  TriangleAlert,
  UserCheck,
  Users,
} from 'lucide-react';
import { Badge, Button, CapacityBar, Card, CardHeader, EmptyState, PageHeader, Skeleton, StatCard } from '../../components/ui';
import { api } from '../../lib/api';
import { useFetch } from '../../lib/hooks';
import { cn, formatLongDate, formatRelativeDay, formatTime, formatTimeRange, getStatusLabel, timeAgo, todayISO } from '../../lib/utils';

export default function AdminDashboard() {
  const { data, loading, error, reload } = useFetch(
    () =>
      Promise.all([
        api.admin.stats(),
        api.admin.recentBookings(),
        api.classes.schedule({ date: todayISO() }),
      ]),
    [],
  );

  if (loading)
    return (
      <div className="space-y-6">
        <Skeleton className="h-16 w-80" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32 rounded-2xl" />
          ))}
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-96 rounded-2xl" />
          <Skeleton className="h-96 rounded-2xl" />
        </div>
      </div>
    );
  if (error || !data)
    return <EmptyState icon={<TriangleAlert />} title="Couldn't load dashboard" description={error ?? undefined} action={<Button onClick={reload}>Retry</Button>} />;

  const [stats, recent, today] = data;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Admin console"
        title="Club overview"
        subtitle={formatLongDate(todayISO())}
        action={
          <Link to="/admin/schedule">
            <Button icon={<CalendarPlus className="h-4 w-4" />}>Schedule class</Button>
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Active members" value={stats.totalActiveMembers} hint="with a valid plan" icon={<Users className="h-5 w-5" />} />
        <StatCard
          label="Today's classes"
          value={stats.todaysClasses}
          hint="on the schedule"
          icon={<CalendarDays className="h-5 w-5" />}
          accent="cyan"
          delay={0.05}
        />
        <StatCard
          label="Occupancy"
          value={`${stats.occupancyRate}%`}
          hint="avg fill of today's classes"
          icon={<Gauge className="h-5 w-5" />}
          accent={stats.occupancyRate >= 80 ? 'danger' : stats.occupancyRate >= 50 ? 'warning' : 'success'}
          delay={0.1}
        >
          <OccupancyRing value={stats.occupancyRate} />
        </StatCard>
        <Link to="/admin/trainers" className="block">
          <StatCard
            label="Pending trainers"
            value={stats.pendingTrainers}
            hint={stats.pendingTrainers ? 'awaiting review →' : 'all caught up'}
            icon={<UserCheck className="h-5 w-5" />}
            accent={stats.pendingTrainers ? 'warning' : 'success'}
            delay={0.15}
          >
            {stats.pendingTrainers > 0 && (
              <span className="absolute right-4 bottom-4 flex h-3 w-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-warning opacity-75" />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-warning" />
              </span>
            )}
          </StatCard>
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <Card>
          <CardHeader
            title="Today's schedule"
            subtitle={`${today.length} classes`}
            icon={<CalendarDays className="h-5 w-5" />}
            action={
              <Link to="/admin/schedule" className="flex items-center gap-1 text-sm font-semibold text-volt hover:underline">
                Manage <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            }
          />
          {today.length === 0 ? (
            <EmptyState icon={<CalendarDays />} title="No classes today" />
          ) : (
            <ul className="space-y-3">
              {today.map((c, i) => (
                <motion.li
                  key={c.schedule_id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="rounded-xl border border-border bg-obsidian-light/60 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{c.type_name}</p>
                      <p className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-text-secondary">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" /> {formatTimeRange(c.start_time, c.end_time)}
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" /> {c.room_name}
                        </span>
                        <span>
                          {c.trainer_first_name} {c.trainer_last_name}
                        </span>
                      </p>
                    </div>
                    <Badge status={c.current_booked >= c.max_capacity ? 'Full' : 'Open'} />
                  </div>
                  <CapacityBar current={c.current_booked} max={c.max_capacity} size="sm" className="mt-3" />
                </motion.li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title="Live activity" subtitle="Latest bookings" icon={<Activity className="h-5 w-5" />} />
          {recent.length === 0 ? (
            <EmptyState icon={<Activity />} title="No activity yet" />
          ) : (
            <ol className="relative space-y-4 border-l border-border pl-5">
              {recent.map((b, i) => (
                <motion.li
                  key={b.booking_id}
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="relative"
                >
                  <span
                    className={cn(
                      'absolute -left-[26px] top-1.5 h-2.5 w-2.5 rounded-full ring-4 ring-surface',
                      b.booking_status === 'Booked' && 'bg-volt',
                      b.booking_status === 'Waitlist' && 'bg-warning',
                      b.booking_status === 'Attended' && 'bg-success',
                      b.booking_status === 'NoShow' && 'bg-danger',
                      b.booking_status === 'Cancelled' && 'bg-text-muted',
                    )}
                  />
                  <p className="text-sm">
                    <span className="font-semibold">
                      {b.first_name} {b.last_name}
                    </span>{' '}
                    <span className="text-text-secondary">
                      {b.booking_status === 'Waitlist'
                        ? 'joined the waitlist for'
                        : b.booking_status === 'Cancelled'
                          ? 'cancelled'
                          : b.booking_status === 'Booked'
                            ? 'booked'
                            : `was marked ${getStatusLabel(b.booking_status).toLowerCase()} in`}
                    </span>{' '}
                    <span className="font-semibold text-text-primary">{b.type_name}</span>
                  </p>
                  <p className="text-xs text-text-muted">
                    {formatRelativeDay(b.class_date)} {formatTime(b.start_time)} · {timeAgo(b.booking_time)}
                  </p>
                </motion.li>
              ))}
            </ol>
          )}
        </Card>
      </div>
    </div>
  );
}

function OccupancyRing({ value }: { value: number }) {
  const r = 18;
  const c = 2 * Math.PI * r;
  const color = value >= 80 ? '#EF4444' : value >= 50 ? '#F59E0B' : '#22C55E';
  return (
    <svg className="absolute bottom-3 right-3 h-12 w-12 -rotate-90 opacity-80" viewBox="0 0 44 44" aria-hidden="true">
      <circle cx="22" cy="22" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="4" />
      <motion.circle
        cx="22"
        cy="22"
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray={c}
        initial={{ strokeDashoffset: c }}
        animate={{ strokeDashoffset: c - (Math.min(value, 100) / 100) * c }}
        transition={{ duration: 1, ease: 'easeOut' }}
      />
    </svg>
  );
}
