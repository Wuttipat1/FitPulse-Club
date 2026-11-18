import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowRight,
  Award,
  Briefcase,
  CircleCheck,
  Dumbbell,
  KeyRound,
  Mail,
  User,
  UserPlus,
} from 'lucide-react';
import { AuthShell } from './AuthShell';
import { Button, Input, PhoneListInput, Select, Tabs, DateInput } from '../../components/ui';
import { api, getErrorMessage } from '../../lib/api';
import { useAuthStore } from '../../stores/authStore';
import { toast } from '../../stores/toastStore';
import { cn, EMAIL_REGEX, todayISO } from '../../lib/utils';
import type { Gender } from '../../types';

type Mode = 'Member' | 'Trainer';

const SPECIALTIES = ['HIIT', 'Yoga', 'Pilates', 'Boxing', 'Muay Thai', 'CrossFit', 'Spin', 'Strength', 'Mobility', 'Dance'];

interface FormState {
  username: string;
  password: string;
  confirm: string;
  first_name: string;
  last_name: string;
  email: string;
  birth_date: string;
  gender: Gender | '';
  specialties: string[];
  specialtyExtra: string;
  experience_years: string;
  phones: string[];
}

const initial: FormState = {
  username: '',
  password: '',
  confirm: '',
  first_name: '',
  last_name: '',
  email: '',
  birth_date: '',
  gender: '',
  specialties: [],
  specialtyExtra: '',
  experience_years: '',
  phones: [],
};

type Errors = Partial<Record<keyof FormState, string>>;

