import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Award, Check, Inbox, Mail, Phone, TriangleAlert, UserCheck, Users, X } from 'lucide-react';
import { Avatar, Badge, Button, Card, CardHeader, EmptyState, Modal, PageHeader, Skeleton, Tabs } from '../../components/ui';
import { api, getErrorMessage } from '../../lib/api';
import { useFetch } from '../../lib/hooks';
import { toast } from '../../stores/toastStore';
import { formatLongDate, getInitials, timeAgo } from '../../lib/utils';
import type { Trainer } from '../../types';

type Tab = 'pending' | 'active';

export default function AdminTrainers() {
  const { data, loading, error, reload, setData } = useFetch(
    () => Promise.all([api.admin.pendingTrainers(), api.trainers.list()]),
    [],
  );
  const [tab, setTab] = useState<Tab>('pending');
  const [busy, setBusy] = useState<number | null>(null);
  const [toReject, setToReject] = useState<Trainer | null>(null);

  const pending = data?.[0] ?? [];
  const active = data?.[1] ?? [];

  const approve = async (t: Trainer) => {
    setBusy(t.user_id);
    try {
      const res = await api.admin.approveTrainer(t.user_id);
      setData((prev) =>
        prev
          ? [prev[0].filter((x) => x.user_id !== t.user_id), [...prev[1], { ...t, ...res.trainer, phones: t.phones }]]
          : prev,
      );
      toast.success(`${t.first_name} approved`, 'They can now sign in and be scheduled.');
    } catch (err) {
      toast.error('Approval failed', getErrorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const reject = async () => {
    if (!toReject) return;
    setBusy(toReject.user_id);
    try {
      await api.admin.rejectTrainer(toReject.user_id);
      setData((prev) => (prev ? [prev[0].filter((x) => x.user_id !== toReject.user_id), prev[1]] : prev));
      toast.info('Application rejected', `${toReject.first_name} ${toReject.last_name}'s account was removed.`);
      setToReject(null);
    } catch (err) {
      toast.error('Rejection failed', getErrorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow="Team"
        title="Trainers"
        subtitle="Review new coach applications and see who's on the roster."
      />

      <Tabs<Tab>
        className="mb-6"
        layoutId="trainer-tabs"
        value={tab}
        onChange={setTab}
        items={[
          { value: 'pending', label: 'Pending', count: pending.length, icon: <Inbox /> },
          { value: 'active', label: 'Active', count: active.length, icon: <Users /> },
        ]}
      />

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-56 rounded-2xl" />
          ))}
        </div>
      ) : error ? (
        <EmptyState icon={<TriangleAlert />} title="Couldn't load trainers" description={error} action={<Button onClick={reload}>Retry</Button>} />
      ) : tab === 'pending' ? (
        pending.length === 0 ? (
          <EmptyState icon={<UserCheck />} title="Inbox zero" description="No trainer applications are waiting for review." />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            <AnimatePresence mode="popLayout">
              {pending.map((t) => (
                <motion.div
                  key={t.user_id}
                  layout
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
                >
                  <Card className="border-warning/20">
                    <div className="flex items-start gap-4">
                      <Avatar initials={getInitials(t.first_name, t.last_name)} size="lg" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-display text-xl font-bold uppercase">
                            {t.first_name} {t.last_name}
                          </p>
                          <Badge status="Pending" dot pulse />
                        </div>
                        <p className="text-sm text-text-muted">
                          @{t.username}
                          {t.created_at && ` · applied ${timeAgo(t.created_at)}`}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {t.specialization.split(',').map((s) => (
                        <Badge key={s} tone="volt">
                          {s.trim()}
                        </Badge>
                      ))}
                    </div>

                    <dl className="mt-4 grid gap-2 text-sm text-text-secondary sm:grid-cols-2">
                      <div className="flex items-center gap-2">
                        <Award className="h-4 w-4 text-warning" /> {t.experience_years} years experience
                      </div>
                      <div className="flex items-center gap-2 truncate">
                        <Mail className="h-4 w-4 text-text-muted" /> {t.email}
                      </div>
                      {t.phones.map((p) => (
                        <div key={p} className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-text-muted" /> {p}
                        </div>
                      ))}
                    </dl>

                    <div className="mt-5 flex gap-2 border-t border-border pt-4">
                      <Button
                        className="flex-1"
                        icon={<Check className="h-4 w-4" />}
                        loading={busy === t.user_id && !toReject}
                        disabled={busy !== null}
                        onClick={() => approve(t)}
                      >
                        Approve
                      </Button>
                      <Button
                        className="flex-1"
                        variant="danger"
                        icon={<X className="h-4 w-4" />}
                        disabled={busy !== null}
                        onClick={() => setToReject(t)}
                      >
                        Reject
                      </Button>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )
      ) : active.length === 0 ? (
        <EmptyState icon={<Users />} title="No active trainers" />
      ) : (
        <Card padding="none">
          <div className="p-5 pb-0">
            <CardHeader title="Coaching staff" subtitle={`${active.length} active`} icon={<Users className="h-5 w-5" />} />
          </div>
          <ul className="divide-y divide-border">
            {active.map((t) => (
              <li key={t.trainer_id} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center">
                <div className="flex flex-1 items-center gap-3">
                  <Avatar initials={getInitials(t.first_name, t.last_name)} />
                  <div className="min-w-0">
                    <p className="font-semibold">
                      {t.first_name} {t.last_name}
                    </p>
                    <p className="truncate text-xs text-text-muted">{t.specialization}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-text-secondary">
                  <span className="flex items-center gap-1.5">
                    <Award className="h-3.5 w-3.5" /> {t.experience_years} yrs
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5" /> {t.email}
                  </span>
                  {t.hire_date && <span>Hired {formatLongDate(t.hire_date)}</span>}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Modal
        open={!!toReject}
        onClose={() => setToReject(null)}
        locked={busy !== null}
        size="sm"
        icon={<TriangleAlert className="h-5 w-5" />}
        title="Reject application?"
        description={toReject ? `${toReject.first_name} ${toReject.last_name} (@${toReject.username})` : undefined}
        footer={
          <>
            <Button variant="secondary" onClick={() => setToReject(null)} disabled={busy !== null}>
              Cancel
            </Button>
            <Button variant="danger" onClick={reject} loading={busy !== null}>
              Reject & delete
            </Button>
          </>
        }
      >
        <p className="text-sm text-text-secondary">
          This permanently deletes the applicant's account and contact details. They'd need to apply again.
        </p>
      </Modal>
    </div>
  );
}
