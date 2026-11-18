import { useEffect, useState, type FormEvent } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Check,
  CreditCard,
  Crown,
  Infinity as InfinityIcon,
  Mail,
  Phone,
  Plus,
  Save,
  Sparkles,
  Trash2,
  TriangleAlert,
  User,
} from 'lucide-react';
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Input,
  Modal,
  PageHeader,
  Select,
  Skeleton,
  DateInput,
  useConfetti,
} from '../../components/ui';
import { api, getErrorMessage } from '../../lib/api';
import { useFetch } from '../../lib/hooks';
import { toast } from '../../stores/toastStore';
import {
  cn,
  daysUntil,
  EMAIL_REGEX,
  formatCurrency,
  formatLongDate,
  getInitials,
  PHONE_REGEX,
  todayISO,
} from '../../lib/utils';
import type { Gender, MemberProfile as Profile, MembershipPlan, UpdateMemberPayload } from '../../types';

export default function MemberProfile() {
  const { data, loading, error, reload, setData } = useFetch(
    () => Promise.all([api.members.me(), api.plans.list()]),
    [],
  );
  const [params] = useSearchParams();
  const location = useLocation();
  const welcome = params.get('welcome') === '1';

  useEffect(() => {
    if (!loading && (location.hash === '#plans' || welcome)) {
      setTimeout(() => document.getElementById('plans')?.scrollIntoView({ behavior: 'smooth' }), 150);
    }
  }, [loading, location.hash, welcome]);

  if (loading)
    return (
      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <Skeleton className="h-[420px] rounded-2xl" />
        <Skeleton className="h-[420px] rounded-2xl" />
      </div>
    );
  if (error || !data)
    return <EmptyState icon={<TriangleAlert />} title="Couldn't load profile" description={error ?? undefined} action={<Button onClick={reload}>Retry</Button>} />;

  const [profile, plans] = data;
  const updateProfile = (patch: Partial<Profile>) =>
    setData((prev) => (prev ? [{ ...prev[0], ...patch }, prev[1]] : prev));

  return (
    <div>
      <PageHeader
        eyebrow="Account"
        title="Profile & membership"
        subtitle="Keep your details up to date and manage your plan."
      />

      {welcome && profile.member_status !== 'Active' && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 flex items-start gap-3 rounded-2xl border border-volt/30 bg-volt/5 p-4"
        >
          <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-volt" />
          <p className="text-sm">
            <span className="font-semibold">Welcome aboard, {profile.first_name}!</span>{' '}
            <span className="text-text-secondary">Pick a plan below to unlock class booking.</span>
          </p>
        </motion.div>
      )}

      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        <div className="space-y-6">
          <IdentityCard profile={profile} />
          <PhonesCard profile={profile} onChange={(phones) => updateProfile({ phones })} />
        </div>
        <DetailsForm profile={profile} onSaved={updateProfile} />
      </div>

      <PlanPicker profile={profile} plans={plans} onSubscribed={reload} />
    </div>
  );
}

// ------------------------------------------------------------
function IdentityCard({ profile }: { profile: Profile }) {
  const daysLeft = daysUntil(profile.end_date);
  const total = profile.duration_months ? profile.duration_months * 30 : 30;
  const pct = daysLeft !== null ? Math.max(0, Math.min(100, (daysLeft / total) * 100)) : 0;

  return (
    <Card className="relative overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-24 bg-linear-to-br from-volt/20 via-cyan/10 to-transparent" />
      <div className="relative flex flex-col items-center pt-4 text-center">
        <Avatar initials={getInitials(profile.first_name, profile.last_name)} size="xl" className="ring-4 ring-obsidian" />
        <h2 className="mt-4 font-display text-2xl font-bold uppercase">
          {profile.first_name} {profile.last_name}
        </h2>
        <p className="text-sm text-text-muted">@{profile.username}</p>
        <Badge status={profile.member_status} dot pulse={profile.member_status === 'Active'} size="md" className="mt-3" />
      </div>

      <div className="relative mt-6 rounded-xl border border-border bg-obsidian/50 p-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">Current plan</p>
          <CreditCard className="h-4 w-4 text-text-muted" />
        </div>
        {profile.plan_name ? (
          <>
            <p className="mt-1 font-display text-xl font-bold uppercase">{profile.plan_name}</p>
            <p className="text-xs text-text-secondary">
              {profile.class_quota ? `${profile.class_quota} classes / month` : 'Unlimited classes'}
            </p>
            {profile.end_date && (
              <>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/5">
                  <motion.div
                    className={cn('h-full rounded-full', (daysLeft ?? 0) <= 5 ? 'bg-warning' : 'bg-volt')}
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.8 }}
                  />
                </div>
                <p className="mt-2 text-xs text-text-muted">
                  {profile.member_status === 'Expired'
                    ? `Expired ${formatLongDate(profile.end_date)}`
                    : `${Math.max(daysLeft ?? 0, 0)} days left · ends ${formatLongDate(profile.end_date)}`}
                </p>
              </>
            )}
          </>
        ) : (
          <p className="mt-1 text-sm text-text-secondary">No plan yet — choose one below.</p>
        )}
      </div>
    </Card>
  );
}

