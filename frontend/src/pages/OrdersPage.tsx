import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ordersApi } from '../services/orders';
import { SpinnerIcon } from '../components/common';
import type { Order, OrderStatus } from '../types';

const STATUS_COLOR: Record<OrderStatus, string> = {
  pending:    'bg-yellow-100 text-yellow-700',
  confirmed:  'bg-blue-100 text-blue-700',
  processing: 'bg-blue-100 text-blue-700',
  shipped:    'bg-indigo-100 text-indigo-700',
  delivered:  'bg-green-100 text-green-700',
  cancelled:  'bg-red-100 text-red-600',
  refunded:   'bg-gray-100 text-gray-600',
};

function OrderCard({ order }: { order: Order }) {
  return (
    <Link
      to={`/orders/${order.id}`}
      className="block bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md transition-shadow"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-mono text-xs text-gray-400 mb-1">#{order.id.slice(0, 8).toUpperCase()}</p>
          <p className="font-semibold text-gray-900 text-sm">
            {order.items?.length ?? 0} item{(order.items?.length ?? 0) !== 1 ? 's' : ''}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {new Date(order.createdAt).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
          </p>
        </div>
        <div className="text-right flex flex-col items-end gap-2">
          <span className={`text-xs font-semibold px-2 py-1 rounded-full ${STATUS_COLOR[order.status]}`}>
            {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
          </span>
          <p className="font-bold text-gray-900">₹{parseFloat(order.totalAmount).toFixed(2)}</p>
        </div>
      </div>
    </Link>
  );
}

export default function OrdersPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['my-orders'],
    queryFn: () => ordersApi.getMy().then((r) => r.data.data.orders as Order[]),
  });

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">My Orders</h1>

      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <SpinnerIcon className="w-8 h-8 text-indigo-600" />
        </div>
      ) : isError ? (
        <div className="text-center text-red-500 py-12">Failed to load orders.</div>
      ) : data?.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-gray-500 mb-4">You haven't placed any orders yet.</p>
          <Link to="/products" className="text-indigo-600 hover:underline font-medium">
            Start shopping →
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {data?.map((order) => <OrderCard key={order.id} order={order} />)}
        </div>
      )}
    </div>
  );
}
