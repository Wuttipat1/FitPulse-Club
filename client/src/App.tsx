import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { GuestRoute, ProtectedRoute } from './components/layout/ProtectedRoute';
import { ToastViewport } from './components/ui';
import { useAuthStore } from './stores/authStore';
import { roleHome } from './lib/utils';

import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';

import MemberDashboard from './pages/member/MemberDashboard';
import ClassBrowser from './pages/member/ClassBrowser';
import MyBookings from './pages/member/MyBookings';
import MemberProfile from './pages/member/MemberProfile';

import TrainerDashboard from './pages/trainer/TrainerDashboard';
import TrainerRoster from './pages/trainer/TrainerRoster';

import AdminDashboard from './pages/admin/AdminDashboard';
import AdminTrainers from './pages/admin/AdminTrainers';
import AdminSchedule from './pages/admin/AdminSchedule';
import AdminPlans from './pages/admin/AdminPlans';

/** "/" and unknown routes → the signed-in user's home, or /login. */
function HomeRedirect() {
  const user = useAuthStore((s) => s.user);
  return <Navigate to={roleHome(user?.role)} replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public (guests only) */}
        <Route element={<GuestRoute />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
        </Route>

        {/* Authenticated shell */}
        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route element={<ProtectedRoute roles={['Member']} />}>
              <Route path="/member" element={<MemberDashboard />} />
              <Route path="/member/classes" element={<ClassBrowser />} />
              <Route path="/member/bookings" element={<MyBookings />} />
              <Route path="/member/profile" element={<MemberProfile />} />
            </Route>

            <Route element={<ProtectedRoute roles={['Trainer']} />}>
              <Route path="/trainer" element={<TrainerDashboard />} />
              <Route path="/trainer/classes/:scheduleId" element={<TrainerRoster />} />
            </Route>

            <Route element={<ProtectedRoute roles={['Admin']} />}>
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/admin/trainers" element={<AdminTrainers />} />
              <Route path="/admin/schedule" element={<AdminSchedule />} />
              <Route path="/admin/plans" element={<AdminPlans />} />
            </Route>
          </Route>
        </Route>

        <Route path="/" element={<HomeRedirect />} />
        <Route path="*" element={<HomeRedirect />} />
      </Routes>
      <ToastViewport />
    </BrowserRouter>
  );
}
