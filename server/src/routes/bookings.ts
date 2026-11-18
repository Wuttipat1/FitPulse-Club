import { Router, Request, Response } from 'express';
import { query, queryOne, withTransaction } from '../db/database';
import { HttpError, intParam, isUniqueViolation, sendError } from '../lib/http';

const router = Router();

const COUNT_SEATED_SQL = `SELECT COUNT(*) AS count FROM class_booking
  WHERE schedule_id = $1 AND booking_status IN ('Booked', 'Attended')`;

// POST / - Book a class (or join its waitlist when full)
router.post('/', async (req: Request, res: Response) => {
  try {
    const scheduleId = intParam(req.body.schedule_id, 'schedule_id');
    const memberId = req.user!.member_id;
    if (!memberId) throw new HttpError(400, 'Member ID not found in token');

    const result = await withTransaction(async (c) => {
      // 1. Lock the class row: concurrent bookings for this class queue up here,
      //    so two people can't both take the last seat.
      const schedule = await queryOne(`SELECT * FROM class_schedule WHERE schedule_id = $1 FOR UPDATE`, [scheduleId], c);
      if (!schedule) throw new HttpError(404, 'Class schedule not found');
      if (schedule.schedule_status === 'Cancelled') throw new HttpError(400, 'This class has been cancelled');

      // 2. Member must have an active plan
      const member = await queryOne(
        `SELECT m.member_id, m.plan_id, mp.class_quota,
                (m.plan_id IS NOT NULL AND m.end_date IS NOT NULL AND m.end_date >= CURRENT_DATE) AS has_active_plan
         FROM member m
         LEFT JOIN membership_plan mp ON m.plan_id = mp.plan_id
         WHERE m.user_id = $1`,
        [req.user!.user_id],
        c,
      );
      if (!member) throw new HttpError(404, 'Member not found');
      if (!member.has_active_plan) throw new HttpError(400, 'No active membership plan');

      // 3. Monthly class quota (NULL quota = unlimited)
      if (member.class_quota !== null) {
        const used = await queryOne<{ count: number }>(
          `SELECT COUNT(*) AS count FROM class_booking cb
           JOIN class_schedule cs ON cb.schedule_id = cs.schedule_id
           WHERE cb.member_id = $1 AND cb.booking_status IN ('Booked', 'Attended', 'NoShow')
             AND to_char(cs.class_date, 'YYYY-MM') = to_char(CURRENT_DATE, 'YYYY-MM')`,
          [memberId],
          c,
        );
        if (used!.count >= member.class_quota) {
          throw new HttpError(400, `Monthly class quota reached (${used!.count}/${member.class_quota})`);
        }
      }

      // 4. No duplicate live booking
      const existing = await queryOne(
        `SELECT booking_id FROM class_booking
         WHERE member_id = $1 AND schedule_id = $2 AND booking_status <> 'Cancelled'`,
        [memberId, scheduleId],
        c,
      );
      if (existing) throw new HttpError(400, 'Already booked for this class');

      // 5. Book a seat, or join the waitlist
      const seated = (await queryOne<{ count: number }>(COUNT_SEATED_SQL, [scheduleId], c))!.count;

      if (seated < schedule.max_capacity) {
        const booking = await queryOne(
          `INSERT INTO class_booking (member_id, schedule_id, booking_status, waitlist_position)
           VALUES ($1, $2, 'Booked', NULL) RETURNING *`,
          [memberId, scheduleId],
          c,
        );
        if (seated + 1 >= schedule.max_capacity) {
          await c.query(`UPDATE class_schedule SET schedule_status = 'Full' WHERE schedule_id = $1`, [scheduleId]);
        }
        return { status: 201, body: { booking, status: 'booked' } };
      }

      const next = await queryOne<{ pos: number }>(
        `SELECT COALESCE(MAX(waitlist_position), 0) + 1 AS pos
         FROM class_booking WHERE schedule_id = $1 AND booking_status = 'Waitlist'`,
        [scheduleId],
        c,
      );
      const booking = await queryOne(
        `INSERT INTO class_booking (member_id, schedule_id, booking_status, waitlist_position)
         VALUES ($1, $2, 'Waitlist', $3) RETURNING *`,
        [memberId, scheduleId, next!.pos],
        c,
      );
      return { status: 201, body: { booking, status: 'waitlist', position: next!.pos } };
    });

    return res.status(result.status).json(result.body);
  } catch (err) {
    if (isUniqueViolation(err)) return res.status(400).json({ error: 'Already booked for this class' });
    return sendError(res, err, 'Book class error');
  }
});