// ------------------------------------------------------------
function PhonesCard({ profile, onChange }: { profile: Profile; onChange: (phones: string[]) => void }) {
  const [draft, setDraft] = useState('');
  const [err, setErr] = useState('');
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  const add = async (e: FormEvent) => {
    e.preventDefault();
    const phone = draft.trim();
    if (!PHONE_REGEX.test(phone)) return setErr('Enter a valid phone number');
    if (profile.phones.includes(phone)) return setErr('Already on your account');
    setAdding(true);
    try {
      await api.members.addPhone(phone);
      onChange([...profile.phones, phone]);
      setDraft('');
      setErr('');
      toast.success('Phone added', phone);
    } catch (e2) {
      setErr(getErrorMessage(e2));
    } finally {
      setAdding(false);
    }
  };

  const remove = async (phone: string) => {
    if (profile.phones.length <= 1) {
      toast.warning('Keep at least one number', 'We need a way to reach you.');
      return;
    }
    setRemoving(phone);
    try {
      await api.members.removePhone(phone);
      onChange(profile.phones.filter((p) => p !== phone));
      toast.info('Phone removed', phone);
    } catch (e) {
      toast.error("Couldn't remove phone", getErrorMessage(e));
    } finally {
      setRemoving(null);
    }
  };

  return (
    <Card>
      <CardHeader title="Phone numbers" subtitle={`${profile.phones.length} on file`} icon={<Phone className="h-5 w-5" />} />
      <ul className="space-y-2">
        <AnimatePresence initial={false}>
          {profile.phones.map((p, i) => (
            <motion.li
              key={p}
              layout
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="flex items-center justify-between gap-3 rounded-xl border border-border bg-obsidian-light px-4 py-2.5"
            >
              <span className="flex items-center gap-3 text-sm">
                <Phone className="h-4 w-4 text-cyan" />
                <span className="font-medium tabular-nums">{p}</span>
                {i === 0 && <Badge tone="cyan">Primary</Badge>}
              </span>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => remove(p)}
                loading={removing === p}
                disabled={profile.phones.length <= 1}
                aria-label={`Remove ${p}`}
                className="hover:text-danger"
                icon={removing === p ? undefined : <Trash2 className="h-4 w-4" />}
              />
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
      <form onSubmit={add} className="mt-4 flex gap-2">
        <Input
          containerClassName="flex-1"
          placeholder="Add another number"
          icon={<Phone />}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            setErr('');
          }}
          error={err}
          inputMode="tel"
        />
        <Button type="submit" variant="outline" size="icon" className="h-11 w-11 rounded-xl" loading={adding} icon={!adding && <Plus className="h-5 w-5" />} aria-label="Add phone" />
      </form>
    </Card>
  );
}

