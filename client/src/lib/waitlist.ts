import type { MyBooking } from '../types';

/**
 * Client-side memory of which bookings were on the waitlist, so we can tell the
 * member "you got promoted!" the next time we see that booking as Booked.
 */
const key = (memberId?: number) => `fitpulse-waitlist-${memberId ?? 'anon'}`;

function read(memberId?: number): number[] {
  try {
    const v = JSON.parse(localStorage.getItem(key(memberId)) || '[]');
    return Array.isArray(v) ? v.filter((x): x is number => typeof x === 'number') : [];
  } catch {
    return [];
  }
}

function write(memberId: number | undefined, ids: number[]) {
  try {
    localStorage.setItem(key(memberId), JSON.stringify([...new Set(ids)]));
  } catch {
    /* storage unavailable — promotion banner just won't show */
  }
}

/** Remember a freshly-created waitlist booking. */
export function watchWaitlistBooking(memberId: number | undefined, bookingId: number) {
  write(memberId, [...read(memberId), bookingId]);
}

/**
 * Compare stored waitlist ids with the latest bookings.
 * Returns bookings that were promoted to Booked and re-syncs storage.
 */
export function syncWaitlist(memberId: number | undefined, bookings: MyBooking[]): MyBooking[] {
  const watched = read(memberId);
  const promoted = bookings.filter((b) => watched.includes(b.booking_id) && b.booking_status === 'Booked');
  write(
    memberId,
    bookings.filter((b) => b.booking_status === 'Waitlist').map((b) => b.booking_id),
  );
  return promoted;
}
