import { motion } from 'framer-motion';
import { Check, Clock, Hourglass, MapPin, User, Zap } from 'lucide-react';
import { Badge, Button, CapacityBar, IntensityMeter } from '../ui';
import {
  cn,
  durationMinutes,
  formatRelativeDay,
  formatTimeRange,
  getCapacityInfo,
  getIntensityInfo,
} from '../../lib/utils';
import type { BookingStatus, ClassSchedule } from '../../types';

export interface ClassCardProps {
  cls: ClassSchedule;
  /** Current member's booking state for this class, if any */
  myStatus?: { status: BookingStatus; position: number | null };
  onBook?: (cls: ClassSchedule, el: HTMLElement) => void;
  booking?: boolean;
  index?: number;
}

export function ClassCard({ cls, myStatus, onBook, booking, index = 0 }: ClassCardProps) {
  const intensity = getIntensityInfo(cls.level);
  const cap = getCapacityInfo(cls.current_booked, cls.max_capacity);
  const mins = durationMinutes(cls.start_time, cls.end_time);
  const isBooked = myStatus?.status === 'Booked' || myStatus?.status === 'Attended';
  const isWaitlisted = myStatus?.status === 'Waitlist';

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ delay: Math.min(index * 0.04, 0.4), duration: 0.35 }}
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-2xl border bg-surface/80 backdrop-blur-xl transition-all duration-300',
        'hover:-translate-y-1 hover:shadow-xl hover:shadow-black/40',
        isBooked ? 'border-volt/40 glow-volt-subtle' : 'border-border hover:border-border-hover',
      )}
    >
      {/* Header band */}
      <div className={cn('relative overflow-hidden bg-linear-to-br px-5 pt-5 pb-4', intensity.gradient)}>
        <div className="absolute -right-6 -top-8 font-display text-[120px] font-bold leading-none text-white/[0.03] select-none">
          {cls.type_name.charAt(0)}
        </div>
        <div className="relative flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className={cn('flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider', intensity.textClass)}>
              <IntensityMeter level={intensity.intensity} />
              {intensity.label}
            </span>
          </div>
          <span className="rounded-full bg-black/30 px-2.5 py-1 text-[11px] font-semibold text-text-primary backdrop-blur">
            {formatRelativeDay(cls.class_date)}
          </span>
        </div>
        <h3 className="relative mt-3 font-display text-2xl font-bold uppercase leading-tight tracking-tight">
          {cls.type_name}
        </h3>
        <p className="relative mt-1 flex items-center gap-1.5 text-sm text-text-primary/90">
          <Clock className="h-3.5 w-3.5" />
          {formatTimeRange(cls.start_time, cls.end_time)}
          <span className="text-text-muted">· {mins} min</span>
        </p>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-4 px-5 pb-5 pt-4">
        <div className="space-y-1.5 text-sm">
          <p className="flex items-center gap-2 text-text-secondary">
            <User className="h-3.5 w-3.5 text-text-muted" />
            <span className="text-text-primary">
              {cls.trainer_first_name} {cls.trainer_last_name}
            </span>
          </p>
          <p className="flex items-center gap-2 text-text-secondary">
            <MapPin className="h-3.5 w-3.5 text-text-muted" />
            {cls.room_name}
          </p>
        </div>

        {cap.nearlyFull && !isBooked && (
          <Badge tone="warning" dot pulse className="self-start">
            Almost full — {cap.spotsLeft} left
          </Badge>
        )}

        <CapacityBar current={cls.current_booked} max={cls.max_capacity} />

        <div className="mt-auto">
          {isBooked ? (
            <div className="flex h-11 items-center justify-center gap-2 rounded-xl border border-volt/40 bg-volt/10 text-sm font-bold uppercase tracking-wider text-volt">
              <Check className="h-4 w-4" /> You're in
            </div>
          ) : isWaitlisted ? (
            <div className="flex h-11 items-center justify-center gap-2 rounded-xl border border-warning/40 bg-warning/10 text-sm font-bold uppercase tracking-wider text-warning">
              <Hourglass className="h-4 w-4" /> Waitlist #{myStatus?.position ?? '–'}
            </div>
          ) : (
            <Button
              fullWidth
              size="lg"
              variant={cap.isFull ? 'outline' : 'primary'}
              loading={booking}
              onClick={(e) => onBook?.(cls, e.currentTarget)}
              icon={!booking && (cap.isFull ? <Hourglass className="h-4 w-4" /> : <Zap className="h-4 w-4" fill="currentColor" />)}
              className="uppercase tracking-wider"
            >
              {cap.isFull ? 'Join waitlist' : 'Book now'}
            </Button>
          )}
        </div>
      </div>

    </motion.article>
  );
}
