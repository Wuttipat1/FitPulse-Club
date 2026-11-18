import { Router, Request, Response } from 'express';
import { execute, query, queryOne } from '../db/database';
import { authenticateToken, requireRole } from '../middleware/auth';
import { HttpError, intParam, sendError } from '../lib/http';

const router = Router();

/** Phone numbers as a JSON array, aggregated in the same query. */
const PHONES_SQL = `COALESCE((SELECT array_agg(tp.phone) FROM trainer_phone tp WHERE tp.trainer_id = t.trainer_id), '{}') AS phones`;

async function getTrainerId(userId: number): Promise<number> {
  const trainer = await queryOne<{ trainer_id: number }>(`SELECT trainer_id FROM trainer WHERE user_id = $1`, [userId]);
  if (!trainer) throw new HttpError(404, 'Trainer not found');
  return trainer.trainer_id;
}

/** 403 unless the class belongs to this trainer. */
async function assertOwnsClass(scheduleId: number, trainerId: number) {
  const schedule = await queryOne(`SELECT schedule_id FROM class_schedule WHERE schedule_id = $1 AND trainer_id = $2`, [
    scheduleId,
    trainerId,
  ]);
  if (!schedule) throw new HttpError(403, 'You are not assigned to this class');
}

// GET / - List all active trainers (public, no auth)
router.get('/', async (_req: Request, res: Response) => {
  try {
    const trainers = await query(
      `SELECT t.*, ua.username, ${PHONES_SQL}
       FROM trainer t
       JOIN user_account ua ON t.user_id = ua.user_id
       WHERE ua.account_status = 'Active' AND t.hire_date IS NOT NULL
       ORDER BY t.first_name, t.last_name`,
    );
    return res.json(trainers);
  } catch (err) {
    return sendError(res, err, 'List trainers error');
  }
});

// GET /me - Current trainer profile (auth + Trainer)
router.get('/me', authenticateToken, requireRole('Trainer'), async (req: Request, res: Response) => {
  try {
    const trainer = await queryOne(
      `SELECT t.*, ua.username, ua.account_status, ${PHONES_SQL}
       FROM trainer t
       JOIN user_account ua ON t.user_id = ua.user_id
       WHERE t.user_id = $1`,
      [req.user!.user_id],
    );

    if (!trainer) {
      return res.status(404).json({ error: 'Trainer not found' });
    }

    return res.json(trainer);
  } catch (err) {
    return sendError(res, err, 'Get trainer profile error');
  }
});

// GET /me/classes - Trainer's upcoming classes (auth + Trainer)
router.get('/me/classes', authenticateToken, requireRole('Trainer'), async (req: Request, res: Response) => {
  try {
    const trainerId = await getTrainerId(req.user!.user_id);

    const classes = await query(
      `SELECT cs.*, ct.type_name, ct.level,
         (SELECT COUNT(*) FROM class_booking
           WHERE schedule_id = cs.schedule_id AND booking_status IN ('Booked', 'Attended')) AS current_booked
       FROM class_schedule cs
       JOIN class_type ct ON cs.class_type_id = ct.class_type_id
       WHERE cs.trainer_id = $1 AND cs.class_date >= CURRENT_DATE AND cs.schedule_status <> 'Cancelled'
       ORDER BY cs.class_date, cs.start_time`,
      [trainerId],
    );

    return res.json(classes);
  } catch (err) {
    return sendError(res, err, 'Get trainer classes error');
  }
});

// POST /classes/:scheduleId/checkin - Check in a member (auth + Trainer)
router.post('/classes/:scheduleId/checkin', authenticateToken, requireRole('Trainer'), async (req: Request, res: Response) => {
  try {
    const scheduleId = intParam(req.params.scheduleId, 'schedule id');
    const { booking_id, status } = req.body;

    if (!booking_id || !status || !['Attended', 'NoShow'].includes(status)) {
      return res.status(400).json({ error: 'booking_id and status (Attended or NoShow) required' });
    }

    const trainerId = await getTrainerId(req.user!.user_id);
    await assertOwnsClass(scheduleId, trainerId);

    // Only members who hold a seat can be checked in (not waitlisted / cancelled)
    const changed = await execute(
      `UPDATE class_booking SET booking_status = $1
       WHERE booking_id = $2 AND schedule_id = $3 AND booking_status IN ('Booked', 'Attended', 'NoShow')`,
      [status, booking_id, scheduleId],
    );

    if (changed === 0) {
      return res.status(404).json({ error: 'Booking not found for this schedule' });
    }

    return res.json({ message: `Member marked as ${status}` });
  } catch (err) {
    return sendError(res, err, 'Checkin error');
  }
});

// GET /classes/:scheduleId/roster - Get class roster (auth + Trainer)
router.get('/classes/:scheduleId/roster', authenticateToken, requireRole('Trainer'), async (req: Request, res: Response) => {
  try {
    const scheduleId = intParam(req.params.scheduleId, 'schedule id');
    const trainerId = await getTrainerId(req.user!.user_id);
    await assertOwnsClass(scheduleId, trainerId);

    const roster = await query(
      `SELECT cb.*, m.first_name, m.last_name
       FROM class_booking cb
       JOIN member m ON cb.member_id = m.member_id
       WHERE cb.schedule_id = $1 AND cb.booking_status IN ('Booked', 'Attended', 'NoShow')
       ORDER BY cb.booking_time`,
      [scheduleId],
    );

    return res.json(roster);
  } catch (err) {
    return sendError(res, err, 'Get roster error');
  }
});

export default router;
