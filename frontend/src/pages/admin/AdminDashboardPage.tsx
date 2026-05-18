import { useQuery } from '@tanstack/react-query';
import { adminOrdersApi, adminProductsApi } from '../../services/admin';
import { SpinnerIcon } from '../../components/common';

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
}

function StatCard({ label, value, sub, color = 'indigo' }: StatCardProps) {
  const accent: Record<string, string> = {
    indigo: 'bg-indigo-50 text-indigo-700',
    green:  'bg-green-50  text-green-700',
    amber:  'bg-amber-50  text-amber-700',
    red:    'bg-red-50    text-red-700',
  };
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 flex flex-col gap-2">
      <p className="text-sm text-gray-500 font-medium">{label}</p>
      <p className={`text-3xl font-bold ${accent[color] ?? accent.indigo} rounded-lg px-3 py-1 w-fit`}>
        {value}
      </p>
      {sub && <p className="text-xs text-gray-400">{sub}</p>}
    </div>
  );
}

export default function AdminDashboardPage() {
  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: () => adminOrdersApi.getStats().then((r) => r.data.data?.stats),
  });

  const { data: productsData, isLoading: prodLoading } = useQuery({
    queryKey: ['admin', 'products-count'],
    queryFn: () => adminProductsApi.getAll({ limit: 1 }).then((r) => r.data.data?.total),
  });

  const loading = statsLoading || prodLoading;

  const revenue = statsData
    ? `₹${parseFloat(statsData.total_revenue).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
    : '—';

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>

      {loading ? (
        <div className="flex justify-center items-center h-40">
          <SpinnerIcon className="w-8 h-8 text-indigo-600" />
        </div>
      ) : (
        <>
          {/* Top stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <StatCard label="Total Orders"   value={statsData?.total_orders ?? 0} color="indigo" />
            <StatCard label="Total Revenue"  value={revenue}                       color="green"  />
            <StatCard label="Total Products" value={productsData ?? 0}             color="amber"  />
            <StatCard label="Cancelled"      value={statsData?.cancelled ?? 0}     color="red"    />
          </div>

          {/* Order status breakdown */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-sm font-semibold text-gray-700 mb-4 uppercase tracking-wide">Orders by Status</h2>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
              {([
                ['Pending',    statsData?.pending,    'bg-yellow-100 text-yellow-800'],
                ['Confirmed',  statsData?.confirmed,  'bg-blue-100 text-blue-800'],
                ['Processing', statsData?.processing, 'bg-indigo-100 text-indigo-800'],
                ['Shipped',    statsData?.shipped,    'bg-purple-100 text-purple-800'],
                ['Delivered',  statsData?.delivered,  'bg-green-100 text-green-800'],
                ['Cancelled',  statsData?.cancelled,  'bg-red-100 text-red-800'],
              ] as [string, string | undefined, string][]).map(([label, val, cls]) => (
                <div key={label} className={`rounded-lg px-3 py-3 text-center ${cls}`}>
                  <p className="text-2xl font-bold">{val ?? 0}</p>
                  <p className="text-xs font-medium mt-1">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
