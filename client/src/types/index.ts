// ============================================================
// FitPulse — shared domain types (mirrors server/src/db/schema.sql)
// ============================================================

export type Role = 'Admin' | 'Trainer' | 'Member';
export type AccountStatus = 'Active' | 'Pending';
export type Gender = 'M' | 'F' | 'Other';
export type ClassLevel = 'Beginner' | 'Intermediate' | 'Advanced';
export type ScheduleStatus = 'Open' | 'Full' | 'Cancelled';
export type BookingStatus = 'Booked' | 'Waitlist' | 'Attended' | 'NoShow' | 'Cancelled';
export type MemberStatus = 'Active' | 'Expired' | 'Inactive';

// ---------- Auth ----------
export interface AuthUser {
  user_id: number;
  username: string;
  role: Role;
  account_status: AccountStatus;
  member_id?: number;
  trainer_id?: number;
}

export interface AuthResponse {
  token: string;
  user: AuthUser;
}

export interface LoginPayload {
  username: string;
  password: string;
}

interface RegisterBase {
  username: string;
  password: string;
  first_name: string;
  last_name: string;
  email: string;
  phones: string[];
}

export interface RegisterMemberPayload extends RegisterBase {
  role: 'Member';
  birth_date: string;
  gender: Gender;
}

export interface RegisterTrainerPayload extends RegisterBase {
  role: 'Trainer';
  specialization: string;
  experience_years: number;
}

export type RegisterPayload = RegisterMemberPayload | RegisterTrainerPayload;

// ---------- Membership plans ----------
export interface MembershipPlan {
  plan_id: number;
  plan_name: string;
  duration_months: number;
  price: number;
  billing_type: string;
  /** null = unlimited classes */
  class_quota: number | null;
  is_active: number | boolean;
}

export type PlanPayload = Omit<MembershipPlan, 'plan_id'>;

// ---------- Members ----------
export interface Member {
  member_id: number;
  user_id: number;
  first_name: string;
  last_name: string;
  email: string;
  birth_date: string;
  gender: Gender;
  plan_id: number | null;
  start_date: string | null;
  end_date: string | null;
}

export interface MemberProfile extends Member {
  username: string;
  plan_name: string | null;
  duration_months: number | null;
  price: number | null;
  billing_type: string | null;
  class_quota: number | null;
  plan_active: number | null;
  phones: string[];
  member_status: MemberStatus;
}

export interface UpdateMemberPayload {
  first_name: string;
  last_name: string;
  email: string;
  birth_date: string;
  gender: Gender;
}

// ---------- Trainers ----------
export interface Trainer {
  trainer_id: number;
  user_id: number;
  first_name: string;
  last_name: string;
  email: string;
  specialization: string;
  experience_years: number;
  hire_date: string | null;
  username: string;
  phones: string[];
  account_status?: AccountStatus;
  created_at?: string;
}

// ---------- Classes ----------
export interface ClassType {
  class_type_id: number;
  type_name: string;
  level: ClassLevel;
}

export interface ClassSchedule {
  schedule_id: number;
  class_type_id: number;
  trainer_id: number;
  room_name: string;
  class_date: string; // YYYY-MM-DD
  start_time: string; // HH:MM
  end_time: string; // HH:MM
  max_capacity: number;
  schedule_status: ScheduleStatus;
  type_name: string;
  level: ClassLevel;
  current_booked: number;
  trainer_first_name?: string;
  trainer_last_name?: string;
  specialization?: string;
}

export interface SchedulePayload {
  class_type_id: number;
  trainer_id: number;
  room_name: string;
  class_date: string;
  start_time: string;
  end_time: string;
  max_capacity: number;
  schedule_status?: ScheduleStatus;
}

export interface ScheduleFilters {
  date?: string;
  class_type_id?: number;
  trainer_id?: number;
}

// ---------- Bookings ----------
export interface Booking {
  booking_id: number;
  member_id: number;
  schedule_id: number;
  booking_time: string;
  booking_status: BookingStatus;
  waitlist_position: number | null;
}

export interface MyBooking extends Booking {
  class_date: string;
  start_time: string;
  end_time: string;
  room_name: string;
  max_capacity: number;
  schedule_status: ScheduleStatus;
  type_name: string;
  level: ClassLevel;
  trainer_first_name: string;
  trainer_last_name: string;
  current_booked: number;
}

export interface BookResponse {
  booking: Booking;
  status: 'booked' | 'waitlist';
  position?: number;
}

export interface PromotedMember {
  booking_id: number;
  member_id: number;
  first_name: string;
  last_name: string;
}

export interface CancelResponse {
  cancelled: boolean;
  promoted_member: PromotedMember | null;
}

export interface RosterEntry extends Booking {
  first_name: string;
  last_name: string;
}

export type CheckinStatus = 'Attended' | 'NoShow';

// ---------- Admin ----------
export interface AdminStats {
  totalActiveMembers: number;
  todaysClasses: number;
  occupancyRate: number;
  pendingTrainers: number;
}

export interface CollisionItem extends Omit<ClassSchedule, 'current_booked' | 'level'> {
  first_name: string;
  last_name: string;
}

export interface CollisionResult {
  hasCollision: boolean;
  collisions: CollisionItem[];
}

export interface CollisionCheckPayload {
  trainer_id: number;
  room_name: string;
  class_date: string;
  start_time: string;
  end_time: string;
}

export interface RecentBooking extends Booking {
  first_name: string;
  last_name: string;
  type_name: string;
  class_date: string;
  start_time: string;
}

// ---------- Generic ----------
export interface MessageResponse {
  message: string;
}

export interface ApiErrorBody {
  error: string;
  [key: string]: unknown;
}

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration: number;
}
