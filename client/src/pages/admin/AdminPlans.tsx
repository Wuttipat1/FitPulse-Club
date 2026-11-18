import { useState, type FormEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CalendarRange, Check, CreditCard, Infinity as InfinityIcon, Pencil, Plus, Power, Tag, TriangleAlert } from 'lucide-react';
import { Badge, Button, EmptyState, Input, Modal, PageHeader, Select, Skeleton } from '../../components/ui';
import { api, getErrorMessage } from '../../lib/api';
import { useFetch } from '../../lib/hooks';
import { toast } from '../../stores/toastStore';
import { cn, formatCurrency } from '../../lib/utils';
import type { MembershipPlan } from '../../types';

interface PlanForm {
  plan_name: string;
  duration_months: string;
  price: string;
  billing_type: string;
  unlimited: boolean;
  class_quota: string;
}

const BILLING_TYPES = ['Monthly', 'Quarterly', 'Annual'];

const toForm = (p?: MembershipPlan): PlanForm => ({
  plan_name: p?.plan_name ?? '',
  duration_months: String(p?.duration_months ?? 1),
  price: p ? String(p.price) : '',
  billing_type: p?.billing_type ?? 'Monthly',
  unlimited: p ? p.class_quota === null : false,
  class_quota: p?.class_quota != null ? String(p.class_quota) : '8',
});

const isActive = (p: MembershipPlan) => Boolean(Number(p.is_active));