export default function RegisterPage() {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);
  const [mode, setMode] = useState<Mode>('Member');
  const [form, setForm] = useState<FormState>(initial);
  const [errors, setErrors] = useState<Errors>({});
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const specialization = [...form.specialties, form.specialtyExtra.trim()].filter(Boolean).join(', ');

  const validate = (): Errors => {
    const e: Errors = {};
    if (form.username.trim().length < 3) e.username = 'At least 3 characters';
    if (form.password.length < 6) e.password = 'At least 6 characters';
    if (form.confirm !== form.password) e.confirm = 'Passwords do not match';
    if (!form.first_name.trim()) e.first_name = 'Required';
    if (!form.last_name.trim()) e.last_name = 'Required';
    if (!EMAIL_REGEX.test(form.email)) e.email = 'Enter a valid email';
    if (form.phones.length === 0) e.phones = 'Add at least one phone number';
    if (mode === 'Member') {
      if (!form.birth_date) e.birth_date = 'Enter your birth date as YYYY-MM-DD';
      else if (form.birth_date > todayISO()) e.birth_date = 'Must be in the past';
      if (form.gender !== 'M' && form.gender !== 'F') e.gender = 'Choose Man or Woman';
    } else {
      if (!specialization) e.specialties = 'Pick at least one specialty';
      const yrs = Number(form.experience_years);
      if (form.experience_years === '' || Number.isNaN(yrs) || yrs < 0 || yrs > 60)
        e.experience_years = 'Enter years (0–60)';
    }
    return e;
  };

  const onSubmit = async (ev: FormEvent) => {
    ev.preventDefault();
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) return;

    setLoading(true);
    try {
      const base = {
        username: form.username.trim(),
        password: form.password,
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        email: form.email.trim(),
        phones: form.phones,
      };
      if (mode === 'Member') {
        const res = await api.auth.register({
          ...base,
          role: 'Member',
          birth_date: form.birth_date,
          gender: form.gender as Gender,
        });
        login(res.token, res.user);
        toast.success('Welcome to FitPulse! 🎉', 'Pick a membership plan to start booking classes.');
        navigate('/member/profile?welcome=1', { replace: true });
      } else {
        await api.auth.register({
          ...base,
          role: 'Trainer',
          specialization,
          experience_years: Number(form.experience_years),
        });
        // Trainers stay signed-out until an admin approves them.
        setSubmitted(true);
      }
    } catch (err) {
      toast.error('Registration failed', getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <AuthShell>
        <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', delay: 0.1 }}
            className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-volt/10 text-volt glow-volt"
          >
            <CircleCheck className="h-10 w-10" />
          </motion.div>
          <h2 className="mt-6 font-display text-3xl font-bold uppercase">Application sent</h2>
          <p className="mt-3 text-text-secondary">
            Thanks, {form.first_name}! An admin will review your trainer application. Once approved you can sign in as{' '}
            <span className="font-semibold text-text-primary">{form.username}</span>.
          </p>
          <Button className="mt-8" size="lg" onClick={() => navigate('/login')} iconRight={<ArrowRight className="h-4 w-4" />}>
            Back to sign in
          </Button>
        </motion.div>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <p className="text-xs font-bold uppercase tracking-[0.25em] text-volt">Join the club</p>
      <h2 className="mt-2 font-display text-4xl font-bold uppercase">Create account</h2>
      <p className="mt-2 text-text-secondary">
        Already a member?{' '}
        <Link to="/login" className="font-semibold text-volt hover:underline">
          Sign in
        </Link>
      </p>

      <Tabs<Mode>
        className="mt-6 w-full [&>button]:flex-1 [&>button]:justify-center"
        layoutId="register-tabs"
        value={mode}
        onChange={(m) => {
          setMode(m);
          setErrors({});
        }}
        items={[
          { value: 'Member', label: 'Member', icon: <UserPlus /> },
          { value: 'Trainer', label: 'Trainer application', icon: <Briefcase /> },
        ]}
      />

      <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
        <div className="grid grid-cols-2 gap-3">
          <Input label="First name" value={form.first_name} onChange={(e) => set('first_name', e.target.value)} error={errors.first_name} />
          <Input label="Last name" value={form.last_name} onChange={(e) => set('last_name', e.target.value)} error={errors.last_name} />
        </div>
        <Input
          label="Email"
          type="email"
          icon={<Mail />}
          value={form.email}
          onChange={(e) => set('email', e.target.value)}
          error={errors.email}
          autoComplete="email"
        />

        <AnimatePresence mode="wait" initial={false}>
          {mode === 'Member' ? (
            <motion.div
              key="member"
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 12 }}
              className="grid grid-cols-2 gap-3"
            >
              <DateInput
                label="Birth date"
                value={form.birth_date}
                onChange={(iso) => set('birth_date', iso)}
                error={errors.birth_date}
                max={todayISO()}
              />
              <Select
                label="Gender"
                value={form.gender}
                onChange={(e) => set('gender', e.target.value as Gender)}
                error={errors.gender}
                placeholder="Select"
                options={[
                  { value: 'M', label: 'Man' },
                  { value: 'F', label: 'Woman' },
                ]}
              />
            </motion.div>
          ) : (
            <motion.div
              key="trainer"
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              className="space-y-4"
            >
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-text-secondary">Specialties</label>
                <div className="flex flex-wrap gap-2">
                  {SPECIALTIES.map((s) => {
                    const on = form.specialties.includes(s);
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() =>
                          set('specialties', on ? form.specialties.filter((x) => x !== s) : [...form.specialties, s])
                        }
                        className={cn(
                          'rounded-full border px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer',
                          on
                            ? 'border-volt bg-volt text-obsidian'
                            : 'border-border text-text-secondary hover:border-border-hover hover:text-text-primary',
                        )}
                      >
                        {s}
                      </button>
                    );
                  })}
                </div>
                <Input
                  placeholder="Other (e.g. Kettlebell)"
                  icon={<Dumbbell />}
                  value={form.specialtyExtra}
                  onChange={(e) => set('specialtyExtra', e.target.value)}
                  error={errors.specialties}
                />
              </div>
              <Input
                label="Years of experience"
                type="number"
                min={0}
                max={60}
                icon={<Award />}
                value={form.experience_years}
                onChange={(e) => set('experience_years', e.target.value)}
                error={errors.experience_years}
              />
            </motion.div>
          )}
        </AnimatePresence>

        <PhoneListInput value={form.phones} onChange={(p) => set('phones', p)} error={errors.phones} />

        <div className="border-t border-border pt-4 space-y-4">
          <Input
            label="Username"
            icon={<User />}
            value={form.username}
            onChange={(e) => set('username', e.target.value)}
            error={errors.username}
            autoComplete="username"
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Password"
              type="password"
              icon={<KeyRound />}
              value={form.password}
              onChange={(e) => set('password', e.target.value)}
              error={errors.password}
              autoComplete="new-password"
            />
            <Input
              label="Confirm"
              type="password"
              value={form.confirm}
              onChange={(e) => set('confirm', e.target.value)}
              error={errors.confirm}
              autoComplete="new-password"
            />
          </div>
        </div>

        {mode === 'Trainer' && (
          <p className="rounded-xl border border-cyan/20 bg-cyan/5 px-4 py-3 text-xs text-text-secondary">
            Trainer accounts are reviewed by an admin before you can sign in.
          </p>
        )}

        <Button type="submit" size="lg" fullWidth loading={loading} iconRight={<ArrowRight className="h-4 w-4" />}>
          {mode === 'Member' ? 'Create member account' : 'Submit application'}
        </Button>
      </form>
    </AuthShell>
  );
}
