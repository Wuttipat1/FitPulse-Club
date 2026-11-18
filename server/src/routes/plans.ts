import { Router, Request, Response } from 'express';
import { execute, query, queryOne } from '../db/database';
import { authenticateToken, requireRole } from '../middleware/auth';
import { intParam, sendError } from '../lib/http';

const router = Router();

/** Accepts true/false, 1/0, "1"/"0"; defaults to active. */
function toBool(value: unknown, fallback = true): boolean {
  if (value === undefined || value === null) return fallback;
  if (typeof value === 'string') return value === '1' || value.toLowerCase() === 'true';
  return Boolean(Number(value));
}

// GET / - List active plans (public)
router.get('/', async (_req: Request, res: Response) => {
  try {
    const plans = await query(`SELECT * FROM membership_plan WHERE is_active = TRUE ORDER BY price`);
    return res.json(plans);
  } catch (err) {
    return sendError(res, err, 'List plans error');
  }
});

// GET /all - List all plans (admin only)
router.get('/all', authenticateToken, requireRole('Admin'), async (_req: Request, res: Response) => {
  try {
    const plans = await query(`SELECT * FROM membership_plan ORDER BY plan_id`);
    return res.json(plans);
  } catch (err) {
    return sendError(res, err, 'List all plans error');
  }
});

// POST / - Create a new plan (admin only)
router.post('/', authenticateToken, requireRole('Admin'), async (req: Request, res: Response) => {
  try {
    const { plan_name, duration_months, price, billing_type, class_quota } = req.body;

    if (!plan_name || !duration_months || price === undefined || !billing_type) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const plan = await queryOne(
      `INSERT INTO membership_plan (plan_name, duration_months, price, billing_type, class_quota)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [plan_name, duration_months, price, billing_type, class_quota ?? null],
    );

    return res.status(201).json(plan);
  } catch (err) {
    return sendError(res, err, 'Create plan error', 'Plan name already exists');
  }
});

// PUT /:id - Update a plan (admin only)
router.put('/:id', authenticateToken, requireRole('Admin'), async (req: Request, res: Response) => {
  try {
    const planId = intParam(req.params.id, 'plan id');
    const { plan_name, duration_months, price, billing_type, class_quota, is_active } = req.body;

    const changed = await execute(
      `UPDATE membership_plan
       SET plan_name = $1, duration_months = $2, price = $3, billing_type = $4, class_quota = $5, is_active = $6
       WHERE plan_id = $7`,
      [plan_name, duration_months, price, billing_type, class_quota ?? null, toBool(is_active), planId],
    );

    if (changed === 0) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    return res.json({ message: 'Plan updated successfully' });
  } catch (err) {
    return sendError(res, err, 'Update plan error', 'Plan name already exists');
  }
});

export default router;
