import type { Response } from 'express';

/** Throw from anywhere (including inside a transaction) to send a specific status. */
export class HttpError extends Error {
  status: number;
  body: Record<string, unknown>;

  constructor(status: number, message: string, extra: Record<string, unknown> = {}) {
    super(message);
    this.status = status;
    this.body = { error: message, ...extra };
  }
}

interface PgError {
  code?: string;
  constraint?: string;
}

export const isUniqueViolation = (err: unknown) => (err as PgError)?.code === '23505';

/** Bad input that reached Postgres: check/not-null violations, malformed dates, bad numbers. */
const BAD_INPUT_CODES = new Set(['23502', '23514', '22P02', '22007', '22008', '22003', '23503']);
export const isBadInput = (err: unknown) => BAD_INPUT_CODES.has((err as PgError)?.code ?? '');

/**
 * Send the right response for an error and log anything unexpected.
 * @param conflictMessage message for a UNIQUE violation (409)
 */
export function sendError(res: Response, err: unknown, label: string, conflictMessage = 'Already exists') {
  if (err instanceof HttpError) return res.status(err.status).json(err.body);
  if (isUniqueViolation(err)) return res.status(409).json({ error: conflictMessage });
  if (isBadInput(err)) return res.status(400).json({ error: 'Invalid input' });
  console.error(`${label}:`, err);
  return res.status(500).json({ error: 'Internal server error' });
}

/** Parse a route param as a positive integer or throw 400. */
export function intParam(value: unknown, name = 'id'): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) throw new HttpError(400, `Invalid ${name}`);
  return n;
}
