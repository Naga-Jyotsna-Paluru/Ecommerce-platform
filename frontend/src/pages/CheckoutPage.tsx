import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cartApi } from '../services/cart';
import { ordersApi } from '../services/orders';
import { SpinnerIcon } from '../components/common';

interface AddressForm {
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export default function CheckoutPage() {
  const navigate     = useNavigate();
  const queryClient  = useQueryClient();

  const [address, setAddress] = useState<AddressForm>({
    street: '', city: '', state: '', postalCode: '', country: 'India',
  });
  const [error, setError] = useState('');

  const { data: cart, isLoading } = useQuery({
    queryKey: ['cart'],
    queryFn: () => cartApi.get().then((r) => r.data.data),
  });

  const placeOrder = useMutation({
    mutationFn: () => ordersApi.create({
      items: (cart?.items ?? []).map((i) => ({ productId: i.productId, quantity: i.quantity })),
      shippingAddress: address,
    }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['cart'] });
      queryClient.invalidateQueries({ queryKey: ['my-orders'] });
      navigate(`/orders/${res.data.data.id}`);
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })
        ?.response?.data?.message ?? 'Failed to place order.';
      setError(msg);
    },
  });

  const update = (field: keyof AddressForm) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setAddress((a) => ({ ...a, [field]: e.target.value }));

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError('');
    placeOrder.mutate();
  };

  if (isLoading) return <div className="flex justify-center items-center h-64"><SpinnerIcon className="w-8 h-8 text-indigo-600" /></div>;
  if (!cart || cart.items.length === 0) {
    navigate('/cart');
    return null;
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Checkout</h1>

      <div className="grid md:grid-cols-5 gap-8">
        {/* Address form */}
        <div className="md:col-span-3">
          <div className="bg-white border border-gray-200 rounded-2xl p-6">
            <h2 className="font-semibold text-gray-900 mb-4">Shipping Address</h2>

            {error && (
              <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">{error}</div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {[
                { id: 'street',     label: 'Street address', placeholder: '123 Main St' },
                { id: 'city',       label: 'City',           placeholder: 'Bengaluru' },
                { id: 'state',      label: 'State',          placeholder: 'Karnataka' },
                { id: 'postalCode', label: 'Postal code',    placeholder: '560001' },
                { id: 'country',    label: 'Country',        placeholder: 'India' },
              ].map(({ id, label, placeholder }) => (
                <div key={id}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                  <input
                    type="text"
                    required
                    value={address[id as keyof AddressForm]}
                    onChange={update(id as keyof AddressForm)}
                    placeholder={placeholder}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              ))}

              <button
                type="submit"
                disabled={placeOrder.isPending}
                className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white py-3 rounded-xl font-semibold hover:bg-indigo-700 disabled:opacity-60 transition-colors mt-2"
              >
                {placeOrder.isPending && <SpinnerIcon className="w-4 h-4" />}
                Place Order
              </button>
            </form>
          </div>
        </div>

        {/* Order summary */}
        <div className="md:col-span-2">
          <div className="bg-white border border-gray-200 rounded-2xl p-6 sticky top-24">
            <h2 className="font-semibold text-gray-900 mb-4">Order Summary</h2>
            <div className="space-y-2 text-sm">
              {cart.items.map((item) => (
                <div key={item.productId} className="flex justify-between">
                  <span className="text-gray-600 truncate mr-2">{item.name} × {item.quantity}</span>
                  <span className="font-medium whitespace-nowrap">₹{item.subtotal.toFixed(2)}</span>
                </div>
              ))}
            </div>
            <div className="border-t border-gray-100 mt-4 pt-4 flex justify-between">
              <span className="font-bold">Total</span>
              <span className="font-bold text-indigo-600">₹{cart.total.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
