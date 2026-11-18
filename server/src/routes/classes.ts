import { Router, Request, Response } from 'express';
import { execute, query, queryOne, withTransaction } from '../db/database';
import { authenticateToken, requireRole } from '../middleware/auth';
import { HttpError, intParam, sendError } from '../lib/http';

const router = Router();

const LEVELS = ['Beginner', 'Intermediate', 'Advanced'];

// GET /types - List all class types (public)
router.get('/types', async (_req: Request, res: Response) => {
  try {
    const types = await query(`SELECT * FROM class_type ORDER BY class_type_id`);
    return res.json(types);
  } catch (err) {
    return sendError(res, err, 'List class types error');
  }
});

// GET /schedule - List class schedules with filters (public)
router.get('/schedule', async (req: Request, res: Response) => {
  try {
    const where: string[] = [`cs.schedule_status <> 'Cancelled'`];
    const params: unknown[] = [];
    const add = (sql: string, value: unknown) => {
      params.push(value);
      where.push(sql.replace('?', `$${params.length}`));
    };

    if (req.query.date) add('cs.class_date = ?', String(req.query.date));
    if (req.query.class_type_id) add('cs.class_type_id = ?', intParam(req.query.class_type_id, 'class_type_id'));
    if (req.query.trainer_id) add('cs.trainer_id = ?', intParam(req.query.trainer_id, 'trainer_id'));

    const schedules = await query(
      `SELECT cs.*, ct.type_name, ct.level,
         t.first_name AS trainer_first_name, t.last_name AS trainer_last_name, t.specialization,
         (SELECT COUNT(*) FROM class_booking
           WHERE schedule_id = cs.schedule_id AND booking_status IN ('Booked', 'Attended')) AS current_booked
       FROM class_schedule cs
       JOIN class_type ct ON cs.class_type_id = ct.class_type_id
       JOIN trainer t ON cs.trainer_id = t.trainer_id
       WHERE ${where.join(' AND ')}
       ORDER BY cs.class_date, cs.start_time`,
      params,
    );
    return res.json(schedules);
  } catch (err) {
    return sendError(res, err, 'List schedule error');
  }
});

// POST /types - Create a class type (admin only)
router.post('/types', authenticateToken, requireRole('Admin'), async (req: Request, res: Response) => {
  try {
    const { type_name, level } = req.body;

    if (!type_name || !level) {
      return res.status(400).json({ error: 'type_name and level required' });
    }
    if (!LEVELS.includes(level)) {
      return res.status(400).json({ error: 'level must be Beginner, Intermediate, or Advanced' });
    }

    const type = await queryOne(`INSERT INTO class_type (type_name, level) VALUES ($1, $2) RETURNING *`, [type_name, level]);
    return res.status(201).json(type);
  } catch (err) {
    return sendError(res, err, 'Create class type error', 'Class type name already exists');
  }
});

// POST /schedule - Create a class schedule (admin only)
router.post('/schedule', authenticateToken, requireRole('Admin'), async (req: Request, res: Response) => {
  try {
    const { class_type_id, trainer_id, room_name, class_date, start_time, end_time, max_capacity } = req.body;

    if (!class_type_id || !trainer_id || !room_name || !class_date || !start_time || !end_time || !max_capacity) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const created = await withTransaction(async (c) => {
      // Serialize schedule writes so two admins can't book the same room/trainer slot at once.
      await c.query('LOCK TABLE class_schedule IN SHARE ROW EXCLUSIVE MODE');

      const collision = await queryOne(
        `SELECT * FROM class_schedule
         WHERE class_date = $1 AND schedule_status <> 'Cancelled'
           AND (trainer_id = $2 OR room_name = $3)
           AND NOT (end_time <= $4 OR start_time >= $5)
         LIMIT 1`,
        [class_date, trainer_id, room_name, start_time, end_time],
        c,
      );

      if (collision) {
        throw new HttpError(409, 'Schedule collision detected', {
          collision: {
            schedule_id: collision.schedule_id,
            room_name: collision.room_name,
            trainer_id: collision.trainer_id,
            class_date: collision.class_date,
            start_time: collision.start_time,
            end_time: collision.end_time,
          },
        });
      }

      return queryOne(
        `INSERT INTO class_schedule (class_type_id, trainer_id, room_name, class_date, start_time, end_time, max_capacity)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [class_type_id, trainer_id, room_name, class_date, start_time, end_time, max_capacity],
        c,
      );
    });

    return res.status(201).json(created);
  } catch (err) {
    return sendError(res, err, 'Create schedule error');
  }
});

// PUT /schedule/:id - Update a class schedule (admin only)
router.put('/schedule/:id', authenticateToken, requireRole('Admin'), async (req: Request, res: Response) => {
  try {
    const scheduleId = intParam(req.params.id, 'schedule id');
    const { class_type_id, trainer_id, room_name, class_date, start_time, end_time, max_capacity, schedule_status } = req.body;

    const changed = await execute(
      `UPDATE class_schedule
       SET class_type_id = $1, trainer_id = $2, room_name = $3, class_date = $4,
           start_time = $5, end_time = $6, max_capacity = $7, schedule_status = $8
       WHERE schedule_id = $9`,
      [class_type_id, trainer_id, room_name, class_date, start_time, end_time, max_capacity, schedule_status ?? 'Open', scheduleId],
    );

    if (changed === 0) {
      return res.status(404).json({ error: 'Schedule not found' });
    }

    return res.json({ message: 'Schedule updated successfully' });
  } catch (err) {
    return sendError(res, err, 'Update schedule error');
  }
});

export default router;
