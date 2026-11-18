import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Hourglass, KeyRound, LogIn, User } from 'lucide-react';
import { AuthShell } from './AuthShell';
import { Button, Input } from '../../components/ui';
import { api, ApiError, getErrorMessage } from '../../lib/api';
import { useAuthStore } from '../../stores/authStore';
import { toast } from '../../stores/toastStore';
import { cn, roleHome } from '../../lib/utils';

const DEMO_ACCOUNTS = [
  { label: 'Admin', username: 'admin', password: 'admin123', tone: 'text-cyan border-cyan/30 hover:bg-cyan/10' },
  { label: 'Member', username: 'somchai', password: 'member123', tone: 'text-volt border-volt/30 hover:bg-volt/10' },
  { label: 'Trainer', username: 'praewa', password: 'trainer123', tone: 'text-warning border-warning/30 hover:bg-warning/10' },
];

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const login = useAuthStore((s) => s.login);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  const from = (location.state as { from?: string } | null)?.from;

  const submit = async (e?: FormEvent, creds?: { username: string; password: string }) => {
    e?.preventDefault();
    const u = creds?.username ?? username;
    const p = creds?.password ?? password;
    if (!u || !p) {
      setError('Enter your username and password');
      return;
    }
    setLoading(true);
    setError('');
    setPending(false);
    try {
      const res = await api.auth.login({ username: u.trim(), password: p });
      login(res.token, res.user);
      toast.success(`Welcome back, ${res.user.username}!`, "Let's get moving.");
      const home = roleHome(res.user.role);
      navigate(from && from.startsWith(home) ? from : home, { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.status === 403 && /pending/i.test(err.message)) {
        setPending(true);
      } else {
        setError(getErrorMessage(err));
      }
    } finally {
      setLoading(false);
    }
  };

  const quickFill = (acc: (typeof DEMO_ACCOUNTS)[number]) => {
    setUsername(acc.username);
    setPassword(acc.password);
    void submit(undefined, acc);
  };

  return (
    <AuthShell>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <p className="text-xs font-bold uppercase tracking-[0.25em] text-volt">Member access</p>
        <h2 className="mt-2 font-display text-4xl font-bold uppercase">Sign in</h2>
        <p className="mt-2 text-text-secondary">
          New here?{' '}
          <Link to="/register" className="font-semibold text-volt hover:underline">
            Create an account
          </Link>
        </p>

        {params.get('expired') && (
          <div className="mt-6 rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
            Your session expired. Please sign in again.
          </div>
        )}

        {pending && (
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mt-6 flex gap-3 rounded-xl border border-warning/30 bg-warning/10 p-4"
          >
            <Hourglass className="h-5 w-5 shrink-0 text-warning" />
            <div>
              <p className="text-sm font-semibold text-warning">Application under review</p>
              <p className="mt-0.5 text-sm text-text-secondary">
                Your trainer application is pending admin approval. You'll be able to sign in once it's approved.
              </p>
            </div>
          </motion.div>
        )}

        <form onSubmit={submit} className="mt-8 space-y-5">
          <Input
            label="Username"
            icon={<User />}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            placeholder="your.username"
            autoFocus
          />
          <Input
            label="Password"
            type="password"
            icon={<KeyRound />}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            placeholder="••••••••"
          />
          {error && (
            <motion.p
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: [0, -6, 6, -3, 0] }}
              className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger"
            >
              {error}
            </motion.p>
          )}
          <Button type="submit" size="lg" fullWidth loading={loading} iconRight={<ArrowRight className="h-4 w-4" />}>
            Sign in
          </Button>
        </form>

        <div className="mt-10">
          <div className="flex items-center gap-3 text-xs uppercase tracking-wider text-text-muted">
            <span className="h-px flex-1 bg-border" />
            Demo accounts
            <span className="h-px flex-1 bg-border" />
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {DEMO_ACCOUNTS.map((acc) => (
              <button
                key={acc.username}
                type="button"
                onClick={() => quickFill(acc)}
                disabled={loading}
                className={cn(
                  'flex flex-col items-center gap-1 rounded-xl border bg-obsidian-light px-3 py-3 text-xs transition-colors cursor-pointer disabled:opacity-50',
                  acc.tone,
                )}
              >
                <LogIn className="h-4 w-4" />
                <span className="font-bold uppercase tracking-wider">{acc.label}</span>
                <span className="text-text-muted">{acc.username}</span>
              </button>
            ))}
          </div>
        </div>
      </motion.div>
    </AuthShell>
  );
}
