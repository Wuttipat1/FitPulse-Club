import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { isTokenExpired, useAuthStore } from '../../stores/authStore';
import { roleHome } from '../../lib/utils';
import type { Role } from '../../types';

interface ProtectedRouteProps {
  /** Roles allowed through. Omit to allow any signed-in user. */
  roles?: Role[];
}

/**
 * Gate for authenticated routes.
 *  - Not signed in / token expired → /login (remembers where you were going)
 *  - Wrong role → that role's home
 */
export function ProtectedRoute({ roles }: ProtectedRouteProps) {
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const location = useLocation();

  if (!token || !user || isTokenExpired(token)) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (roles && !roles.includes(user.role)) {
    return <Navigate to={roleHome(user.role)} replace />;
  }

  return <Outlet />;
}

/** For /login and /register: bounce signed-in users to their dashboard. */
export function GuestRoute() {
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  if (token && user && !isTokenExpired(token)) {
    return <Navigate to={roleHome(user.role)} replace />;
  }
  return <Outlet />;
}
