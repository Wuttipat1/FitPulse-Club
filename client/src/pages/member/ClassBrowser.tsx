import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { CalendarSearch, RotateCcw, Search, SlidersHorizontal, TriangleAlert, User } from 'lucide-react';
import { ClassCard } from '../../components/classes/ClassCard';
import { Button, EmptyState, PageHeader, Select, SkeletonGrid, useConfetti } from '../../components/ui';
import { api, getErrorMessage } from '../../lib/api';
import { useFetch } from '../../lib/hooks';
import { watchWaitlistBooking } from '../../lib/waitlist';
import { useAuthStore } from '../../stores/authStore';
import { toast } from '../../stores/toastStore';
import {
  addDaysISO,
  cn,
  formatTime,
  parseClassDateTime,
  parseDate,
  todayISO,
} from '../../lib/utils';
import type { BookingStatus, ClassLevel, ClassSchedule } from '../../types';

const LEVELS: (ClassLevel | 'All')[] = ['All', 'Beginner', 'Intermediate', 'Advanced'];

export default function ClassBrowser() {
  const navigate = useNavigate();
  const { fireFrom, confetti } = useConfetti();
  const memberId = useAuthStore((s) => s.user?.member_id);

  const { data, loading, error, reload, setData } = useFetch(
    () =>
      Promise.all([api.classes.schedule(), api.classes.types(), api.trainers.list(), api.bookings.my()]),
    [],
  );

  const [day, setDay] = useState<string>('all');
  const [level, setLevel] = useState<ClassLevel | 'All'>('All');
  const [typeId, setTypeId] = useState('');
  const [trainerId, setTrainerId] = useState('');
  const [query, setQuery] = useState('');
  const [hideFull, setHideFull] = useState(false);
  const [bookingId, setBookingId] = useState<number | null>(null);

  const schedule = data?.[0] ?? [];
  const types = data?.[1] ?? [];
  const trainers = data?.[2] ?? [];
  const myBookings = data?.[3] ?? [];

  const myStatusMap = useMemo(() => {
    const m = new Map<number, { status: BookingStatus; position: number | null }>();
    myBookings
      .filter((b) => b.booking_status !== 'Cancelled')
      .forEach((b) => m.set(b.schedule_id, { status: b.booking_status, position: b.waitlist_position }));
    return m;
  }, [myBookings]);

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDaysISO(i)), []);

  const upcoming = useMemo(() => {
    const now = Date.now();
    return schedule.filter((c) => parseClassDateTime(c.class_date, c.start_time).getTime() > now);
  }, [schedule]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return upcoming.filter((c) => {
      if (day !== 'all' && c.class_date !== day) return false;
      if (level !== 'All' && c.level !== level) return false;
      if (typeId && c.class_type_id !== Number(typeId)) return false;
      if (trainerId && c.trainer_id !== Number(trainerId)) return false;
      if (hideFull && c.current_booked >= c.max_capacity) return false;
      if (
        q &&
        ![c.type_name, c.room_name, c.trainer_first_name, c.trainer_last_name]
          .filter(Boolean)
          .some((s) => s!.toLowerCase().includes(q))
      )
        return false;
      return true;
    });
  }, [upcoming, day, level, typeId, trainerId, query, hideFull]);

  const countByDay = useMemo(() => {
    const m: Record<string, number> = {};
    upcoming.forEach((c) => (m[c.class_date] = (m[c.class_date] ?? 0) + 1));
    return m;
  }, [upcoming]);

  const activeFilters = (day !== 'all' ? 1 : 0) + (level !== 'All' ? 1 : 0) + (typeId ? 1 : 0) + (trainerId ? 1 : 0) + (query ? 1 : 0) + (hideFull ? 1 : 0);

  const resetFilters = () => {
    setDay('all');
    setLevel('All');
    setTypeId('');
    setTrainerId('');
    setQuery('');
    setHideFull(false);
  };

  const handleBook = async (cls: ClassSchedule, el: HTMLElement) => {
    setBookingId(cls.schedule_id);
    try {
      const res = await api.bookings.book(cls.schedule_id);
      if (res.status === 'booked') {
        fireFrom(el, 70);
        toast.success(`You're in! ${cls.type_name}`, `${formatTime(cls.start_time)} · ${cls.room_name}`);
      } else {
        watchWaitlistBooking(memberId, res.booking.booking_id);
        toast.warning('Added to waitlist', `You're #${res.position} in line — we'll auto-promote you if a spot opens.`, 6000);
      }
      // Optimistic local update, then silent refresh for truth
      setData((prev) => {
        if (!prev) return prev;
        const [sched, t, tr, mine] = prev;
        const nextSched = sched.map((c) =>
          c.schedule_id === cls.schedule_id && res.status === 'booked'
            ? { ...c, current_booked: c.current_booked + 1 }
            : c,
        );
        const nextMine = [
          ...mine,
          {
            ...res.booking,
            class_date: cls.class_date,
            start_time: cls.start_time,
            end_time: cls.end_time,
            room_name: cls.room_name,
            max_capacity: cls.max_capacity,
            schedule_status: cls.schedule_status,
            type_name: cls.type_name,
            level: cls.level,
            trainer_first_name: cls.trainer_first_name ?? '',
            trainer_last_name: cls.trainer_last_name ?? '',
            current_booked: cls.current_booked + (res.status === 'booked' ? 1 : 0),
          },
        ];
        return [nextSched, t, tr, nextMine];
      });
      void reload();
    } catch (err) {
      const msg = getErrorMessage(err);
      if (/membership|plan/i.test(msg)) {
        toast.error('No active membership', 'Choose a plan on your profile to start booking.');
        navigate('/member/profile#plans');
      } else {
        toast.error("Couldn't book class", msg);
      }
    } finally {
      setBookingId(null);
    }
  };

  return (
    <div>
      {confetti}
      <PageHeader
        eyebrow="Class schedule"
        title="Find your next sweat"
        subtitle="Live capacity, one-tap booking. Full? Jump on the waitlist and we'll promote you automatically."
      />

      {/* Day strip */}
      <div className="-mx-4 mb-6 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
        <div className="flex gap-2">
          <DayPill active={day === 'all'} onClick={() => setDay('all')} top="All" bottom="Week" count={upcoming.length} />
          {days.map((d) => {
            const date = parseDate(d);
            return (
              <DayPill
                key={d}
                active={day === d}
                onClick={() => setDay(d)}
                top={d === todayISO() ? 'Today' : date.toLocaleDateString('en-US', { weekday: 'short' })}
                bottom={String(date.getDate())}
                count={countByDay[d] ?? 0}
              />
            );
          })}
        </div>
      </div>

      {/* Filters */}
      <div className="glass-card mb-8 p-4">
        <div className="grid gap-3 md:grid-cols-[1.4fr_1fr_1fr]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search class, trainer or room…"
              className="h-11 w-full rounded-xl border border-border bg-obsidian-light pl-10 pr-4 text-sm outline-none placeholder:text-text-muted focus:border-volt/60 focus:ring-2 focus:ring-volt/15"
            />
          </div>
          <Select
            value={typeId}
            onChange={(e) => setTypeId(e.target.value)}
            placeholder="All class types"
            icon={<SlidersHorizontal />}
            options={types.map((t) => ({ value: t.class_type_id, label: t.type_name }))}
          />
          <Select
            value={trainerId}
            onChange={(e) => setTrainerId(e.target.value)}
            placeholder="All trainers"
            icon={<User />}
            options={trainers.map((t) => ({ value: t.trainer_id, label: `${t.first_name} ${t.last_name}` }))}
          />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {LEVELS.map((l) => (
            <button
              key={l}
              onClick={() => setLevel(l)}
              className={cn(
                'rounded-full border px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer',
                level === l
                  ? 'border-volt bg-volt text-obsidian'
                  : 'border-border text-text-secondary hover:border-border-hover hover:text-text-primary',
              )}
            >
              {l}
            </button>
          ))}
          <label className="ml-1 flex cursor-pointer items-center gap-2 text-xs font-semibold text-text-secondary select-none">
            <input
              type="checkbox"
              checked={hideFull}
              onChange={(e) => setHideFull(e.target.checked)}
              className="h-4 w-4 accent-[#CCFF00] cursor-pointer"
            />
            Hide full classes
          </label>
          {activeFilters > 0 && (
            <Button variant="ghost" size="sm" className="ml-auto" icon={<RotateCcw className="h-3.5 w-3.5" />} onClick={resetFilters}>
              Reset ({activeFilters})
            </Button>
          )}
        </div>
      </div>

      {loading ? (
        <SkeletonGrid count={6} />
      ) : error ? (
        <EmptyState
          icon={<TriangleAlert />}
          title="Couldn't load classes"
          description={error}
          action={<Button onClick={reload}>Retry</Button>}
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<CalendarSearch />}
          title="No classes match"
          description="Try a different day or loosen your filters."
          action={activeFilters > 0 ? <Button variant="secondary" onClick={resetFilters}>Clear filters</Button> : undefined}
        />
      ) : (
        <>
          <p className="mb-4 text-sm text-text-muted">
            Showing <span className="font-semibold text-text-primary">{filtered.length}</span> upcoming{' '}
            {filtered.length === 1 ? 'class' : 'classes'}
          </p>
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            <AnimatePresence mode="popLayout">
              {filtered.map((c, i) => (
                <ClassCard
                  key={c.schedule_id}
                  cls={c}
                  index={i}
                  myStatus={myStatusMap.get(c.schedule_id)}
                  booking={bookingId === c.schedule_id}
                  onBook={handleBook}
                />
              ))}
            </AnimatePresence>
          </div>
        </>
      )}
    </div>
  );
}

function DayPill({
  active,
  onClick,
  top,
  bottom,
  count,
}: {
  active: boolean;
  onClick: () => void;
  top: string;
  bottom: string;
  count: number;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'relative flex min-w-[68px] flex-col items-center rounded-2xl border px-3 py-2.5 transition-all cursor-pointer',
        active
          ? 'border-volt bg-volt text-obsidian shadow-[0_0_20px_rgba(204,255,0,0.25)]'
          : 'border-border bg-surface/60 text-text-secondary hover:border-border-hover hover:text-text-primary',
      )}
    >
      <span className="text-[10px] font-bold uppercase tracking-wider">{top}</span>
      <span className="font-display text-2xl font-bold leading-tight">{bottom}</span>
      <span
        className={cn(
          'mt-0.5 text-[10px] font-semibold',
          active ? 'text-obsidian/70' : count ? 'text-volt' : 'text-text-muted',
        )}
      >
        {count} {count === 1 ? 'class' : 'classes'}
      </span>
    </button>
  );
}
