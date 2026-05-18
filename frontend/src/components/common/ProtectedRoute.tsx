import { Navigate, Outlet } from 'react-router-dom';
import useAuthStore from '../../store/authStore';

interface Props {
  requiredRole?: 'admin' | 'customer';
}

/**
 * Wraps protected routes. Redirects to /login if not authenticated.
 * Optionally enforces a role (e.g. admin-only sections).
 */
export default function ProtectedRoute({ requiredRole }: Props) {
  const { isAuthenticated, user } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRole && user?.role !== requiredRole) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
