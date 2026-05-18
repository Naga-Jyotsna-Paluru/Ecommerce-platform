import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { loadStripe } from '@stripe/stripe-js';
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';
import { cartApi } from '../services/cart';
import { ordersApi } from '../services/orders';
import { paymentsApi } from '../services/payments';
import { SpinnerIcon } from '../components/common';

// ─── Stripe initialisation ───────────────────────────────────────────────────
// VITE_STRIPE_PUBLISHABLE_KEY must be set in frontend/.env  (pk_test_...)
// Never use the SECRET key here — this code runs in the browser.
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY ?? '');

// ─── Step 2: Stripe payment form ─────────────────────────────────────────────
function StripePaymentForm({ orderId, total }: { orderId: string; total: string }) {
  const stripe      = useStripe();
  const elements    = useElements();
  const navigate    = useNavigate();
  const queryClient = useQueryClient();

  const [stripeError, setStripeError] = useState('');
  const [loading, setLoading]         = useState(false);

  const handlePay = async (e: FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setStripeError('');
    setLoading(true);

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        // Stripe redirects here after 3D-Secure authentication
        return_url: `${window.location.origin}/orders/${orderId}?payment=success`,
      },
      redirect: 'if_required',
    });

    if (error) {
      setStripeError(error.message ?? 'Payment failed. Please try again.');
      setLoading(false);
      return;
    }

    // Payment succeeded without a redirect (card that doesn't need 3DS)
    queryClient.invalidateQueries({ queryKey: ['cart'] });
    queryClient.invalidateQueries({ queryKey: ['my-orders'] });
    navigate(`/orders/${orderId}?payment=success`);
  };

  return (
    <form onSubmit={handlePay} className="space-y-4">
      <PaymentElement />

      {stripeError && (
        <div className="px-4 py-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
          {stripeError}
        </div>
      )}

      <button
        type="submit"
        disabled={!stripe || loading}
        className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white py-3 rounded-xl font-semibold hover:bg-indigo-700 disabled:opacity-60 transition-colors"
      >
        {loading && <SpinnerIcon className="w-4 h-4" />}
        Pay ₹{total}
      </button>
    </form>
  );
}

interface AddressForm {
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

// ─── Step 1: Shipping address → creates order + PaymentIntent ────────────────
export default function CheckoutPage() {
  const navigate    = useNavigate();
  const queryClient = useQueryClient();

  const [address, setAddress] = useState<AddressForm>({
    street: '', city: '', state: '', postalCode: '', country: 'India',
  });
  const [error, setError]               = useState('');
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [orderId, setOrderId]           = useState<string | null>(null);

  const { data: cart, isLoading } = useQuery({
    queryKey: ['cart'],
    queryFn: () => cartApi.get().then((r) => r.data.data),
  });

  const placeAndPay = useMutation({
    mutationFn: async () => {
      // 1. Create the order in order-service
      const orderRes = await ordersApi.create({
        items: (cart?.items ?? []).map((i) => ({ productId: i.productId, quantity: i.quantity })),
        shippingAddress: address,
      });
      const order = orderRes.data.data;

      // 2. Create a Stripe PaymentIntent in payment-service
      const piRes = await paymentsApi.createIntent(order.id, order.totalAmount);
      return { order, clientSecret: piRes.data.data.clientSecret };
    },
    onSuccess: ({ order, clientSecret: cs }) => {
      queryClient.invalidateQueries({ queryKey: ['cart'] });
      setOrderId(order.id);
      setClientSecret(cs);
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })
        ?.response?.data?.message ?? 'Failed to create order. Please try again.';
      setError(msg);
    },
  });

  const update = (field: keyof AddressForm) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setAddress((a) => ({ ...a, [field]: e.target.value }));

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError('');
    placeAndPay.mutate();
  };

  if (isLoading) return (
    <div className="flex justify-center items-center h-64">
      <SpinnerIcon className="w-8 h-8 text-indigo-600" />
    </div>
  );

  if (!cart || cart.items.length === 0) {
    navigate('/cart');
    return null;
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Checkout</h1>

      {/* Progress indicator */}
      <div className="flex items-center gap-2 mb-8 text-sm">
        <span className={`font-medium ${!clientSecret ? 'text-indigo-600' : 'text-gray-400'}`}>
          1. Shipping
        </span>
        <span className="text-gray-300">→</span>
        <span className={`font-medium ${clientSecret ? 'text-indigo-600' : 'text-gray-400'}`}>
          2. Payment
        </span>
      </div>

      <div className="grid md:grid-cols-5 gap-8">
        {/* Left: form */}
        <div className="md:col-span-3">
          <div className="bg-white border border-gray-200 rounded-2xl p-6">
            {!clientSecret ? (
              /* ── Step 1: Shipping ── */
              <>
                <h2 className="font-semibold text-gray-900 mb-4">Shipping Address</h2>

                {error && (
                  <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
                    {error}
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  {[
                    { id: 'street',     label: 'Street address', placeholder: '123 MG Road' },
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
                    disabled={placeAndPay.isPending}
                    className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white py-3 rounded-xl font-semibold hover:bg-indigo-700 disabled:opacity-60 transition-colors mt-2"
                  >
                    {placeAndPay.isPending && <SpinnerIcon className="w-4 h-4" />}
                    Continue to Payment
                  </button>
                </form>
              </>
            ) : (
              /* ── Step 2: Stripe Payment ── */
              <>
                <h2 className="font-semibold text-gray-900 mb-4">Payment Details</h2>
                <p className="text-xs text-gray-400 mb-4 flex items-center gap-1">
                  <span>🔒</span> Secured by Stripe — your card details never touch our servers
                </p>
                <Elements stripe={stripePromise} options={{ clientSecret }}>
                  <StripePaymentForm orderId={orderId!} total={cart.total.toFixed(2)} />
                </Elements>
              </>
            )}
          </div>
        </div>

        {/* Right: order summary */}
        <div className="md:col-span-2">
          <div className="bg-white border border-gray-200 rounded-2xl p-6 sticky top-24">
            <h2 className="font-semibold text-gray-900 mb-4">Order Summary</h2>
            <div className="space-y-2 text-sm">
              {cart.items.map((item) => (
                <div key={item.productId} className="flex justify-between">
                  <span className="text-gray-600 truncate mr-2">{item.name} &times; {item.quantity}</span>
                  <span className="font-medium whitespace-nowrap">&#8377;{item.subtotal.toFixed(2)}</span>
                </div>
              ))}
            </div>
            <div className="border-t border-gray-100 mt-4 pt-4 flex justify-between">
              <span className="font-bold">Total</span>
              <span className="font-bold text-indigo-600">&#8377;{cart.total.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
