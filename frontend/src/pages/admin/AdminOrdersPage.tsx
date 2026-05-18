import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminOrdersApi } from '../../services/admin';
import { SpinnerIcon } from '../../components/common';

const ALL_STATUSES = ['pending','confirmed','processing','shipped','delivered','cancelled','refunded'] as const;

const STATUS_COLORS: Record<string, string> = {
  pending:    'bg-yellow-100 text-yellow-800',
  confirmed:  'bg-blue-100 text-blue-800',
  processing: 'bg-indigo-100 text-indigo-800',
  shipped:    'bg-purple-100 text-purple-800',
  delivered:  'bg-green-100 text-green-800',
  cancelled:  'bg-red-100 text-red-800',
  refunded:   'bg-gray-100 text-gray-600',
};

// Valid status transitions (mirrors backend logic)
const NEXT_STATUSES: Record<string, string[]> = {
  pending:    ['confirmed', 'cancelled'],
  confirmed:  ['processing', 'cancelled'],
  processing: ['shipped'],
  shipped:    ['delivered'],
  delivered:  [],
  cancelled:  [],
  refunded:   [],
};

export default function AdminOrdersPage() {
  const qc = useQueryClient();
  const [page, setPage]         = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [updatingId, setUpdatingId]     = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'orders', page, statusFilter],
    queryFn: () =>
      adminOrdersApi.getAll({ page, limit: 20, status: statusFilter || undefined })
        .then((r) => r.data.data),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      adminOrdersApi.updateStatus(id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'orders'] });
      qc.invalidateQueries({ queryKey: ['admin', 'stats'] });
      setUpdatingId(null);
    },
    onError: (err: any) => {
      alert(err.response?.data?.message ?? 'Status update failed');
      setUpdatingId(null);
    },
  });

  const orders     = data?.orders     ?? [];
  const totalPages = data?.totalPages ?? 1;

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Orders</h1>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">All statuses</option>
          {ALL_STATUSES.map((s) => (
            <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center h-40">
          <SpinnerIcon className="w-8 h-8 text-indigo-600" />
        </div>
      ) : (
        <>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Order ID</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">User</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Date</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Amount</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">Status</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">Update Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {orders.map((order) => {
                  const nextOpts = NEXT_STATUSES[order.status] ?? [];
                  return (
                    <tr key={order.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono text-xs text-gray-500">
                        {order.id.substring(0, 8)}…
                      </td>
                      <td className="px-4 py-3 text-gray-600 font-mono text-xs">
                        {order.user_id.substring(0, 8)}…
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {new Date(order.created_at).toLocaleDateString('en-IN', {
                          day: '2-digit', month: 'short', year: 'numeric',
                        })}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900">
                        ₹{parseFloat(order.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLORS[order.status] ?? 'bg-gray-100 text-gray-600'}`}>
                          {order.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {nextOpts.length > 0 ? (
                          <div className="flex justify-center gap-1 flex-wrap">
                            {nextOpts.map((next) => (
                              <button
                                key={next}
                                disabled={statusMutation.isPending && updatingId === order.id}
                                onClick={() => {
                                  setUpdatingId(order.id);
                                  statusMutation.mutate({ id: order.id, status: next });
                                }}
                                className={`text-xs px-2 py-1 rounded-md border font-medium transition-colors
                                  ${STATUS_COLORS[next] ?? 'bg-gray-100 text-gray-600'}
                                  hover:opacity-80 disabled:opacity-50`}
                              >
                                {statusMutation.isPending && updatingId === order.id
                                  ? '…'
                                  : `→ ${next}`}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">Terminal</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {orders.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center text-gray-400 py-10">No orders found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-5">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`w-9 h-9 rounded-lg text-sm font-medium ${
                    page === p ? 'bg-indigo-600 text-white' : 'border border-gray-300 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