export default function AdminPlans() {
  const { data, loading, error, reload, setData } = useFetch(() => api.plans.all(), []);
  const [editing, setEditing] = useState<MembershipPlan | 'new' | null>(null);
  const [toggling, setToggling] = useState<number | null>(null);
  const [showInactive, setShowInactive] = useState(true);

  const plans = (data ?? []).slice().sort((a, b) => Number(isActive(b)) - Number(isActive(a)) || a.price - b.price);
  const shown = showInactive ? plans : plans.filter(isActive);

  const toggleActive = async (p: MembershipPlan) => {
    const next = !isActive(p);
    setToggling(p.plan_id);
    try {
      await api.plans.update(p.plan_id, {
        plan_name: p.plan_name,
        duration_months: p.duration_months,
        price: p.price,
        billing_type: p.billing_type,
        class_quota: p.class_quota,
        is_active: next ? 1 : 0,
      });
      setData((prev) => (prev ? prev.map((x) => (x.plan_id === p.plan_id ? { ...x, is_active: next ? 1 : 0 } : x)) : prev));
      toast.success(next ? 'Plan activated' : 'Plan deactivated', next ? `${p.plan_name} is now visible to members.` : `${p.plan_name} is hidden from new sign-ups.`);
    } catch (err) {
      toast.error("Couldn't update plan", getErrorMessage(err));
    } finally {
      setToggling(null);
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow="Revenue"
        title="Membership plans"
        subtitle="Create and tune the plans members can subscribe to."
        action={
          <Button icon={<Plus className="h-4 w-4" />} onClick={() => setEditing('new')}>
            New plan
          </Button>
        }
      />

      <label className="mb-6 inline-flex cursor-pointer items-center gap-2 text-sm text-text-secondary select-none">
        <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} className="h-4 w-4 accent-[#CCFF00]" />
        Show inactive plans
      </label>

      {loading ? (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-72 rounded-2xl" />
          ))}
        </div>
      ) : error ? (
        <EmptyState icon={<TriangleAlert />} title="Couldn't load plans" description={error} action={<Button onClick={reload}>Retry</Button>} />
      ) : shown.length === 0 ? (
        <EmptyState icon={<CreditCard />} title="No plans yet" action={<Button onClick={() => setEditing('new')}>Create a plan</Button>} />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          <AnimatePresence mode="popLayout">
            {shown.map((p, i) => {
              const active = isActive(p);
              return (
                <motion.div
                  key={p.plan_id}
                  layout
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: i * 0.04 }}
                  className={cn(
                    'flex flex-col rounded-2xl border bg-surface/80 p-6 transition-all',
                    active ? 'border-border hover:border-border-hover' : 'border-dashed border-border opacity-60',
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <Badge tone={active ? 'success' : 'neutral'} dot pulse={active}>
                      {active ? 'Active' : 'Inactive'}
                    </Badge>
                    <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">{p.billing_type}</span>
                  </div>
                  <h3 className="mt-4 font-display text-2xl font-bold uppercase">{p.plan_name}</h3>
                  <p className="mt-2 font-display text-4xl font-bold text-volt">{formatCurrency(p.price)}</p>
                  <p className="text-xs text-text-muted">
                    {p.duration_months} month{p.duration_months > 1 ? 's' : ''} ·{' '}
                    {formatCurrency(p.price / p.duration_months)}/mo
                  </p>
                  <div className="mt-4 flex items-center gap-2 text-sm">
                    {p.class_quota === null ? (
                      <>
                        <InfinityIcon className="h-4 w-4 text-cyan" /> Unlimited classes
                      </>
                    ) : (
                      <>
                        <Check className="h-4 w-4 text-volt" /> {p.class_quota} classes / month
                      </>
                    )}
                  </div>
                  <div className="mt-auto flex gap-2 pt-6">
                    <Button variant="secondary" size="sm" className="flex-1" icon={<Pencil className="h-3.5 w-3.5" />} onClick={() => setEditing(p)}>
                      Edit
                    </Button>
                    <Button
                      variant={active ? 'danger' : 'outline'}
                      size="sm"
                      className="flex-1"
                      loading={toggling === p.plan_id}
                      icon={<Power className="h-3.5 w-3.5" />}
                      onClick={() => toggleActive(p)}
                    >
                      {active ? 'Disable' : 'Enable'}
                    </Button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      <PlanModal
        plan={editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          void reload();
        }}
      />
    </div>
  );
}

function PlanModal({
  plan,
  onClose,
  onSaved,
}: {
  plan: MembershipPlan | 'new' | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isNew = plan === 'new';
  const existing = plan && plan !== 'new' ? plan : undefined;
  const [form, setForm] = useState<PlanForm>(toForm());
  const [errors, setErrors] = useState<Partial<Record<keyof PlanForm, string>>>({});
  const [saving, setSaving] = useState(false);
  const [lastPlan, setLastPlan] = useState<typeof plan>(null);

  // Reset form whenever a different plan is opened
  if (plan !== lastPlan) {
    setLastPlan(plan);
    if (plan) {
      setForm(toForm(existing));
      setErrors({});
    }
  }

  const set = <K extends keyof PlanForm>(k: K, v: PlanForm[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    const errs: typeof errors = {};
    const duration = Number(form.duration_months);
    const price = Number(form.price);
    const quota = Number(form.class_quota);
    if (!form.plan_name.trim()) errs.plan_name = 'Required';
    if (!Number.isInteger(duration) || duration < 1) errs.duration_months = 'Whole months ≥ 1';
    if (form.price === '' || Number.isNaN(price) || price < 0) errs.price = 'Price ≥ 0';
    if (!form.unlimited && (!Number.isInteger(quota) || quota < 1)) errs.class_quota = 'At least 1';
    setErrors(errs);
    if (Object.keys(errs).length) return;

    const payload = {
      plan_name: form.plan_name.trim(),
      duration_months: duration,
      price,
      billing_type: form.billing_type,
      class_quota: form.unlimited ? null : quota,
    };
    setSaving(true);
    try {
      if (existing) {
        await api.plans.update(existing.plan_id, { ...payload, is_active: Number(existing.is_active) ? 1 : 0 });
        toast.success('Plan updated', payload.plan_name);
      } else {
        await api.plans.create(payload);
        toast.success('Plan created', payload.plan_name);
      }
      onSaved();
    } catch (err) {
      toast.error("Couldn't save plan", getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const perMonth = Number(form.price) / Math.max(Number(form.duration_months) || 1, 1);

  return (
    <Modal
      open={!!plan}
      onClose={onClose}
      locked={saving}
      icon={<CreditCard className="h-5 w-5" />}
      title={isNew ? 'New plan' : `Edit ${existing?.plan_name ?? ''}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => submit()} loading={saving}>
            {isNew ? 'Create plan' : 'Save changes'}
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <Input label="Plan name" icon={<Tag />} value={form.plan_name} onChange={(e) => set('plan_name', e.target.value)} error={errors.plan_name} placeholder="e.g. Student Monthly" />
        <div className="grid grid-cols-2 gap-3">
          <Select
            label="Billing type"
            value={form.billing_type}
            onChange={(e) => {
              const b = e.target.value;
              set('billing_type', b);
              set('duration_months', b === 'Annual' ? '12' : b === 'Quarterly' ? '3' : '1');
            }}
            options={[...new Set([...BILLING_TYPES, form.billing_type])].map((b) => ({ value: b, label: b }))}
          />
          <Input
            label="Duration (months)"
            type="number"
            min={1}
            icon={<CalendarRange />}
            value={form.duration_months}
            onChange={(e) => set('duration_months', e.target.value)}
            error={errors.duration_months}
          />
        </div>
        <Input
          label="Price (THB)"
          type="number"
          min={0}
          step="1"
          value={form.price}
          onChange={(e) => set('price', e.target.value)}
          error={errors.price}
          hint={form.price && !Number.isNaN(perMonth) ? `≈ ${formatCurrency(perMonth)} per month` : undefined}
        />
        <div className="rounded-xl border border-border bg-obsidian-light/60 p-4">
          <label className="flex cursor-pointer items-center justify-between gap-3">
            <span>
              <span className="flex items-center gap-2 text-sm font-semibold">
                <InfinityIcon className="h-4 w-4 text-cyan" /> Unlimited classes
              </span>
              <span className="text-xs text-text-muted">No monthly booking quota</span>
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={form.unlimited}
              onClick={() => set('unlimited', !form.unlimited)}
              className={cn('relative h-6 w-11 rounded-full transition-colors cursor-pointer', form.unlimited ? 'bg-cyan' : 'bg-white/10')}
            >
              <motion.span
                layout
                className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow"
                style={{ left: form.unlimited ? 22 : 2 }}
              />
            </button>
          </label>
          <AnimatePresence initial={false}>
            {!form.unlimited && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <Input
                  containerClassName="pt-4"
                  label="Classes per month"
                  type="number"
                  min={1}
                  value={form.class_quota}
                  onChange={(e) => set('class_quota', e.target.value)}
                  error={errors.class_quota}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  );
}
