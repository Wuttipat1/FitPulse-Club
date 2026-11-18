import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft,
  CheckCheck,
  CircleCheck,
  CircleDashed,
  CircleX,
  Clock,
  MapPin,
  Search,
  TriangleAlert,
  Users,
} from 'lucide-react';
import { Avatar, Badge, Button, CapacityBar, Card, EmptyState, Skeleton } from '../../components/ui';
import { api, getErrorMessage } from '../../lib/api';
import { useFetch } from '../../lib/hooks';
import { toast } from '../../stores/toastStore';
import { cn, formatLongDate, formatTimeRange, getInitials, getIntensityInfo, timeAgo } from '../../lib/utils';
import type { CheckinStatus, RosterEntry } from '../../types';

export default function TrainerRoster() {
  const { scheduleId } = useParams();
  const id = Number(scheduleId);

  const { data, loading, error, reload, setData } = useFetch(
    () => Promise.all([api.trainers.myClasses(), api.trainers.roster(id)]),
    [id],
  );
  const [query, setQuery] = useState('');
  const [saving, setSaving] = useState<Set<number>>(new Set());
  const [bulk, setBulk] = useState(false);

  const cls = data?.[0].find((c) => c.schedule_id === id);
  const roster = data?.[1] ?? [];

  const counts = useMemo(
    () => ({
      attended: roster.filter((r) => r.booking_status === 'Attended').length,
      noShow: roster.filter((r) => r.booking_status === 'NoShow').length,
      unmarked: roster.filter((r) => r.booking_status === 'Booked').length,
    }),
    [roster],
  );

  const filtered = roster.filter((r) => `${r.first_name} ${r.last_name}`.toLowerCase().includes(query.trim().toLowerCase()));

  const patchRoster = (bookingIds: number[], status: RosterEntry['booking_status']) =>
    setData((prev) =>
      prev ? [prev[0], prev[1].map((r) => (bookingIds.includes(r.booking_id) ? { ...r, booking_status: status } : r))] : prev,
    );

  const mark = async (entry: RosterEntry, status: CheckinStatus) => {
    if (entry.booking_status === status) return;
    const previous = entry.booking_status;
    patchRoster([entry.booking_id], status); // optimistic
    setSaving((s) => new Set(s).add(entry.booking_id));
    try {
      await api.trainers.checkin(id, entry.booking_id, status);
    } catch (err) {
      patchRoster([entry.booking_id], previous);
      toast.error(`Couldn't update ${entry.first_name}`, getErrorMessage(err));
    } finally {
      setSaving((s) => {
        const n = new Set(s);
        n.delete(entry.booking_id);
        return n;
      });
    }
  };

  const markAllAttended = async () => {
    const targets = roster.filter((r) => r.booking_status === 'Booked');
    if (!targets.length) return;
    setBulk(true);
    patchRoster(targets.map((t) => t.booking_id), 'Attended');
    const results = await Promise.allSettled(targets.map((t) => api.trainers.checkin(id, t.booking_id, 'Attended')));
    const failed = targets.filter((_, i) => results[i].status === 'rejected');
    if (failed.length) {
      patchRoster(failed.map((f) => f.booking_id), 'Booked');
      toast.error(`${failed.length} check-in(s) failed`, 'Please retry those members.');
    } else {
      toast.success('Everyone checked in', `${targets.length} members marked as attended.`);
    }
    setBulk(false);
  };

  if (loading)
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-40 rounded-2xl" />
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    );

  if (error)
    return <EmptyState icon={<TriangleAlert />} title="Couldn't load roster" description={error} action={<Button onClick={reload}>Retry</Button>} />;

  const intensity = cls ? getIntensityInfo(cls.level) : null;
  const total = roster.length;
  const checkedPct = total ? Math.round(((counts.attended + counts.noShow) / total) * 100) : 0;

  return (
    <div className="space-y-6">
      <Link to="/trainer" className="inline-flex items-center gap-2 text-sm font-semibold text-text-secondary hover:text-volt">
        <ArrowLeft className="h-4 w-4" /> Back to my classes
      </Link>

      {/* Class header */}
      <Card className="relative overflow-hidden" padding="lg">
        {intensity && <div className={cn('absolute inset-0 -z-0 bg-linear-to-br opacity-60', intensity.gradient)} />}
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-volt">Class roster</p>
            <h1 className="mt-2 font-display text-4xl font-bold uppercase">{cls?.type_name ?? `Class #${id}`}</h1>
            {cls && (
              <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-text-secondary">
                <span className="flex items-center gap-1.5">
                  <Clock className="h-4 w-4" /> {formatLongDate(cls.class_date)} · {formatTimeRange(cls.start_time, cls.end_time)}
                </span>
                <span className="flex items-center gap-1.5">
                  <MapPin className="h-4 w-4" /> {cls.room_name}
                </span>
              </div>
            )}
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            <Counter label="Attended" value={counts.attended} tone="text-success" />
            <Counter label="No-show" value={counts.noShow} tone="text-danger" />
            <Counter label="Unmarked" value={counts.unmarked} tone="text-text-secondary" />
          </div>
        </div>
        <div className="relative mt-6 grid gap-4 sm:grid-cols-2">
          {cls && <CapacityBar current={cls.current_booked} max={cls.max_capacity} />}
          <div>
            <div className="mb-1.5 flex justify-between text-xs">
              <span className="text-text-secondary">Check-in progress</span>
              <span className="font-semibold text-volt">{checkedPct}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/5">
              <motion.div className="h-full rounded-full bg-linear-to-r from-volt to-cyan" animate={{ width: `${checkedPct}%` }} />
            </div>
          </div>
        </div>
      </Card>

      {/* Roster list */}
      <Card padding="none">
        <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative sm:w-72">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search members…"
              className="h-10 w-full rounded-xl border border-border bg-obsidian-light pl-10 pr-4 text-sm outline-none placeholder:text-text-muted focus:border-volt/60"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            icon={<CheckCheck className="h-4 w-4" />}
            onClick={markAllAttended}
            loading={bulk}
            disabled={counts.unmarked === 0}
          >
            Mark all unmarked as attended
          </Button>
        </div>

        {total === 0 ? (
          <EmptyState className="m-4 border-none" icon={<Users />} title="No bookings yet" description="Members who book this class will appear here." />
        ) : filtered.length === 0 ? (
          <p className="p-8 text-center text-sm text-text-muted">No members match “{query}”.</p>
        ) : (
          <ul className="divide-y divide-border">
            <AnimatePresence initial={false}>
              {filtered.map((r, i) => (
                <motion.li
                  key={r.booking_id}
                  layout
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: Math.min(i * 0.03, 0.3) }}
                  className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center"
                >
                  <div className="flex flex-1 items-center gap-3">
                    <span className="w-6 text-right text-xs font-semibold tabular-nums text-text-muted">{i + 1}</span>
                    <Avatar initials={getInitials(r.first_name, r.last_name)} size="sm" />
                    <div className="min-w-0">
                      <p className="font-semibold">
                        {r.first_name} {r.last_name}
                      </p>
                      <p className="text-xs text-text-muted">Booked {timeAgo(r.booking_time)}</p>
                    </div>
                    {r.booking_status === 'Booked' && (
                      <Badge tone="neutral" icon={<CircleDashed className="h-3 w-3" />} className="ml-2 hidden sm:inline-flex">
                        Unmarked
                      </Badge>
                    )}
                  </div>
                  <AttendanceToggle
                    value={r.booking_status}
                    disabled={saving.has(r.booking_id) || bulk}
                    onChange={(s) => mark(r, s)}
                  />
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </Card>
    </div>
  );
}

function Counter({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-xl border border-border bg-obsidian/60 px-4 py-2">
      <motion.p key={value} initial={{ scale: 1.3 }} animate={{ scale: 1 }} className={cn('font-display text-3xl font-bold tabular-nums', tone)}>
        {value}
      </motion.p>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">{label}</p>
    </div>
  );
}

function AttendanceToggle({
  value,
  onChange,
  disabled,
}: {
  value: RosterEntry['booking_status'];
  onChange: (s: CheckinStatus) => void;
  disabled?: boolean;
}) {
  const opts: { v: CheckinStatus; label: string; icon: typeof CircleCheck; active: string }[] = [
    { v: 'Attended', label: 'Attended', icon: CircleCheck, active: 'bg-success text-obsidian shadow-[0_0_14px_rgba(34,197,94,0.4)]' },
    { v: 'NoShow', label: 'No-show', icon: CircleX, active: 'bg-danger text-white shadow-[0_0_14px_rgba(239,68,68,0.4)]' },
  ];
  return (
    <div className={cn('inline-flex self-start rounded-xl border border-border bg-obsidian-light p-1 sm:self-auto', disabled && 'opacity-60')}>
      {opts.map((o) => {
        const on = value === o.v;
        return (
          <button
            key={o.v}
            disabled={disabled}
            onClick={() => onChange(o.v)}
            className={cn(
              'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer disabled:cursor-wait',
              on ? o.active : 'text-text-secondary hover:text-text-primary',
            )}
            aria-pressed={on}
          >
            <o.icon className="h-4 w-4" />
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
