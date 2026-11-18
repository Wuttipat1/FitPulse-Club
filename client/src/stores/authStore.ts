import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { AuthUser } from '../types';

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  login: (token: string, user: AuthUser) => void;
  logout: () => void;
}

/** Decode the JWT payload (no verification — server does that) and check `exp`. */
export function isTokenExpired(token: string | null): boolean {
  if (!token) return true;
  try {
    const part = token.split('.')[1];
    if (!part) return true;
    const json = atob(part.replace(/-/g, '+').replace(/_/g, '/'));
    const payload = JSON.parse(json) as { exp?: number };
    if (!payload.exp) return false;
    return payload.exp * 1000 <= Date.now();
  } catch {
    return true;
  }
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      login: (token, user) => set({ token, user }),
      logout: () => set({ token: null, user: null }),
    }),
    {
      name: 'fitpulse-auth',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ token: state.token, user: state.user }),
      onRehydrateStorage: () => (state) => {
        // Drop stale sessions on page load
        if (state && state.token && isTokenExpired(state.token)) {
          state.logout();
        }
      },
    },
  ),
);

/** Convenience selector: true when a non-expired token is present. */
export function useIsAuthenticated(): boolean {
  const token = useAuthStore((s) => s.token);
  return !!token && !isTokenExpired(token);
}
