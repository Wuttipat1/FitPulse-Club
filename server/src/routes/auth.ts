import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { queryOne, withTransaction } from '../db/database';
import { JWT_SECRET } from '../middleware/auth';
import { HttpError, sendError } from '../lib/http';

const router = Router();

const GENDERS = ['M', 'F']; // M = Man, F = Woman

function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

/** De-duplicate and trim phone numbers sent by the client. */
function cleanPhones(phones: unknown): string[] {
  if (!Array.isArray(phones)) return [];
  return [...new Set(phones.map((p) => String(p).trim()).filter(Boolean))];
}

// POST /register
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { username, password, role, first_name, last_name, email, birth_date, gender, specialization, experience_years, phones } = req.body;

    if (!username || !password || !role || !first_name || !last_name || !email) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const passwordHash = hashPassword(password);
    const phoneList = cleanPhones(phones);

    if (role === 'Member') {
      if (!birth_date || !gender) {
        return res.status(400).json({ error: 'Members must provide birth_date and gender' });
      }
      if (!GENDERS.includes(gender)) {
        return res.status(400).json({ error: 'Gender must be M (Man) or F (Woman)' });
      }

      const result = await withTransaction(async (c) => {
        const user = await queryOne<{ user_id: number }>(
          `INSERT INTO user_account (username, password_hash, role, account_status)
           VALUES ($1, $2, 'Member', 'Active') RETURNING user_id`,
          [username, passwordHash],
          c,
        );
        const userId = user!.user_id;

        const member = await queryOne<{ member_id: number }>(
          `INSERT INTO member (user_id, first_name, last_name, email, birth_date, gender)
           VALUES ($1, $2, $3, $4, $5, $6) RETURNING member_id`,
          [userId, first_name, last_name, email, birth_date, gender],
          c,
        );
        const memberId = member!.member_id;

        for (const phone of phoneList) {
          await c.query(`INSERT INTO member_phone (member_id, phone) VALUES ($1, $2)`, [memberId, phone]);
        }

        const token = jwt.sign({ user_id: userId, role: 'Member', member_id: memberId }, JWT_SECRET, { expiresIn: '24h' });

        return {
          token,
          user: { user_id: userId, username, role: 'Member', account_status: 'Active', member_id: memberId },
        };
      });

      return res.status(201).json(result);
    } else if (role === 'Trainer') {
      if (!specialization || experience_years === undefined) {
        return res.status(400).json({ error: 'Trainers must provide specialization and experience_years' });
      }

      const result = await withTransaction(async (c) => {
        const user = await queryOne<{ user_id: number }>(
          `INSERT INTO user_account (username, password_hash, role, account_status)
           VALUES ($1, $2, 'Trainer', 'Pending') RETURNING user_id`,
          [username, passwordHash],
          c,
        );
        const userId = user!.user_id;

        const trainer = await queryOne<{ trainer_id: number }>(
          `INSERT INTO trainer (user_id, first_name, last_name, email, specialization, experience_years)
           VALUES ($1, $2, $3, $4, $5, $6) RETURNING trainer_id`,
          [userId, first_name, last_name, email, specialization, experience_years],
          c,
        );
        const trainerId = trainer!.trainer_id;

        for (const phone of phoneList) {
          await c.query(`INSERT INTO trainer_phone (trainer_id, phone) VALUES ($1, $2)`, [trainerId, phone]);
        }

        const token = jwt.sign({ user_id: userId, role: 'Trainer', trainer_id: trainerId }, JWT_SECRET, { expiresIn: '24h' });

        return {
          token,
          user: { user_id: userId, username, role: 'Trainer', account_status: 'Pending', trainer_id: trainerId },
        };
      });

      return res.status(201).json(result);
    } else {
      throw new HttpError(400, 'Invalid role. Must be Member or Trainer');
    }
  } catch (err) {
    return sendError(res, err, 'Registration error', 'Username or email already exists');
  }
});

// POST /login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    const user = await queryOne(`SELECT * FROM user_account WHERE username = $1 AND password_hash = $2`, [
      username,
      hashPassword(password),
    ]);

    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    if (user.role === 'Trainer' && user.account_status === 'Pending') {
      return res.status(403).json({ error: 'Your trainer application is pending approval' });
    }

    if (user.account_status !== 'Active') {
      return res.status(403).json({ error: 'Account is not active' });
    }

    let memberId: number | undefined;
    let trainerId: number | undefined;

    if (user.role === 'Member') {
      const member = await queryOne(`SELECT member_id FROM member WHERE user_id = $1`, [user.user_id]);
      memberId = member?.member_id;
    } else if (user.role === 'Trainer') {
      const trainer = await queryOne(`SELECT trainer_id FROM trainer WHERE user_id = $1`, [user.user_id]);
      trainerId = trainer?.trainer_id;
    }

    const token = jwt.sign(
      { user_id: user.user_id, role: user.role, member_id: memberId, trainer_id: trainerId },
      JWT_SECRET,
      { expiresIn: '24h' },
    );

    return res.json({
      token,
      user: {
        user_id: user.user_id,
        username: user.username,
        role: user.role,
        account_status: user.account_status,
        member_id: memberId,
        trainer_id: trainerId,
      },
    });
  } catch (err) {
    return sendError(res, err, 'Login error');
  }
});

export default router;
