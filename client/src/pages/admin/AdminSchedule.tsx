import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Ban,
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  Clock,
  DoorOpen,
  Dumbbell,
  LoaderCircle,
  MapPin,
  Plus,
  ShieldAlert,
  TriangleAlert,
  User,
  Users,
} from 'lucide-react';
import { Badge, Button, Card, CardHeader, EmptyState, Input, Modal, PageHeader, Select, Skeleton } from '../../components/ui';
import { api, ApiError, getErrorMessage } from '../../lib/api';
import { useDebounced, useFetch } from '../../lib/hooks';
import { toast } from '../../stores/toastStore';
import {
  addDaysISO,
  cn,
  durationMinutes,
  formatRelativeDay,
  formatTimeRange,
  getCapacityInfo,
  getIntensityInfo,
  parseDate,
  todayISO,
} from '../../lib/utils';
import type { ClassLevel, ClassSchedule, CollisionItem } from '../../types';

const DEFAULT_ROOMS = ['Studio 1 - Energy Lab', 'Studio 2 - Zen Room', 'Studio 3 - Ring Zone', 'Cycling Arena'];
const CUSTOM_ROOM = '__custom__';

interface Draft {
  class_type_id: string;
  trainer_id: string;
  room: string;
  customRoom: string;
  class_date: string;
  start_time: string;
  end_time: string;
  max_capacity: string;
}

const emptyDraft = (): Draft => ({
  class_type_id: '',
  trainer_id: '',
  room: '',
  customRoom: '',
  class_date: addDaysISO(1),
  start_time: '09:00',
  end_time: '10:00',
  max_capacity: '15',
});

function addMinutes(time: string, mins: number): string {
  const [h, m] = time.split(':').map(Number);
  const total = Math.min(h * 60 + m + mins, 23 * 60 + 59);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

type CollisionState =
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'clear' }
  | { status: 'conflict'; collisions: CollisionItem[] }
  | { status: 'error'; message: string };