// ------------------------------------------------------------
function DetailsForm({ profile, onSaved }: { profile: Profile; onSaved: (p: Partial<Profile>) => void }) {
  const toForm = (p: Profile): UpdateMemberPayload => ({
    first_name: p.first_name,
    last_name: p.last_name,
    email: p.email,
    birth_date: p.birth_date?.split('T')[0] ?? '',
    gender: p.gender,
  });
  const [form, setForm] = useState<UpdateMemberPayload>(() => toForm(profile));
  const [errors, setErrors] = useState<Partial<Record<keyof UpdateMemberPayload, string>>>({});
  const [saving, setSaving] = useState(false);

  const original = toForm(profile);
  const dirty = (Object.keys(form) as (keyof UpdateMemberPayload)[]).some((k) => form[k] !== original[k]);

  const set = <K extends keyof UpdateMemberPayload>(k: K, v: UpdateMemberPayload[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    const errs: typeof errors = {};
    if (!form.first_name.trim()) errs.first_name = 'Required';
    if (!form.last_name.trim()) errs.last_name = 'Required';
    if (!EMAIL_REGEX.test(form.email)) errs.email = 'Enter a valid email';
    if (!form.birth_date) errs.birth_date = 'Enter your birth date as YYYY-MM-DD';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    try {
      await api.members.updateMe(form);
      onSaved(form);
      toast.success('Profile saved');
    } catch (err) {
      toast.error("Couldn't save profile", getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader title="Personal details" subtitle="Used for check-in and membership records" icon={<User className="h-5 w-5" />} />
      <form onSubmit={save} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="First name" value={form.first_name} onChange={(e) => set('first_name', e.target.value)} error={errors.first_name} />
          <Input label="Last name" value={form.last_name} onChange={(e) => set('last_name', e.target.value)} error={errors.last_name} />
        </div>
        <Input label="Email" type="email" icon={<Mail />} value={form.email} onChange={(e) => set('email', e.target.value)} error={errors.email} />
        <div className="grid gap-4 sm:grid-cols-2">
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
            options={[
              { value: 'M', label: 'Man' },
              { value: 'F', label: 'Woman' },
            ]}
          />
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
          {dirty && (
            <Button variant="ghost" onClick={() => setForm(original)} disabled={saving}>
              Discard
            </Button>
          )}
          <Button type="submit" loading={saving} disabled={!dirty} icon={<Save className="h-4 w-4" />}>
            Save changes
          </Button>
        </div>
      </form>
    </Card>
  );
}

// ------------------------------------------------------------
function PlanPicker({
  profile,
  plans,
  onSubscribed,
}: {
  profile: Profile;
  plans: MembershipPlan[];
  onSubscribed: () => void;
}) {
  const [selected, setSelected] = useState<MembershipPlan | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { fire, confetti } = useConfetti();
  const [billing, setBilling] = useState<'all' | string>('all');

  const billingTypes = [...new Set(plans.map((p) => p.billing_type))];
  const shown = billing === 'all' ? plans : plans.filter((p) => p.billing_type === billing);
  const sorted = [...shown].sort((a, b) => a.price - b.price);

  const confirm = async () => {
    if (!selected) return;
    setSubmitting(true);
    try {
      await api.members.subscribePlan(selected.plan_id);
      fire(window.innerWidth / 2, window.innerHeight / 2, 100);
      toast.success(`${selected.plan_name} activated!`, 'Time to book your first class.');
      setSelected(null);
      onSubscribed();
    } catch (err) {
      toast.error("Couldn't change plan", getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const isCurrent = (p: MembershipPlan) => p.plan_id === profile.plan_id && profile.member_status === 'Active';

  return (
    <section id="plans" className="mt-12 scroll-mt-24">
      {confetti}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-volt">Membership</p>
          <h2 className="mt-1 font-display text-3xl font-bold uppercase">Choose your plan</h2>
        </div>
        {billingTypes.length > 1 && (
          <div className="inline-flex rounded-xl border border-border bg-obsidian-light p-1">
            {['all', ...billingTypes].map((b) => (
              <button
                key={b}
                onClick={() => setBilling(b)}
                className={cn(
                  'rounded-lg px-4 py-1.5 text-sm font-semibold capitalize transition-colors cursor-pointer',
                  billing === b ? 'bg-volt text-obsidian' : 'text-text-secondary hover:text-text-primary',
                )}
              >
                {b}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {sorted.map((p, i) => {
          const current = isCurrent(p);
          const premium = p.class_quota === null;
          const perMonth = p.price / p.duration_months;
          return (
            <motion.div
              key={p.plan_id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              className={cn(
                'relative flex flex-col rounded-2xl border p-6 transition-all duration-300',
                current
                  ? 'border-volt bg-volt/5 glow-volt-subtle'
                  : premium
                    ? 'border-cyan/30 bg-surface/80 hover:border-cyan/60'
                    : 'border-border bg-surface/80 hover:border-border-hover',
                'hover:-translate-y-1',
              )}
            >
              {current && (
                <span className="absolute -top-3 left-6 rounded-full bg-volt px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider text-obsidian">
                  Current plan
                </span>
              )}
              {!current && premium && (
                <span className="absolute -top-3 left-6 flex items-center gap-1 rounded-full bg-cyan px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider text-obsidian">
                  <Crown className="h-3 w-3" /> Unlimited
                </span>
              )}
              <p className="text-xs font-bold uppercase tracking-wider text-text-muted">{p.billing_type}</p>
              <h3 className="mt-1 font-display text-2xl font-bold uppercase">{p.plan_name}</h3>
              <p className="mt-4 font-display text-4xl font-bold">
                {formatCurrency(p.price)}
              </p>
              <p className="text-xs text-text-muted">
                {p.duration_months === 1 ? 'per month' : `for ${p.duration_months} months · ${formatCurrency(perMonth)}/mo`}
              </p>

              <ul className="mt-5 space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  {premium ? <InfinityIcon className="h-4 w-4 text-cyan" /> : <Check className="h-4 w-4 text-volt" />}
                  {premium ? 'Unlimited classes' : `${p.class_quota} classes / month`}
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-volt" /> Waitlist auto-promotion
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-volt" /> {p.duration_months} month{p.duration_months > 1 ? 's' : ''} access
                </li>
              </ul>

              <Button
                className="mt-6"
                fullWidth
                variant={current ? 'secondary' : premium ? 'cyan' : 'primary'}
                disabled={current}
                onClick={() => setSelected(p)}
              >
                {current ? 'Active' : profile.member_status === 'Active' ? 'Switch plan' : 'Choose plan'}
              </Button>
            </motion.div>
          );
        })}
      </div>

      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        locked={submitting}
        size="sm"
        icon={<CreditCard className="h-5 w-5" />}
        title={`Activate ${selected?.plan_name ?? ''}?`}
        description={selected ? `${formatCurrency(selected.price)} · ${selected.duration_months} month(s)` : undefined}
        footer={
          <>
            <Button variant="secondary" onClick={() => setSelected(null)} disabled={submitting}>
              Not now
            </Button>
            <Button onClick={confirm} loading={submitting}>
              Confirm
            </Button>
          </>
        }
      >
        <p className="text-sm text-text-secondary">
          Your membership will start <span className="font-semibold text-text-primary">today</span> and run for{' '}
          {selected?.duration_months} month(s).
          {profile.member_status === 'Active' && ' This replaces your current plan immediately.'}
        </p>
      </Modal>
    </section>
  );
}
