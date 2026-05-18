import { NavLink, Outlet } from 'react-router-dom';

const navItems = [
  { to: '/admin',          label: 'Dashboard', end: true },
  { to: '/admin/products', label: 'Products'             },
  { to: '/admin/orders',   label: 'Orders'               },
];

export default function AdminLayout() {
  return (
    <div className="flex min-h-[calc(100vh-64px)]">
      {/* Sidebar */}
      <aside className="w-56 bg-gray-900 text-gray-300 flex flex-col shrink-0">
        <div className="px-6 py-5 border-b border-gray-700">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">Admin Panel</p>
        </div>
        <nav className="flex flex-col gap-1 p-3 flex-1">
          {navItems.map(({ to, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-indigo-600 text-white'
                    : 'hover:bg-gray-800 hover:text-white'
                }`
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* Main content */}
      <div className="flex-1 bg-gray-50 overflow-auto">
        <Outlet />
      </div>
    </div>
  );
}