export default function AdminSchedule() {
  const { data, loading, error, reload } = useFetch(
    () => Promise.all([api.classes.schedule(), api.classes.types(), api.trainers.list()]),
    [],
  );
  const schedule = data?.[0] ?? [];
  const types = data?.[1] ?? [];
  const trainers = data?.[2] ?? [];

  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [submitting, setSubmitting] = useState(false);
  const [collision, setCollision] = useState<CollisionState>({ status: 'idle' });
  const [weekOffset, setWeekOffset] = useState(0);
  const [justCreated, setJustCreated] = useState<number | null>(null);
  const [toCancel, setToCancel] = useState<ClassSchedule | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [typeModal, setTypeModal] = useState(false);
  const [recheck, setRecheck] = useState(0);

  const rooms = useMemo(
    () => [...new Set([...DEFAULT_ROOMS, ...schedule.map((s) => s.room_name)])].sort(),
    [schedule],
  );
  const roomName = draft.room === CUSTOM_ROOM ? draft.customRoom.trim() : draft.room;

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));

  // ---- Validation ----
  const timeError =
    draft.start_time && draft.end_time && durationMinutes(draft.start_time, draft.end_time) <= 0
      ? 'End time must be after start'
      : undefined;
  const dateError = draft.class_date && draft.class_date < todayISO() ? 'Date is in the past' : undefined;
  const capacity = Number(draft.max_capacity);
  const capError = draft.max_capacity && (!Number.isInteger(capacity) || capacity < 1 || capacity > 200) ? '1–200' : undefined;
  const readyForCheck = !!(draft.trainer_id && roomName && draft.class_date && draft.start_time && draft.end_time && !timeError);
  const canSubmit =
    readyForCheck && !!draft.class_type_id && !capError && !dateError && collision.status === 'clear' && !submitting;

  // ---- Live collision detection (debounced, server-side) ----
  const checkKey = useDebounced(
    readyForCheck ? `${draft.trainer_id}|${roomName}|${draft.class_date}|${draft.start_time}|${draft.end_time}` : '',
    350,
  );

  useEffect(() => {
    if (!checkKey) {
      setCollision({ status: 'idle' });
      return;
    }
    const [trainer_id, room_name, class_date, start_time, end_time] = checkKey.split('|');
    const ctrl = new AbortController();
    setCollision({ status: 'checking' });
    api.admin
      .checkCollision({ trainer_id: Number(trainer_id), room_name, class_date, start_time, end_time }, ctrl.signal)
      .then((res) =>
        setCollision(res.hasCollision ? { status: 'conflict', collisions: res.collisions } : { status: 'clear' }),
      )
      .catch((err) => {
        if ((err as Error).name !== 'AbortError') setCollision({ status: 'error', message: getErrorMessage(err) });
      });
    return () => ctrl.abort();
  }, [checkKey, recheck]);

  const collisionIds = useMemo(
    () => new Set(collision.status === 'conflict' ? collision.collisions.map((c) => c.schedule_id) : []),
    [collision],
  );

  // ---- Submit ----
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const res = await api.classes.createSchedule({
        class_type_id: Number(draft.class_type_id),
        trainer_id: Number(draft.trainer_id),
        room_name: roomName,
        class_date: draft.class_date,
        start_time: draft.start_time,
        end_time: draft.end_time,
        max_capacity: capacity,
      });
      const typeName = types.find((t) => t.class_type_id === Number(draft.class_type_id))?.type_name ?? 'Class';
      toast.success(`${typeName} scheduled`, `${formatRelativeDay(draft.class_date)} · ${formatTimeRange(draft.start_time, draft.end_time)}`);
      setJustCreated(res.schedule_id);
      setTimeout(() => setJustCreated(null), 3500);
      // jump the board to the new class's week
      const diff = Math.floor((parseDate(draft.class_date).getTime() - parseDate(todayISO()).getTime()) / 86_400_000);
      setWeekOffset(Math.max(0, Math.floor(diff / 7)));
      setDraft((d) => ({ ...d, start_time: d.end_time, end_time: addMinutes(d.end_time, durationMinutes(d.start_time, d.end_time)) }));
      await reload();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        toast.error('Schedule collision', 'Another class already uses that trainer or room at this time.');
        setRecheck((n) => n + 1);
      } else {
        toast.error("Couldn't create class", getErrorMessage(err));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const confirmCancel = async () => {
    if (!toCancel) return;
    setCancelling(true);
    try {
      await api.classes.updateSchedule(toCancel.schedule_id, {
        class_type_id: toCancel.class_type_id,
        trainer_id: toCancel.trainer_id,
        room_name: toCancel.room_name,
        class_date: toCancel.class_date,
        start_time: toCancel.start_time,
        end_time: toCancel.end_time,
        max_capacity: toCancel.max_capacity,
        schedule_status: 'Cancelled',
      });
      toast.info('Class cancelled', `${toCancel.type_name} · ${formatRelativeDay(toCancel.class_date)}`);
      setToCancel(null);
      await reload();
    } catch (err) {
      toast.error("Couldn't cancel class", getErrorMessage(err));
    } finally {
      setCancelling(false);
    }
  };

  // ---- Week board ----
  const weekStart = addDaysISO(weekOffset * 7);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDaysISO(i, parseDate(weekStart)));
  const byDay = useMemo(() => {
    const m: Record<string, ClassSchedule[]> = {};
    schedule.forEach((s) => (m[s.class_date] = [...(m[s.class_date] ?? []), s]));
    Object.values(m).forEach((l) => l.sort((a, b) => a.start_time.localeCompare(b.start_time)));
    return m;
  }, [schedule]);

  const draftType = types.find((t) => t.class_type_id === Number(draft.class_type_id));
  const draftTrainer = trainers.find((t) => t.trainer_id === Number(draft.trainer_id));

  if (loading)
    return (
      <div className="grid gap-6 xl:grid-cols-[400px_1fr]">
        <Skeleton className="h-[640px] rounded-2xl" />
        <Skeleton className="h-[640px] rounded-2xl" />
      </div>
    );
  if (error)
    return <EmptyState icon={<TriangleAlert />} title="Couldn't load schedule" description={error} action={<Button onClick={reload}>Retry</Button>} />;

  return (
    <div>
      <PageHeader
        eyebrow="Operations"
        title="Schedule builder"
        subtitle="Create classes with live trainer & room collision detection."
      />

      <div className="grid gap-6 xl:grid-cols-[400px_1fr]">
        {/* ---------- Builder form ---------- */}
        <Card className="xl:sticky xl:top-24 xl:self-start">
          <CardHeader title="New class" icon={<CalendarPlus className="h-5 w-5" />} />
          <form onSubmit={submit} className="space-y-4">
            <div className="flex items-end gap-2">
              <Select
                containerClassName="flex-1"
                label="Class type"
                icon={<Dumbbell />}
                placeholder="Select type"
                value={draft.class_type_id}
                onChange={(e) => set('class_type_id', e.target.value)}
                options={types.map((t) => ({ value: t.class_type_id, label: `${t.type_name} · ${t.level}` }))}
              />
              <Button variant="secondary" size="icon" className="h-11 w-11 rounded-xl" onClick={() => setTypeModal(true)} aria-label="New class type" icon={<Plus className="h-4 w-4" />} />
            </div>
            <Select
              label="Trainer"
              icon={<User />}
              placeholder="Select trainer"
              value={draft.trainer_id}
              onChange={(e) => set('trainer_id', e.target.value)}
              options={trainers.map((t) => ({ value: t.trainer_id, label: `${t.first_name} ${t.last_name}` }))}
              hint={draftTrainer?.specialization}
            />
            <Select
              label="Room"
              icon={<DoorOpen />}
              placeholder="Select room"
              value={draft.room}
              onChange={(e) => set('room', e.target.value)}
              options={[...rooms.map((r) => ({ value: r, label: r })), { value: CUSTOM_ROOM, label: '+ Other room…' }]}
            />
            {draft.room === CUSTOM_ROOM && (
              <Input placeholder="Room name" icon={<MapPin />} value={draft.customRoom} onChange={(e) => set('customRoom', e.target.value)} autoFocus />
            )}
            <Input label="Date" type="date" min={todayISO()} value={draft.class_date} onChange={(e) => set('class_date', e.target.value)} error={dateError} />
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Start"
                type="time"
                value={draft.start_time}
                onChange={(e) => {
                  const mins = durationMinutes(draft.start_time, draft.end_time);
                  setDraft((d) => ({ ...d, start_time: e.target.value, end_time: mins > 0 ? addMinutes(e.target.value, mins) : d.end_time }));
                }}
              />
              <Input label="End" type="time" value={draft.end_time} onChange={(e) => set('end_time', e.target.value)} error={timeError} />
            </div>
            <div className="flex gap-2">
              {[45, 60, 90].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => set('end_time', addMinutes(draft.start_time, m))}
                  className={cn(
                    'flex-1 rounded-lg border py-1.5 text-xs font-semibold transition-colors cursor-pointer',
                    durationMinutes(draft.start_time, draft.end_time) === m
                      ? 'border-volt bg-volt/10 text-volt'
                      : 'border-border text-text-secondary hover:border-border-hover',
                  )}
                >
                  {m} min
                </button>
              ))}
            </div>
            <Input
              label="Max capacity"
              type="number"
              min={1}
              max={200}
              icon={<Users />}
              value={draft.max_capacity}
              onChange={(e) => set('max_capacity', e.target.value)}
              error={capError}
            />

            <CollisionPanel state={collision} ready={readyForCheck} />

            <Button type="submit" size="lg" fullWidth loading={submitting} disabled={!canSubmit} icon={<CalendarPlus className="h-4 w-4" />}>
              Add to schedule
            </Button>
          </form>
        </Card>

        {/* ---------- Week board ---------- */}
        <Card padding="none" className="overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-border p-4">
            <div>
              <p className="font-display text-lg font-semibold uppercase">
                {weekOffset === 0 ? 'Next 7 days' : `${formatRelativeDay(weekDays[0])} – ${formatRelativeDay(weekDays[6])}`}
              </p>
              <p className="text-xs text-text-muted">
                {weekDays.reduce((n, d) => n + (byDay[d]?.length ?? 0), 0)} classes
              </p>
            </div>
            <div className="flex gap-1">
              <Button variant="secondary" size="icon" onClick={() => setWeekOffset((w) => Math.max(0, w - 1))} disabled={weekOffset === 0} aria-label="Previous week" icon={<ChevronLeft className="h-4 w-4" />} />
              <Button variant="secondary" size="sm" onClick={() => setWeekOffset(0)} disabled={weekOffset === 0}>
                Today
              </Button>
              <Button variant="secondary" size="icon" onClick={() => setWeekOffset((w) => w + 1)} aria-label="Next week" icon={<ChevronRight className="h-4 w-4" />} />
            </div>
          </div>

          <div className="overflow-x-auto">
            <div className="grid min-w-[980px] grid-cols-7 divide-x divide-border">
              {weekDays.map((d) => {
                const list = byDay[d] ?? [];
                const date = parseDate(d);
                const isToday = d === todayISO();
                const showGhost = d === draft.class_date && readyForCheck && !!draftType;
                return (
                  <div key={d} className={cn('flex min-h-[520px] flex-col', isToday && 'bg-volt/[0.03]')}>
                    <div className="sticky top-0 border-b border-border px-3 py-2.5 text-center">
                      <p className={cn('text-[10px] font-bold uppercase tracking-wider', isToday ? 'text-volt' : 'text-text-muted')}>
                        {date.toLocaleDateString('en-US', { weekday: 'short' })}
                      </p>
                      <p className={cn('font-display text-xl font-bold', isToday && 'text-volt')}>{date.getDate()}</p>
                    </div>
                    <div className="flex-1 space-y-2 p-2">
                      <AnimatePresence>
                        {showGhost && (
                          <motion.div
                            key="ghost"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className={cn(
                              'rounded-lg border-2 border-dashed p-2 text-xs',
                              collision.status === 'conflict' ? 'border-danger/60 bg-danger/5' : 'border-volt/50 bg-volt/5',
                            )}
                          >
                            <p className="font-bold uppercase tracking-wider text-[9px] text-text-muted">Draft</p>
                            <p className="font-semibold">{draftType?.type_name}</p>
                            <p className="text-text-secondary">{formatTimeRange(draft.start_time, draft.end_time)}</p>
                          </motion.div>
                        )}
                      </AnimatePresence>
                      {list.length === 0 && !showGhost && <p className="pt-6 text-center text-xs text-text-muted">—</p>}
                      {list.map((s) => (
                        <ScheduleBlock
                          key={s.schedule_id}
                          s={s}
                          conflict={collisionIds.has(s.schedule_id)}
                          fresh={justCreated === s.schedule_id}
                          onCancel={() => setToCancel(s)}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>
      </div>

      {/* Cancel class modal */}
      <Modal
        open={!!toCancel}
        onClose={() => setToCancel(null)}
        locked={cancelling}
        size="sm"
        icon={<Ban className="h-5 w-5" />}
        title="Cancel this class?"
        description={toCancel ? `${toCancel.type_name} · ${formatRelativeDay(toCancel.class_date)}, ${formatTimeRange(toCancel.start_time, toCancel.end_time)}` : undefined}
        footer={
          <>
            <Button variant="secondary" onClick={() => setToCancel(null)} disabled={cancelling}>
              Keep class
            </Button>
            <Button variant="danger" onClick={confirmCancel} loading={cancelling}>
              Cancel class
            </Button>
          </>
        }
      >
        <p className="text-sm text-text-secondary">
          {toCancel?.current_booked
            ? `${toCancel.current_booked} member(s) are booked. The class will be removed from the public schedule.`
            : 'The class will be removed from the public schedule.'}
        </p>
      </Modal>

      <NewTypeModal
        open={typeModal}
        onClose={() => setTypeModal(false)}
        onCreated={(id) => {
          setTypeModal(false);
          void reload().then(() => set('class_type_id', String(id)));
        }}
      />
    </div>
  );
}

// ------------------------------------------------------------
function CollisionPanel({ state, ready }: { state: CollisionState; ready: boolean }) {
  if (!ready)
    return (
      <div className="rounded-xl border border-border bg-obsidian-light/60 px-4 py-3 text-xs text-text-muted">
        Pick a trainer, room, date and time to run collision detection.
      </div>
    );

  return (
    <AnimatePresence mode="wait">
      {state.status === 'checking' || state.status === 'idle' ? (
        <motion.div key="checking" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-2 rounded-xl border border-border bg-obsidian-light/60 px-4 py-3 text-sm text-text-secondary">
          <LoaderCircle className="h-4 w-4 animate-spin" /> Checking for conflicts…
        </motion.div>
      ) : state.status === 'clear' ? (
        <motion.div key="clear" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex items-center gap-2 rounded-xl border border-success/30 bg-success/10 px-4 py-3 text-sm text-success">
          <CircleCheck className="h-4 w-4" /> No conflicts — trainer and room are free.
        </motion.div>
      ) : state.status === 'error' ? (
        <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
          Couldn't verify: {state.message}
        </motion.div>
      ) : (
        <motion.div
          key="conflict"
          initial={{ opacity: 0, x: 0 }}
          animate={{ opacity: 1, x: [0, -5, 5, -3, 0] }}
          exit={{ opacity: 0 }}
          className="rounded-xl border border-danger/40 bg-danger/10 p-4"
        >
          <p className="flex items-center gap-2 text-sm font-semibold text-danger">
            <ShieldAlert className="h-4 w-4" /> {state.collisions.length} conflict{state.collisions.length > 1 ? 's' : ''} found
          </p>
          <ul className="mt-2 space-y-1.5">
            {state.collisions.map((c) => (
              <li key={c.schedule_id} className="text-xs text-text-secondary">
                <span className="font-semibold text-text-primary">{c.type_name}</span> · {formatTimeRange(c.start_time, c.end_time)}
                <br />
                <span className="text-text-muted">
                  {c.first_name} {c.last_name} · {c.room_name}
                </span>
              </li>
            ))}
          </ul>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ------------------------------------------------------------
function ScheduleBlock({
  s,
  conflict,
  fresh,
  onCancel,
}: {
  s: ClassSchedule;
  conflict: boolean;
  fresh: boolean;
  onCancel: () => void;
}) {
  const intensity = getIntensityInfo(s.level);
  const cap = getCapacityInfo(s.current_booked, s.max_capacity);
  return (
    <motion.div
      layout
      initial={fresh ? { opacity: 0, scale: 0.8 } : false}
      animate={{ opacity: 1, scale: 1 }}
      className={cn(
        'group relative rounded-lg border bg-surface p-2 text-xs transition-colors',
        conflict
          ? 'border-danger bg-danger/10 shadow-[0_0_12px_rgba(239,68,68,0.35)]'
          : fresh
            ? 'border-volt glow-volt-subtle'
            : 'border-border hover:border-border-hover',
      )}
    >
      <div className={cn('absolute inset-y-2 left-0 w-0.5 rounded-full bg-current', intensity.textClass)} />
      <div className="pl-1.5">
        <p className="flex items-center gap-1 font-semibold text-text-secondary">
          <Clock className="h-3 w-3" /> {s.start_time}–{s.end_time}
        </p>
        <p className="mt-0.5 truncate font-semibold text-text-primary" title={s.type_name}>
          {s.type_name}
        </p>
        <p className="truncate text-text-muted" title={s.room_name}>
          {s.room_name}
        </p>
        <p className="truncate text-text-muted">{s.trainer_first_name}</p>
        <div className="mt-1.5 flex items-center justify-between">
          <span className={cn('font-semibold tabular-nums', cap.isFull ? 'text-danger' : cap.nearlyFull ? 'text-warning' : 'text-text-secondary')}>
            {s.current_booked}/{s.max_capacity}
          </span>
          {conflict && <Badge tone="danger">Clash</Badge>}
          {fresh && <Badge tone="volt">New</Badge>}
        </div>
      </div>
      <button
        onClick={onCancel}
        className="absolute right-1 top-1 hidden rounded p-1 text-text-muted hover:bg-danger/15 hover:text-danger group-hover:block cursor-pointer"
        aria-label="Cancel class"
        title="Cancel class"
      >
        <Ban className="h-3 w-3" />
      </button>
    </motion.div>
  );
}

// ------------------------------------------------------------
function NewTypeModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (id: number) => void }) {
  const [name, setName] = useState('');
  const [level, setLevel] = useState<ClassLevel>('Intermediate');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const t = await api.classes.createType(name.trim(), level);
      toast.success('Class type created', t.type_name);
      setName('');
      onCreated(Number(t.class_type_id));
    } catch (err) {
      toast.error("Couldn't create type", getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      locked={saving}
      size="sm"
      icon={<Dumbbell className="h-5 w-5" />}
      title="New class type"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={save} loading={saving} disabled={!name.trim()}>
            Create
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input label="Name" placeholder="e.g. Kettlebell Burn" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        <Select
          label="Level"
          value={level}
          onChange={(e) => setLevel(e.target.value as ClassLevel)}
          options={['Beginner', 'Intermediate', 'Advanced'].map((l) => ({ value: l, label: l }))}
        />
      </div>
    </Modal>
  );
}
