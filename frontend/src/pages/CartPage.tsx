import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { cartApi } from '../services/cart';
import { SpinnerIcon } from '../components/common';
import type { CartItem } from '../types';

function CartRow({ item }: { item: CartItem }) {
  const queryClient = useQueryClient();

  const update = useMutation({
    mutationFn: (qty: number) => cartApi.updateItem(item.productId, qty),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cart'] }),
  });

  const remove = useMutation({
    mutationFn: () => cartApi.removeItem(item.productId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cart'] }),
  });

  return (
    <div className="flex items-center gap-4 py-4 border-b border-gray-100 last:border-0">
      <div className="flex-1 min-w-0">
        <p className="font-medium text-gray-900 truncate">{item.name}</p>
        <p className="text-sm text-gray-500">₹{item.price.toFixed(2)} each</p>
      </div>

      <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden">
        <button
          onClick={() => update.mutate(item.quantity - 1)}
          disabled={update.isPending}
          className="px-3 py-1.5 text-gray-600 hover:bg-gray-50 text-sm"
        >−</button>
        <span className="px-3 py-1.5 text-sm font-medium">{item.quantity}</span>
        <button
          onClick={() => update.mutate(item.quantity + 1)}
          disabled={update.isPending}
          className="px-3 py-1.5 text-gray-600 hover:bg-gray-50 text-sm"
        >+</button>
      </div>

      <p className="w-20 text-right font-semibold text-gray-900">₹{item.subtotal.toFixed(2)}</p>

      <button
        onClick={() => remove.mutate()}
        disabled={remove.isPending}
        className="text-red-400 hover:text-red-600 text-sm transition-colors"
      >
        {remove.isPending ? <SpinnerIcon className="w-4 h-4" /> : '✕'}
      </button>
    </div>
  );
}

export default function CartPage() {
  const navigate     = useNavigate();
  const queryClient  = useQueryClient();

  const { data: cart, isLoading } = useQuery({
    queryKey: ['cart'],
    queryFn: () => cartApi.get().then((r) => r.data.data),
  });

  const clearCart = useMutation({
    mutationFn: () => cartApi.clear(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cart'] }),
  });

  if (isLoading) return (
    <div className="flex justify-center items-center h-64">
      <SpinnerIcon className="w-8 h-8 text-indigo-600" />
    </div>
  );

  const items = cart?.items ?? [];

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Your Cart</h1>

      {items.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-gray-500 mb-4">Your cart is empty.</p>
          <Link to="/products" className="text-indigo-600 hover:underline font-medium">
            Browse products →
          </Link>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-2xl p-6">
          {items.map((item) => <CartRow key={item.productId} item={item} />)}

          <div className="flex items-center justify-between pt-4">
            <button
              onClick={() => clearCart.mutate()}
              disabled={clearCart.isPending}
              className="text-sm text-gray-400 hover:text-red-500 transition-colors"
            >
              Clear cart
            </button>
            <div className="text-right">
              <p className="text-sm text-gray-500">{cart?.itemCount} item{cart?.itemCount !== 1 ? 's' : ''}</p>
              <p className="text-xl font-bold text-gray-900">Total: ₹{cart?.total.toFixed(2)}</p>
            </div>
          </div>

          <button
            onClick={() => navigate('/checkout')}
            className="mt-4 w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold hover:bg-indigo-700 transition-colors"
          >
            Proceed to Checkout
          </button>
        </div>
      )}
    </div>
  );
}
