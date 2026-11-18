import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Award,
  CalendarDays,
  ChevronRight,
  ClipboardCheck,
  Clock,
  Gauge,
  MapPin,
  Phone,
  TriangleAlert,
  Users,
} from 'lucide-react';
import {
  Avatar,
  Badge,
  Button,
  CapacityBar,
  Card,
  EmptyState,
  IntensityMeter,
  PageHeader,
  Skeleton,
  StatCard,
} from '../../components/ui';
import { api } from '../../lib/api';
import { useFetch } from '../../lib/hooks';
import {
  addDaysISO,
  cn,
  formatLongDate,
  formatRelativeDay,
  formatTimeRange,
  getInitials,
  getIntensityInfo,
  parseClassDateTime,
  todayISO,
} from '../../lib/utils';
import type { ClassSchedule } from '../../types';

export default function TrainerDashboard() {
  const { data, loading, error, reload } = useFetch(
    () => Promise.all([api.trainers.me(), api.trainers.myClasses()]),
    [],
  );

  const trainer = data?.[0];
  const classes = data?.[1] ?? [];

  const { grouped, stats } = useMemo(() => {
    const today = todayISO();
    const weekEnd = addDaysISO(6);
    const active = classes.filter((c) => c.schedule_status !== 'Cancelled');
    const g = new Map<string, ClassSchedule[]>();
    active.forEach((c) => g.set(c.class_date, [...(g.get(c.class_date) ?? []), c]));
    const totalBooked = active.reduce((s, c) => s + c.current_booked, 0);
    const totalCap = active.reduce((s, c) => s + c.max_capacity, 0);
    return {
      grouped: [...g.entries()].sort(([a], [b]) => a.localeCompare(b)),
      stats: {
        today: active.filter((c) => c.class_date === today).length,
        week: active.filter((c) => c.class_date <= weekEnd).length,
        athletes: totalBooked,
        fill: totalCap ? Math.round((totalBooked / totalCap) * 100) : 0,
      },
    };
  }, [classes]);

  if (loading)
    return (
      <div className="space-y-6">
        <Skeleton className="h-36 rounded-2xl" />
        <div className="grid gap-4 sm:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-80 rounded-2xl" />
      </div>
    );
  if (error || !trainer)
    return <EmptyState icon={<TriangleAlert />} title="Couldn't load your classes" description={error ?? undefined} action={<Button onClick={reload}>Retry</Button>} />;

  const nextClass = classes.find((c) => parseClassDateTime(c.class_date, c.end_time).getTime() > Date.now());

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Trainer hub" title={`Coach ${trainer.first_name}`} subtitle="Your upcoming sessions and class rosters." />

      <Card className="flex flex-col gap-6 sm:flex-row sm:items-center">
        <Avatar initials={getInitials(trainer.first_name, trainer.last_name)} size="lg" />
        <div className="flex-1">
          <p className="font-display text-2xl font-bold uppercase">
            {trainer.first_name} {trainer.last_name}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {trainer.specialization.split(',').map((s) => (
              <Badge key={s} tone="volt">
                {s.trim()}
              </Badge>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-text-secondary">
          <span className="flex items-center gap-2">
            <Award className="h-4 w-4 text-warning" /> {trainer.experience_years} yrs experience
          </span>
          {trainer.hire_date && (
            <span className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-cyan" /> Since {formatLongDate(trainer.hire_date)}
            </span>
          )}
          {trainer.phones[0] && (
            <span className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-text-muted" /> {trainer.phones[0]}
            </span>
          )}
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Today" value={stats.today} hint="classes to coach" icon={<Clock className="h-5 w-5" />} />
        <StatCard label="Next 7 days" value={stats.week} hint="scheduled sessions" icon={<CalendarDays className="h-5 w-5" />} accent="cyan" delay={0.05} />
        <StatCard label="Athletes booked" value={stats.athletes} hint="across upcoming classes" icon={<Users className="h-5 w-5" />} accent="success" delay={0.1} />
        <StatCard label="Avg fill rate" value={`${stats.fill}%`} hint="booked vs capacity" icon={<Gauge className="h-5 w-5" />} accent="warning" delay={0.15} />
      </div>

      {grouped.length === 0 ? (
        <EmptyState icon={<CalendarDays />} title="No upcoming classes" description="An admin will assign you to the schedule." />
      ) : (
        <div className="space-y-8">
          {grouped.map(([date, list]) => (
            <section key={date}>
              <div className="mb-3 flex items-baseline gap-3">
                <h2 className="font-display text-xl font-bold uppercase">{formatRelativeDay(date)}</h2>
                <span className="text-sm text-text-muted">{formatLongDate(date)}</span>
              </div>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {list.map((c, i) => {
                  const intensity = getIntensityInfo(c.level);
                  const isNext = nextClass?.schedule_id === c.schedule_id;
                  return (
                    <motion.div
                      key={c.schedule_id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                    >
                      <Link
                        to={`/trainer/classes/${c.schedule_id}`}
                        className={cn(
                          'group block rounded-2xl border bg-surface/80 p-5 transition-all hover:-translate-y-0.5 hover:border-border-hover',
                          isNext ? 'border-volt/40 glow-volt-subtle' : 'border-border',
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className={cn('flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider', intensity.textClass)}>
                              <IntensityMeter level={intensity.intensity} /> {intensity.label}
                            </span>
                            <p className="mt-2 font-display text-xl font-bold uppercase">{c.type_name}</p>
                          </div>
                          {isNext && (
                            <Badge tone="volt" dot pulse>
                              Up next
                            </Badge>
                          )}
                        </div>
                        <div className="mt-2 space-y-1 text-sm text-text-secondary">
                          <p className="flex items-center gap-2">
                            <Clock className="h-3.5 w-3.5" /> {formatTimeRange(c.start_time, c.end_time)}
                          </p>
                          <p className="flex items-center gap-2">
                            <MapPin className="h-3.5 w-3.5" /> {c.room_name}
                          </p>
                        </div>
                        <CapacityBar current={c.current_booked} max={c.max_capacity} className="mt-4" />
                        <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-sm font-semibold text-volt">
                          <span className="flex items-center gap-2">
                            <ClipboardCheck className="h-4 w-4" /> Open roster
                          </span>
                          <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                        </div>
                      </Link>
                    </motion.div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
