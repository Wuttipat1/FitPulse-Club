import { useAuthStore } from '../stores/authStore';
import type {
  AdminStats,
  ApiErrorBody,
  AuthResponse,
  BookResponse,
  CancelResponse,
  CheckinStatus,
  ClassLevel,
  ClassSchedule,
  ClassType,
  CollisionCheckPayload,
  CollisionResult,
  LoginPayload,
  MemberProfile,
  MembershipPlan,
  MessageResponse,
  MyBooking,
  PlanPayload,
  RecentBooking,
  RegisterPayload,
  RosterEntry,
  ScheduleFilters,
  SchedulePayload,
  Trainer,
  UpdateMemberPayload,
} from '../types';

/**
 * API base URL.
 *  - Local dev: unset → '/api', proxied to localhost:3001 by vite.config.ts
 *  - Vercel:    VITE_API_URL=https://<your-service>.onrender.com/api
 * A trailing slash is ignored, and '/api' is added if you leave it off.
 */
function resolveBaseUrl(): string {
  const raw = (import.meta.env.VITE_API_URL as string | undefined)?.trim();
  if (!raw) return '/api';
  const url = raw.replace(/\/+$/, '');
  return /\/api$/.test(url) ? url : `${url}/api`;
}

export const BASE_URL = resolveBaseUrl();

/** Error thrown for any non-2xx response. `data` holds the parsed JSON body. */
export class ApiError extends Error {
  status: number;
  data: ApiErrorBody | null;

  constructor(status: number, message: string, data: ApiErrorBody | null = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

type Method = 'GET' | 'POST' | 'PUT' | 'DELETE';

interface RequestOptions {
  method?: Method;
  body?: unknown;
  query?: Record<string, string | number | undefined | null>;
  signal?: AbortSignal;
}

function buildUrl(path: string, query?: RequestOptions['query']): string {
  let url = `${BASE_URL}${path}`;
  if (query) {
    const params = new URLSearchParams();
    Object.entries(query).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') params.append(k, String(v));
    });
    const qs = params.toString();
    if (qs) url += `?${qs}`;
  }
  return url;
}

export async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, query, signal } = opts;
  const token = useAuthStore.getState().token;

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(buildUrl(path, query), {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
    });
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err;
    throw new ApiError(
      0,
      import.meta.env.DEV
        ? 'Cannot reach the server. Is the API running on port 3001?'
        : 'Cannot reach the server. It may be waking up — please try again in a few seconds.',
    );
  }

  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  if (!res.ok) {
    const errBody = (data && typeof data === 'object' ? data : null) as ApiErrorBody | null;
    const message = errBody?.error || `Request failed (${res.status})`;

    // Expired / invalid session → sign out and bounce to login
    if (token && (res.status === 401 || (res.status === 403 && /token/i.test(message)))) {
      useAuthStore.getState().logout();
      if (!window.location.pathname.startsWith('/login')) {
        window.location.assign('/login?expired=1');
      }
    }
    throw new ApiError(res.status, message, errBody);
  }

  return data as T;
}

/** Extract a readable message from anything thrown. */
export function getErrorMessage(err: unknown, fallback = 'Something went wrong'): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error) return err.message || fallback;
  return fallback;
}

// ============================================================
// Endpoint groups
// ============================================================

export const api = {
  auth: {
    login: (payload: LoginPayload) =>
      request<AuthResponse>('/auth/login', { method: 'POST', body: payload }),
    register: (payload: RegisterPayload) =>
      request<AuthResponse>('/auth/register', { method: 'POST', body: payload }),
  },

  members: {
    me: () => request<MemberProfile>('/members/me'),
    updateMe: (payload: UpdateMemberPayload) =>
      request<MessageResponse>('/members/me', { method: 'PUT', body: payload }),
    addPhone: (phone: string) =>
      request<MessageResponse & { phone: string }>('/members/me/phones', {
        method: 'POST',
        body: { phone },
      }),
    removePhone: (phone: string) =>
      request<MessageResponse>(`/members/me/phones/${encodeURIComponent(phone)}`, {
        method: 'DELETE',
      }),
    subscribePlan: (plan_id: number) =>
      request<MessageResponse & { plan_name: string }>('/members/me/plan', {
        method: 'POST',
        body: { plan_id },
      }),
  },

  plans: {
    list: () => request<MembershipPlan[]>('/plans'),
    all: () => request<MembershipPlan[]>('/plans/all'),
    create: (payload: Omit<PlanPayload, 'is_active'>) =>
      request<MembershipPlan>('/plans', { method: 'POST', body: payload }),
    update: (id: number, payload: PlanPayload) =>
      request<MessageResponse>(`/plans/${id}`, { method: 'PUT', body: payload }),
  },

  classes: {
    types: () => request<ClassType[]>('/classes/types'),
    createType: (type_name: string, level: ClassLevel) =>
      request<ClassType>('/classes/types', { method: 'POST', body: { type_name, level } }),
    schedule: (filters: ScheduleFilters = {}) =>
      request<ClassSchedule[]>('/classes/schedule', {
        query: {
          date: filters.date,
          class_type_id: filters.class_type_id,
          trainer_id: filters.trainer_id,
        },
      }),
    createSchedule: (payload: SchedulePayload) =>
      request<SchedulePayload & { schedule_id: number }>('/classes/schedule', {
        method: 'POST',
        body: payload,
      }),
    updateSchedule: (id: number, payload: Required<SchedulePayload>) =>
      request<MessageResponse>(`/classes/schedule/${id}`, { method: 'PUT', body: payload }),
  },

  bookings: {
    book: (schedule_id: number) =>
      request<BookResponse>('/bookings', { method: 'POST', body: { schedule_id } }),
    cancel: (booking_id: number) =>
      request<CancelResponse>(`/bookings/${booking_id}`, { method: 'DELETE' }),
    my: () => request<MyBooking[]>('/bookings/my'),
  },

  trainers: {
    list: () => request<Trainer[]>('/trainers'),
    me: () => request<Trainer>('/trainers/me'),
    myClasses: () => request<ClassSchedule[]>('/trainers/me/classes'),
    roster: (scheduleId: number) =>
      request<RosterEntry[]>(`/trainers/classes/${scheduleId}/roster`),
    checkin: (scheduleId: number, booking_id: number, status: CheckinStatus) =>
      request<MessageResponse>(`/trainers/classes/${scheduleId}/checkin`, {
        method: 'POST',
        body: { booking_id, status },
      }),
  },

  admin: {
    stats: () => request<AdminStats>('/admin/stats'),
    pendingTrainers: () => request<Trainer[]>('/admin/trainers/pending'),
    approveTrainer: (userId: number) =>
      request<MessageResponse & { trainer: Trainer }>(`/admin/trainers/${userId}/approve`, {
        method: 'POST',
      }),
    rejectTrainer: (userId: number) =>
      request<MessageResponse>(`/admin/trainers/${userId}/reject`, { method: 'POST' }),
    checkCollision: (payload: CollisionCheckPayload, signal?: AbortSignal) =>
      request<CollisionResult>('/admin/schedule/check-collision', {
        method: 'POST',
        body: payload,
        signal,
      }),
    recentBookings: () => request<RecentBooking[]>('/admin/bookings/recent'),
  },
};
