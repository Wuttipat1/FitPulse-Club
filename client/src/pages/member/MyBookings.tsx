import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowRight,
  CircleArrowUp,
  CalendarCheck,
  CalendarX,
  Clock,
  History,
  Hourglass,
  MapPin,
  PartyPopper,
  TriangleAlert,
  User,
  X,
} from 'lucide-react';
import {
  Badge,
  Button,
  CapacityBar,
  EmptyState,
  IntensityMeter,
  Modal,
  PageHeader,
  Skeleton,
  Tabs,
  useConfetti,
} from '../../components/ui';
import { api, getErrorMessage } from '../../lib/api';
import { useFetch } from '../../lib/hooks';
import { syncWaitlist } from '../../lib/waitlist';
import { useAuthStore } from '../../stores/authStore';
import { toast } from '../../stores/toastStore';
import {
  cn,
  formatDate,
  formatRelativeDay,
  formatTimeRange,
  getIntensityInfo,
  parseClassDateTime,
} from '../../lib/utils';
import type { MyBooking } from '../../types';

type Tab = 'upcoming' | 'past' | 'cancelled';

export default function MyBookings() {
  const memberId = useAuthStore((s) => s.user?.member_id);
  const { data, loading, error, reload, setData } = useFetch(() => api.bookings.my(), []);
  const [tab, setTab] = useState<Tab>('upcoming');
  const [toCancel, setToCancel] = useState<MyBooking | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [promoted, setPromoted] = useState<MyBooking[]>([]);
  const { fire, confetti } = useConfetti();

  const bookings = data ?? [];

  const groups = useMemo(() => {
    const now = Date.now();
    const start = (b: MyBooking) => parseClassDateTime(b.class_date, b.start_time).getTime();
    const end = (b: MyBooking) => parseClassDateTime(b.class_date, b.end_time).getTime();
    const upcoming = bookings
      .filter((b) => (b.booking_status === 'Booked' || b.booking_status === 'Waitlist') && end(b) > now)
      .sort((a, b) => start(a) - start(b));
    const past = bookings
      .filter((b) => b.booking_status !== 'Cancelled' && !upcoming.includes(b))
      .sort((a, b) => start(b) - start(a));
    const cancelled = bookings.filter((b) => b.booking_status === 'Cancelled').sort((a, b) => start(b) - start(a));
    return { upcoming, past, cancelled };
  }, [bookings]);

  // ---- Auto-promotion detection ----
  // Remember which bookings were on the waitlist; if one comes back as Booked, celebrate.
  useEffect(() => {
    if (!data) return;
    const nowPromoted = syncWaitlist(memberId, data);
    if (nowPromoted.length) {
      setPromoted(nowPromoted);
      setTimeout(() => fire(window.innerWidth / 2, 160, 90), 250);
      nowPromoted.forEach((b) =>
        toast.success('Promoted from waitlist! 🎉', `You're now booked for ${b.type_name} on ${formatDate(b.class_date)}.`, 7000),
      );
    }
  }, [data, memberId, fire]);

  const confirmCancel = async () => {
    if (!toCancel) return;
    setCancelling(true);
    try {
      const res = await api.bookings.cancel(toCancel.booking_id);
      setData((prev) =>
        prev ? prev.map((b) => (b.booking_id === toCancel.booking_id ? { ...b, booking_status: 'Cancelled' } : b)) : prev,
      );
      if (res.promoted_member) {
        toast.info(
          'Spot passed on',
          `${res.promoted_member.first_name} was auto-promoted from the waitlist into your spot.`,
          6000,
        );
      } else {
        toast.success('Booking cancelled', toCancel.type_name);
      }
      setToCancel(null);
      void reload();
    } catch (err) {
      toast.error("Couldn't cancel", getErrorMessage(err));
    } finally {
      setCancelling(false);
    }
  };

  const list = groups[tab];

  return (
    <div>
      {confetti}
      <PageHeader
        eyebrow="Your schedule"
        title="My bookings"
        subtitle="Manage upcoming sessions, track your history, and watch your waitlist spots."
        action={
          <Link to="/member/classes">
            <Button iconRight={<ArrowRight className="h-4 w-4" />}>Book a class</Button>
          </Link>
        }
      />

      {/* Promotion banner */}
      <AnimatePresence>
        {promoted.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10 }}
            className="relative mb-6 overflow-hidden rounded-2xl border border-volt/40 bg-linear-to-r from-volt/15 via-cyan/10 to-transparent p-5 glow-volt-subtle"
          >
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-volt text-obsidian">
                <PartyPopper className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <p className="font-display text-xl font-bold uppercase">You got off the waitlist!</p>
                <ul className="mt-1 space-y-0.5 text-sm text-text-secondary">
                  {promoted.map((b) => (
                    <li key={b.booking_id} className="flex items-center gap-2">
                      <CircleArrowUp className="h-4 w-4 text-volt" />
                      <span className="font-semibold text-text-primary">{b.type_name}</span> ·{' '}
                      {formatRelativeDay(b.class_date)}, {formatTimeRange(b.start_time, b.end_time)}
                    </li>
                  ))}
                </ul>
              </div>
              <button
                onClick={() => setPromoted([])}
                className="rounded-lg p-1 text-text-muted hover:bg-white/5 hover:text-text-primary cursor-pointer"
                aria-label="Dismiss"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Tabs<Tab>
        className="mb-6"
        layoutId="bookings-tabs"
        value={tab}
        onChange={setTab}
        items={[
          { value: 'upcoming', label: 'Upcoming', count: groups.upcoming.length, icon: <CalendarCheck /> },
          { value: 'past', label: 'Past', count: groups.past.length, icon: <History /> },
          { value: 'cancelled', label: 'Cancelled', count: groups.cancelled.length, icon: <CalendarX /> },
        ]}
      />

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
      ) : error ? (
        <EmptyState icon={<TriangleAlert />} title="Couldn't load bookings" description={error} action={<Button onClick={reload}>Retry</Button>} />
      ) : list.length === 0 ? (
        <EmptyState
          icon={tab === 'upcoming' ? <CalendarCheck /> : tab === 'past' ? <History /> : <CalendarX />}
          title={tab === 'upcoming' ? 'No upcoming classes' : tab === 'past' ? 'No history yet' : 'Nothing cancelled'}
          description={tab === 'upcoming' ? 'Your next PR is one booking away.' : undefined}
          action={
            tab === 'upcoming' ? (
              <Link to="/member/classes">
                <Button>Browse classes</Button>
              </Link>
            ) : undefined
          }
        />
      ) : (
        <motion.ul layout className="space-y-3">
          <AnimatePresence mode="popLayout">
            {list.map((b, i) => (
              <BookingRow key={b.booking_id} booking={b} index={i} onCancel={tab === 'upcoming' ? () => setToCancel(b) : undefined} />
            ))}
          </AnimatePresence>
        </motion.ul>
      )}

      <Modal
        open={!!toCancel}
        onClose={() => setToCancel(null)}
        locked={cancelling}
        size="sm"
        icon={<CalendarX className="h-5 w-5" />}
        title={toCancel?.booking_status === 'Waitlist' ? 'Leave waitlist?' : 'Cancel booking?'}
        description={
          toCancel
            ? `${toCancel.type_name} · ${formatRelativeDay(toCancel.class_date)}, ${formatTimeRange(toCancel.start_time, toCancel.end_time)}`
            : undefined
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setToCancel(null)} disabled={cancelling}>
              Keep it
            </Button>
            <Button variant="danger" onClick={confirmCancel} loading={cancelling}>
              {toCancel?.booking_status === 'Waitlist' ? 'Leave waitlist' : 'Cancel booking'}
            </Button>
          </>
        }
      >
        <p className="text-sm text-text-secondary">
          {toCancel?.booking_status === 'Waitlist'
            ? "You'll lose your place in line."
            : 'Your spot will be released and the first person on the waitlist gets promoted automatically.'}
        </p>
      </Modal>
    </div>
  );
}