// DELETE /:id - Cancel a booking (auto-promotes the first waitlisted member)
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const bookingId = intParam(req.params.id, 'booking id');
    const memberId = req.user!.member_id;

    const promotedMember = await withTransaction(async (c) => {
      const found = await queryOne(`SELECT * FROM class_booking WHERE booking_id = $1 AND member_id = $2`, [bookingId, memberId], c);
      if (!found) throw new HttpError(404, 'Booking not found');

      // Lock the class first (same order as POST /) to avoid deadlocks, then re-read the booking.
      const scheduleId: number = found.schedule_id;
      const schedule = await queryOne(`SELECT * FROM class_schedule WHERE schedule_id = $1 FOR UPDATE`, [scheduleId], c);
      const booking = await queryOne(`SELECT * FROM class_booking WHERE booking_id = $1 FOR UPDATE`, [bookingId], c);

      if (booking.booking_status === 'Cancelled') throw new HttpError(400, 'Booking already cancelled');

      const oldStatus: string = booking.booking_status;
      const oldPosition: number | null = booking.waitlist_position;

      await c.query(
        `UPDATE class_booking SET booking_status = 'Cancelled', waitlist_position = NULL WHERE booking_id = $1`,
        [bookingId],
      );

      // Leaving the waitlist: close the gap behind you
      if (oldStatus === 'Waitlist' && oldPosition !== null) {
        await c.query(
          `UPDATE class_booking SET waitlist_position = waitlist_position - 1
           WHERE schedule_id = $1 AND booking_status = 'Waitlist' AND waitlist_position > $2`,
          [scheduleId, oldPosition],
        );
        return null;
      }

      if (oldStatus !== 'Booked') return null;

      // A seat opened up: promote the first person in line (FIFO)
      let promoted = null;
      const promotee = await queryOne(
        `SELECT cb.booking_id, cb.member_id, m.first_name, m.last_name
         FROM class_booking cb
         JOIN member m ON cb.member_id = m.member_id
         WHERE cb.schedule_id = $1 AND cb.booking_status = 'Waitlist'
         ORDER BY cb.waitlist_position ASC
         LIMIT 1
         FOR UPDATE OF cb`,
        [scheduleId],
        c,
      );

      if (promotee) {
        await c.query(`UPDATE class_booking SET booking_status = 'Booked', waitlist_position = NULL WHERE booking_id = $1`, [
          promotee.booking_id,
        ]);
        await c.query(
          `UPDATE class_booking SET waitlist_position = waitlist_position - 1
           WHERE schedule_id = $1 AND booking_status = 'Waitlist'`,
          [scheduleId],
        );
        promoted = {
          booking_id: promotee.booking_id,
          member_id: promotee.member_id,
          first_name: promotee.first_name,
          last_name: promotee.last_name,
        };
      }

      const seated = (await queryOne<{ count: number }>(COUNT_SEATED_SQL, [scheduleId], c))!.count;
      if (seated < schedule.max_capacity && schedule.schedule_status === 'Full') {
        await c.query(`UPDATE class_schedule SET schedule_status = 'Open' WHERE schedule_id = $1`, [scheduleId]);
      }

      return promoted;
    });

    return res.json({ cancelled: true, promoted_member: promotedMember });
  } catch (err) {
    return sendError(res, err, 'Cancel booking error');
  }
});

// GET /my - Get current member's bookings
router.get('/my', async (req: Request, res: Response) => {
  try {
    const bookings = await query(
      `SELECT cb.*, cs.class_date, cs.start_time, cs.end_time, cs.room_name, cs.max_capacity, cs.schedule_status,
         ct.type_name, ct.level, t.first_name AS trainer_first_name, t.last_name AS trainer_last_name,
         (SELECT COUNT(*) FROM class_booking
           WHERE schedule_id = cs.schedule_id AND booking_status IN ('Booked', 'Attended')) AS current_booked
       FROM class_booking cb
       JOIN class_schedule cs ON cb.schedule_id = cs.schedule_id
       JOIN class_type ct ON cs.class_type_id = ct.class_type_id
       JOIN trainer t ON cs.trainer_id = t.trainer_id
       WHERE cb.member_id = $1
       ORDER BY cs.class_date DESC, cs.start_time DESC`,
      [req.user!.member_id],
    );

    return res.json(bookings);
  } catch (err) {
    return sendError(res, err, 'Get my bookings error');
  }
});

export default router;
