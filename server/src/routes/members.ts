import { Router, Request, Response } from 'express';
import { execute, query, queryOne } from '../db/database';
import { HttpError, sendError } from '../lib/http';

const router = Router();

async function getMemberId(userId: number): Promise<number> {
  const member = await queryOne<{ member_id: number }>(`SELECT member_id FROM member WHERE user_id = $1`, [userId]);
  if (!member) throw new HttpError(404, 'Member not found');
  return member.member_id;
}

// GET /me - Get current member profile
router.get('/me', async (req: Request, res: Response) => {
  try {
    const member = await queryOne(
      `SELECT m.*, mp.plan_name, mp.duration_months, mp.price, mp.billing_type, mp.class_quota,
              mp.is_active AS plan_active, ua.username,
              CASE
                WHEN m.plan_id IS NULL OR m.end_date IS NULL THEN 'Inactive'
                WHEN m.end_date >= CURRENT_DATE THEN 'Active'
                ELSE 'Expired'
              END AS member_status
       FROM member m
       JOIN user_account ua ON m.user_id = ua.user_id
       LEFT JOIN membership_plan mp ON m.plan_id = mp.plan_id
       WHERE m.user_id = $1`,
      [req.user!.user_id],
    );

    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }

    const phones = await query<{ phone: string }>(`SELECT phone FROM member_phone WHERE member_id = $1`, [member.member_id]);

    return res.json({ ...member, phones: phones.map((p) => p.phone) });
  } catch (err) {
    return sendError(res, err, 'Get member profile error');
  }
});

// PUT /me - Update current member profile
router.put('/me', async (req: Request, res: Response) => {
  try {
    const { first_name, last_name, email, birth_date, gender } = req.body;

    const changed = await execute(
      `UPDATE member SET first_name = $1, last_name = $2, email = $3, birth_date = $4, gender = $5
       WHERE user_id = $6`,
      [first_name, last_name, email, birth_date, gender, req.user!.user_id],
    );

    if (changed === 0) {
      return res.status(404).json({ error: 'Member not found' });
    }

    return res.json({ message: 'Profile updated successfully' });
  } catch (err) {
    return sendError(res, err, 'Update member error', 'Email already in use');
  }
});

// POST /me/phones - Add a phone number
router.post('/me/phones', async (req: Request, res: Response) => {
  try {
    const phone = typeof req.body.phone === 'string' ? req.body.phone.trim() : '';
    if (!phone) {
      return res.status(400).json({ error: 'Phone number required' });
    }

    const memberId = await getMemberId(req.user!.user_id);
    await execute(`INSERT INTO member_phone (member_id, phone) VALUES ($1, $2)`, [memberId, phone]);

    return res.status(201).json({ message: 'Phone added successfully', phone });
  } catch (err) {
    return sendError(res, err, 'Add phone error', 'Phone number already exists');
  }
});

// DELETE /me/phones/:phone - Remove a phone number
router.delete('/me/phones/:phone', async (req: Request, res: Response) => {
  try {
    const phone = String(req.params.phone);
    const memberId = await getMemberId(req.user!.user_id);

    const removed = await execute(`DELETE FROM member_phone WHERE member_id = $1 AND phone = $2`, [memberId, phone]);

    if (removed === 0) {
      return res.status(404).json({ error: 'Phone number not found' });
    }

    return res.json({ message: 'Phone removed successfully' });
  } catch (err) {
    return sendError(res, err, 'Delete phone error');
  }
});

// POST /me/plan - Subscribe to a membership plan
router.post('/me/plan', async (req: Request, res: Response) => {
  try {
    const { plan_id } = req.body;
    if (!plan_id) {
      return res.status(400).json({ error: 'plan_id required' });
    }

    const plan = await queryOne(`SELECT * FROM membership_plan WHERE plan_id = $1 AND is_active = TRUE`, [plan_id]);
    if (!plan) {
      return res.status(404).json({ error: 'Plan not found or inactive' });
    }

    const changed = await execute(
      `UPDATE member
       SET plan_id = $1,
           start_date = CURRENT_DATE,
           end_date = (CURRENT_DATE + make_interval(months => $2::int))::date
       WHERE user_id = $3`,
      [plan.plan_id, plan.duration_months, req.user!.user_id],
    );

    if (changed === 0) {
      return res.status(404).json({ error: 'Member not found' });
    }

    return res.json({ message: 'Plan subscribed successfully', plan_name: plan.plan_name });
  } catch (err) {
    return sendError(res, err, 'Subscribe plan error');
  }
});

export default router;
