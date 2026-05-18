import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { productsApi, type ProductFilters } from '../services/products';
import { SpinnerIcon } from '../components/common';
import type { Product } from '../types';

function ProductCard({ product }: { product: Product }) {
  const image = product.images?.[0] ?? 'https://placehold.co/400x300?text=No+Image';

  return (
    <Link
      to={`/products/${product.slug}`}
      className="group bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow"
    >
      <div className="aspect-[4/3] overflow-hidden bg-gray-100">
        <img
          src={image}
          alt={product.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          onError={(e) => { (e.target as HTMLImageElement).src = 'https://placehold.co/400x300?text=No+Image'; }}
        />
      </div>
      <div className="p-4">
        <p className="text-xs text-indigo-600 font-medium uppercase tracking-wide mb-1">
          {product.category_name ?? 'General'}
        </p>
        <h3 className="font-semibold text-gray-900 text-sm line-clamp-2 mb-2">{product.name}</h3>
        <div className="flex items-center justify-between">
          <span className="text-lg font-bold text-gray-900">₹{parseFloat(product.price).toFixed(2)}</span>
          {product.stock_quantity === 0 && (
            <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">Out of stock</span>
          )}
        </div>
      </div>
    </Link>
  );
}

export default function ProductListPage() {
  const [filters, setFilters] = useState<ProductFilters>({ page: 1, limit: 12 });
  const [search, setSearch]   = useState('');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['products', filters],
    queryFn: () => productsApi.getAll(filters).then((r) => r.data.data),
    staleTime: 30_000,
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setFilters((f) => ({ ...f, search: search.trim() || undefined, page: 1 }));
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Products</h1>

        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products..."
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-56 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            type="submit"
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700 transition-colors"
          >
            Search
          </button>
        </form>
      </div>

      {/* Sort */}
      <div className="flex items-center gap-3 mb-6">
        <span className="text-sm text-gray-500">Sort by:</span>
        {[
          { label: 'Newest',     sortBy: 'created_at', sortOrder: 'desc' },
          { label: 'Price: Low', sortBy: 'price',      sortOrder: 'asc'  },
          { label: 'Price: High',sortBy: 'price',      sortOrder: 'desc' },
          { label: 'Name',       sortBy: 'name',       sortOrder: 'asc'  },
        ].map((opt) => (
          <button
            key={opt.label}
            onClick={() => setFilters((f) => ({ ...f, sortBy: opt.sortBy, sortOrder: opt.sortOrder as 'asc' | 'desc', page: 1 }))}
            className={`text-sm px-3 py-1 rounded-full border transition-colors ${
              filters.sortBy === opt.sortBy && filters.sortOrder === opt.sortOrder
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'border-gray-300 text-gray-600 hover:border-indigo-400'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <SpinnerIcon className="w-8 h-8 text-indigo-600" />
        </div>
      ) : isError ? (
        <div className="text-center text-red-500 py-12">Failed to load products. Please try again.</div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {data?.products?.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>

          {data?.products?.length === 0 && (
            <div className="text-center text-gray-500 py-16">No products found.</div>
          )}

          {/* Pagination */}
          {data && (data.totalPages ?? 0) > 1 && (
            <div className="flex justify-center gap-2 mt-8">
              {Array.from({ length: data.totalPages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  onClick={() => setFilters((f) => ({ ...f, page }))}
                  className={`w-9 h-9 rounded-lg text-sm font-medium transition-colors ${
                    filters.page === page
                      ? 'bg-indigo-600 text-white'
                      : 'border border-gray-300 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {page}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
