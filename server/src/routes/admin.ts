import { Router, Request, Response } from 'express';
import { execute, query, queryOne, withTransaction } from '../db/database';
import { HttpError, intParam, sendError } from '../lib/http';

const router = Router();

// GET /stats - KPI metrics
router.get('/stats', async (_req: Request, res: Response) => {
  try {
    const stats = await queryOne(
      `SELECT
         (SELECT COUNT(*) FROM member WHERE end_date >= CURRENT_DATE) AS "totalActiveMembers",
         (SELECT COUNT(*) FROM class_schedule
           WHERE class_date = CURRENT_DATE AND schedule_status <> 'Cancelled') AS "todaysClasses",
         (SELECT COUNT(*) FROM user_account
           WHERE role = 'Trainer' AND account_status = 'Pending') AS "pendingTrainers"`,
    );

    // Average fill % across today's classes
    const today = await query<{ max_capacity: number; current_booked: number }>(
      `SELECT cs.max_capacity,
         (SELECT COUNT(*) FROM class_booking
           WHERE schedule_id = cs.schedule_id AND booking_status IN ('Booked', 'Attended')) AS current_booked
       FROM class_schedule cs
       WHERE cs.class_date = CURRENT_DATE AND cs.schedule_status <> 'Cancelled'`,
    );
    const occupancyRate = today.length
      ? Math.round(today.reduce((sum, s) => sum + (s.current_booked / s.max_capacity) * 100, 0) / today.length)
      : 0;

    return res.json({
      totalActiveMembers: stats!.totalActiveMembers,
      todaysClasses: stats!.todaysClasses,
      occupancyRate,
      pendingTrainers: stats!.pendingTrainers,
    });
  } catch (err) {
    return sendError(res, err, 'Get stats error');
  }
});

// GET /trainers/pending - List pending trainer applications
router.get('/trainers/pending', async (_req: Request, res: Response) => {
  try {
    const trainers = await query(
      `SELECT t.*, ua.username, ua.created_at, ua.account_status,
         COALESCE((SELECT array_agg(tp.phone) FROM trainer_phone tp WHERE tp.trainer_id = t.trainer_id), '{}') AS phones
       FROM trainer t
       JOIN user_account ua ON t.user_id = ua.user_id
       WHERE ua.account_status = 'Pending' AND ua.role = 'Trainer'
       ORDER BY ua.created_at`,
    );
    return res.json(trainers);
  } catch (err) {
    return sendError(res, err, 'Get pending trainers error');
  }
});

// POST /trainers/:userId/approve - Approve a trainer
router.post('/trainers/:userId/approve', async (req: Request, res: Response) => {
  try {
    const userId = intParam(req.params.userId, 'user id');

    const trainer = await withTransaction(async (c) => {
      const updated = await execute(
        `UPDATE user_account SET account_status = 'Active'
         WHERE user_id = $1 AND role = 'Trainer' AND account_status = 'Pending'`,
        [userId],
        c,
      );
      if (updated === 0) throw new HttpError(404, 'Pending trainer not found');

      await c.query(`UPDATE trainer SET hire_date = CURRENT_DATE WHERE user_id = $1`, [userId]);

      return queryOne(
        `SELECT t.*, ua.username, ua.account_status
         FROM trainer t JOIN user_account ua ON t.user_id = ua.user_id
         WHERE t.user_id = $1`,
        [userId],
        c,
      );
    });

    return res.json({ message: 'Trainer approved successfully', trainer });
  } catch (err) {
    return sendError(res, err, 'Approve trainer error');
  }
});

// POST /trainers/:userId/reject - Reject a trainer
router.post('/trainers/:userId/reject', async (req: Request, res: Response) => {
  try {
    const userId = intParam(req.params.userId, 'user id');

    // ON DELETE CASCADE removes the trainer row and trainer_phone rows
    const deleted = await execute(
      `DELETE FROM user_account WHERE user_id = $1 AND role = 'Trainer' AND account_status = 'Pending'`,
      [userId],
    );
    if (deleted === 0) return res.status(404).json({ error: 'Pending trainer not found' });

    return res.json({ message: 'Trainer application rejected' });
  } catch (err) {
    return sendError(res, err, 'Reject trainer error');
  }
});

// POST /schedule/check-collision - Check for scheduling conflicts
router.post('/schedule/check-collision', async (req: Request, res: Response) => {
  try {
    const { trainer_id, room_name, class_date, start_time, end_time } = req.body;
    if (!trainer_id || !room_name || !class_date || !start_time || !end_time) {
      return res.status(400).json({ error: 'trainer_id, room_name, class_date, start_time and end_time required' });
    }

    const collisions = await query(
      `SELECT cs.*, ct.type_name, t.first_name, t.last_name
       FROM class_schedule cs
       JOIN class_type ct ON cs.class_type_id = ct.class_type_id
       JOIN trainer t ON cs.trainer_id = t.trainer_id
       WHERE cs.class_date = $1 AND cs.schedule_status <> 'Cancelled'
         AND (cs.trainer_id = $2 OR cs.room_name = $3)
         AND NOT (cs.end_time <= $4 OR cs.start_time >= $5)
       ORDER BY cs.start_time`,
      [class_date, trainer_id, room_name, start_time, end_time],
    );

    return res.json({ hasCollision: collisions.length > 0, collisions });
  } catch (err) {
    return sendError(res, err, 'Check collision error');
  }
});

// GET /bookings/recent - Recent bookings for activity feed
router.get('/bookings/recent', async (_req: Request, res: Response) => {
  try {
    const bookings = await query(
      `SELECT cb.*, m.first_name, m.last_name, ct.type_name, cs.class_date, cs.start_time
       FROM class_booking cb
       JOIN member m ON cb.member_id = m.member_id
       JOIN class_schedule cs ON cb.schedule_id = cs.schedule_id
       JOIN class_type ct ON cs.class_type_id = ct.class_type_id
       ORDER BY cb.booking_time DESC, cb.booking_id DESC
       LIMIT 10`,
    );
    return res.json(bookings);
  } catch (err) {
    return sendError(res, err, 'Get recent bookings error');
  }
});

export default router;
