import './env'; // must be first: loads server/.env before other modules read process.env
import express, { type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import { checkConnection, pool } from './db/database';
import authRoutes from './routes/auth';
import memberRoutes from './routes/members';
import trainerRoutes from './routes/trainers';
import planRoutes from './routes/plans';
import classRoutes from './routes/classes';
import bookingRoutes from './routes/bookings';
import adminRoutes from './routes/admin';
import { authenticateToken, requireRole } from './middleware/auth';

const app = express();
app.set('trust proxy', 1); // Render sits behind a proxy

// ---------------------------------------------------------------------
// CORS — the Vercel frontend + local Vite dev server
// CLIENT_URL may be a comma-separated list, e.g.
//   https://fitpulse.vercel.app,https://fitpulse-git-main-you.vercel.app
// ---------------------------------------------------------------------
const allowedOrigins = new Set(
  ['http://localhost:5173', 'http://127.0.0.1:5173', ...(process.env.CLIENT_URL ?? '').split(',')]
    .map((o) => o.trim().replace(/\/+$/, ''))
    .filter(Boolean),
);

app.use(
  cors({
    origin(origin, callback) {
      // No Origin header = curl, health checks, server-to-server: allow
      if (!origin || allowedOrigins.has(origin)) return callback(null, true);
      return callback(null, false); // browser blocks the response; no 500
    },
    credentials: true,
  }),
);
app.use(express.json());

// Health check (Render "Health Check Path": /api/health)
app.get('/api/health', async (_req: Request, res: Response) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', database: 'ok', time: new Date().toISOString() });
  } catch {
    res.status(503).json({ status: 'error', database: 'unreachable' });
  }
});

// Public routes
app.use('/api/auth', authRoutes);
app.use('/api/plans', planRoutes);
app.use('/api/classes', classRoutes);
app.use('/api/trainers', trainerRoutes);

// Protected routes
app.use('/api/members', authenticateToken, requireRole('Member'), memberRoutes);
app.use('/api/bookings', authenticateToken, requireRole('Member'), bookingRoutes);
app.use('/api/admin', authenticateToken, requireRole('Admin'), adminRoutes);

// 404 for unknown API routes
app.use('/api', (_req: Request, res: Response) => res.status(404).json({ error: 'Not found' }));

// Last-resort error handler (e.g. malformed JSON body)
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  if (err?.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON body' });
  console.error('Unhandled error:', err);
  return res.status(500).json({ error: 'Internal server error' });
});

const PORT = Number(process.env.PORT) || 3001;

async function start() {
  try {
    await checkConnection();
  } catch (err) {
    console.error('❌ Could not connect to Postgres. Check DATABASE_URL.\n', (err as Error).message);
    process.exit(1);
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`⚡ FitPulse API running on port ${PORT}`);
    console.log(`   CORS origins: ${[...allowedOrigins].join(', ')}`);
  });

  const shutdown = (signal: string) => {
    console.log(`${signal} received — shutting down`);
    server.close(() => {
      pool.end().finally(() => process.exit(0));
    });
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

void start();