function BookingRow({ booking: b, index, onCancel }: { booking: MyBooking; index: number; onCancel?: () => void }) {
  const intensity = getIntensityInfo(b.level);
  const date = parseClassDateTime(b.class_date, b.start_time);
  const isCancelled = b.booking_status === 'Cancelled';

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -30 }}
      transition={{ delay: Math.min(index * 0.04, 0.3) }}
      className={cn(
        'glass-card flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:p-5',
        isCancelled && 'opacity-60',
        b.booking_status === 'Waitlist' && 'border-warning/30',
      )}
    >
      {/* Date tile */}
      <div className="flex items-center gap-4 sm:w-auto">
        <div
          className={cn(
            'flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-xl border',
            b.booking_status === 'Booked' ? 'border-volt/40 bg-volt/10' : 'border-border bg-obsidian-light',
          )}
        >
          <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
            {date.toLocaleDateString('en-US', { weekday: 'short' })}
          </span>
          <span className="font-display text-2xl font-bold leading-none">{String(date.getDate()).padStart(2, '0')}</span>
          <span className="text-[10px] font-semibold tabular-nums text-text-secondary">
            {b.class_date.slice(0, 7)}
          </span>
        </div>
        <div className="min-w-0 sm:hidden">
          <p className={cn('font-display text-lg font-bold uppercase', isCancelled && 'line-through')}>{b.type_name}</p>
        </div>
      </div>

      <div className="min-w-0 flex-1">
        <div className="hidden items-center gap-3 sm:flex">
          <p className={cn('font-display text-xl font-bold uppercase', isCancelled && 'line-through')}>{b.type_name}</p>
          <span className={cn('flex items-center gap-1 text-xs font-semibold', intensity.textClass)}>
            <IntensityMeter level={intensity.intensity} /> {intensity.label}
          </span>
        </div>
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-text-secondary">
          <span className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" /> {formatTimeRange(b.start_time, b.end_time)}
          </span>
          <span className="flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5" /> {b.room_name}
          </span>
          <span className="flex items-center gap-1.5">
            <User className="h-3.5 w-3.5" /> {b.trainer_first_name} {b.trainer_last_name}
          </span>
        </div>
        {!isCancelled && b.booking_status !== 'Attended' && b.booking_status !== 'NoShow' && (
          <CapacityBar current={b.current_booked} max={b.max_capacity} size="sm" className="mt-3 max-w-xs" />
        )}
      </div>

      <div className="flex items-center gap-3 sm:flex-col sm:items-end">
        {b.booking_status === 'Waitlist' ? (
          <Badge tone="warning" size="md" icon={<Hourglass className="h-3 w-3" />}>
            Waitlist #{b.waitlist_position}
          </Badge>
        ) : (
          <Badge status={b.booking_status} size="md" dot pulse={b.booking_status === 'Booked'} />
        )}
        {onCancel && (
          <Button variant="ghost" size="sm" onClick={onCancel} className="text-danger hover:bg-danger/10 hover:text-danger">
            {b.booking_status === 'Waitlist' ? 'Leave' : 'Cancel'}
          </Button>
        )}
      </div>
    </motion.li>
  );
}
