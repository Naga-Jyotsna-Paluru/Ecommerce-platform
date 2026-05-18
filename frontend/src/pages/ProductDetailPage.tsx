import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { productsApi } from '../services/products';
import { cartApi } from '../services/cart';
import { SpinnerIcon } from '../components/common';
import useAuthStore from '../store/authStore';

export default function ProductDetailPage() {
  const { slug }      = useParams<{ slug: string }>();
  const navigate      = useNavigate();
  const queryClient   = useQueryClient();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const [quantity, setQuantity]   = useState(1);
  const [addedMsg, setAddedMsg]   = useState('');

  const { data: product, isLoading, isError } = useQuery({
    queryKey: ['product', slug],
    queryFn: () => productsApi.getBySlug(slug!).then((r) => r.data.data.product),
    enabled: !!slug,
  });

  const addToCart = useMutation({
    mutationFn: () => cartApi.addItem(product!.id, quantity),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cart'] });
      setAddedMsg('Added to cart!');
      setTimeout(() => setAddedMsg(''), 2000);
    },
  });

  const handleAddToCart = () => {
    if (!isAuthenticated) { navigate('/login'); return; }
    addToCart.mutate();
  };

  if (isLoading) return (
    <div className="flex justify-center items-center h-96">
      <SpinnerIcon className="w-8 h-8 text-indigo-600" />
    </div>
  );

  if (isError || !product) return (
    <div className="text-center text-red-500 py-16">Product not found.</div>
  );

  const image = product.images?.[0] ?? 'https://placehold.co/600x450?text=No+Image';

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="grid md:grid-cols-2 gap-10">
        {/* Image */}
        <div className="rounded-2xl overflow-hidden bg-gray-100 aspect-[4/3]">
          <img src={image} alt={product.name} className="w-full h-full object-cover" />
        </div>

        {/* Info */}
        <div className="flex flex-col gap-4">
          {product.category_name && (
            <span className="text-xs text-indigo-600 font-semibold uppercase tracking-wide">
              {product.category_name}
            </span>
          )}
          <h1 className="text-3xl font-bold text-gray-900">{product.name}</h1>
          <p className="text-2xl font-semibold text-indigo-600">₹{parseFloat(product.price).toFixed(2)}</p>
          <p className="text-sm text-gray-600 leading-relaxed">{product.description}</p>

          {/* Stock */}
          <p className="text-sm text-gray-500">
            {product.stock_quantity > 0
              ? <span className="text-green-600 font-medium">In stock ({product.stock_quantity} available)</span>
              : <span className="text-red-500 font-medium">Out of stock</span>}
          </p>

          {/* Tags */}
          {product.tags?.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {product.tags.map((tag) => (
                <span key={tag} className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">{tag}</span>
              ))}
            </div>
          )}

          {/* Quantity + Add to cart */}
          {product.stock_quantity > 0 && (
            <div className="flex items-center gap-3 mt-2">
              <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden">
                <button
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  className="px-3 py-2 text-gray-600 hover:bg-gray-50"
                >−</button>
                <span className="px-4 py-2 text-sm font-medium">{quantity}</span>
                <button
                  onClick={() => setQuantity((q) => Math.min(product.stock_quantity, q + 1))}
                  className="px-3 py-2 text-gray-600 hover:bg-gray-50"
                >+</button>
              </div>

              <button
                onClick={handleAddToCart}
                disabled={addToCart.isPending}
                className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 text-white py-2 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-60 transition-colors"
              >
                {addToCart.isPending && <SpinnerIcon className="w-4 h-4" />}
                {addedMsg || 'Add to Cart'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
