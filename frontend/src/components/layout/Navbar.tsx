import { Link, useNavigate } from 'react-router-dom';
import { ShoppingCartIcon, UserIcon } from './Icons';
import useAuthStore from '../../store/authStore';
import { authApi } from '../../services/auth';
import { useQuery } from '@tanstack/react-query';
import { cartApi } from '../../services/cart';

export default function Navbar() {
  const { isAuthenticated, user, logout } = useAuthStore();
  const navigate = useNavigate();

  const { data: cartData } = useQuery({
    queryKey: ['cart'],
    queryFn: () => cartApi.get().then((r) => r.data.data),
    enabled: isAuthenticated,
  });

  const itemCount = cartData?.itemCount ?? 0;

  const handleLogout = async () => {
    await authApi.logout().catch(() => {});
    logout();
    navigate('/login');
  };

  return (
    <nav className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <Link to="/" className="text-xl font-bold text-indigo-600 tracking-tight">
          ShopWave
        </Link>

        {/* Nav links */}
        <div className="hidden md:flex gap-6 text-sm font-medium text-gray-700">
          <Link to="/products" className="hover:text-indigo-600 transition-colors">Products</Link>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-4">
          {/* Cart icon */}
          <Link to="/cart" className="relative p-2 hover:text-indigo-600 transition-colors">
            <ShoppingCartIcon className="w-6 h-6" />
            {itemCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-indigo-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                {itemCount}
              </span>
            )}
          </Link>

          {isAuthenticated ? (
            <div className="flex items-center gap-3">
              <Link to="/orders" className="text-sm text-gray-600 hover:text-indigo-600">
                Orders
              </Link>
              <span className="text-sm text-gray-500">{user?.firstName}</span>
              {user?.role === 'admin' && (
                <Link to="/admin" className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded font-semibold">
                  Admin
                </Link>
              )}
              <button
                onClick={handleLogout}
                className="text-sm text-gray-600 hover:text-red-500 transition-colors"
              >
                Logout
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link to="/login" className="flex items-center gap-1 text-sm text-gray-600 hover:text-indigo-600">
                <UserIcon className="w-4 h-4" />
                Login
              </Link>
              <Link
                to="/register"
                className="text-sm bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 transition-colors"
              >
                Sign up
              </Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
