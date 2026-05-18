import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminProductsApi, adminCategoriesApi, type CreateProductBody } from '../../services/admin';
import { SpinnerIcon } from '../../components/common';
import type { Product } from '../../types';

// ─── Product Form Modal ────────────────────────────────────────────────────────
interface ModalProps {
  product?: Product | null;
  categories: { id: string; name: string }[];
  onClose: () => void;
  onSaved: () => void;
}

function ProductModal({ product, categories, onClose, onSaved }: ModalProps) {
  const [form, setForm] = useState({
    name:          product?.name          ?? '',
    description:   product?.description   ?? '',
    price:         product?.price         ?? '',
    stockQuantity: product?.stock_quantity ?? 0,
    categoryId:    product?.category_id   ?? '',
    imageUrl:      product?.images?.[0]   ?? '',
  });
  const [error, setError] = useState('');

  const set = (k: string, v: string | number) => setForm((f) => ({ ...f, [k]: v }));

  const mutation = useMutation({
    mutationFn: () => {
      const body: CreateProductBody = {
        name:          form.name,
        description:   form.description,
        price:         parseFloat(form.price as string),
        stockQuantity: Number(form.stockQuantity),
        categoryId:    form.categoryId,
        images:        form.imageUrl ? [form.imageUrl] : [],
      };
      return product
        ? adminProductsApi.update(product.id, body)
        : adminProductsApi.create(body);
    },
    onSuccess: () => { onSaved(); onClose(); },
    onError: (err: any) => setError(err.response?.data?.message ?? 'Failed to save product'),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          {product ? 'Edit Product' : 'Add Product'}
        </h2>

        {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

        <div className="flex flex-col gap-3">
          {([ ['name','Product Name','text'],['description','Description','text'],['price','Price (₹)','number'],['imageUrl','Image URL','text'] ] as [string,string,string][]).map(([k,label,type]) => (
            <div key={k}>
              <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
              {k === 'description' ? (
                <textarea
                  rows={3}
                  value={form[k as keyof typeof form] as string}
                  onChange={(e) => set(k, e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              ) : (
                <input
                  type={type}
                  value={form[k as keyof typeof form] as string}
                  onChange={(e) => set(k, e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              )}
            </div>
          ))}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Stock</label>
              <input
                type="number"
                min={0}
                value={form.stockQuantity}
                onChange={(e) => set('stockQuantity', parseInt(e.target.value) || 0)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Category</label>
              <select
                value={form.categoryId}
                onChange={(e) => set('categoryId', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">— Select —</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-5">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">
            Cancel
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-60"
          >
            {mutation.isPending && <SpinnerIcon className="w-4 h-4" />}
            {product ? 'Save Changes' : 'Add Product'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AdminProductsPage() {
  const qc = useQueryClient();
  const [page, setPage]           = useState(1);
  const [modal, setModal]         = useState<'add' | 'edit' | null>(null);
  const [editing, setEditing]     = useState<Product | null>(null);
  const [deleteId, setDeleteId]   = useState<string | null>(null);

  const { data: productsData, isLoading } = useQuery({
    queryKey: ['admin', 'products', page],
    queryFn: () => adminProductsApi.getAll({ page, limit: 15 }).then((r) => r.data.data),
  });

  const { data: catsData } = useQuery({
    queryKey: ['categories'],
    queryFn: () => adminCategoriesApi.getAll().then((r) => r.data.data?.categories ?? []),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminProductsApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'products'] });
      setDeleteId(null);
    },
  });

  const onSaved = () => qc.invalidateQueries({ queryKey: ['admin', 'products'] });

  const products  = productsData?.products ?? [];
  const totalPages = productsData?.totalPages ?? 1;
  const categories = catsData ?? [];

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Products</h1>
        <button
          onClick={() => { setEditing(null); setModal('add'); }}
          className="bg-indigo-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
        >
          + Add Product
        </button>
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
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Product</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Category</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Price</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Stock</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">Status</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {products.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {p.images?.[0] && (
                          <img src={p.images[0]} alt="" className="w-10 h-10 rounded-lg object-cover bg-gray-100 shrink-0" />
                        )}
                        <div>
                          <p className="font-medium text-gray-900 line-clamp-1">{p.name}</p>
                          <p className="text-xs text-gray-400">{p.slug}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{p.category_name ?? '—'}</td>
                    <td className="px-4 py-3 text-right font-medium">₹{parseFloat(p.price).toFixed(2)}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={p.stock_quantity === 0 ? 'text-red-500 font-medium' : 'text-gray-700'}>
                        {p.stock_quantity}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        p.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {p.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => { setEditing(p); setModal('edit'); }}
                          className="text-xs text-indigo-600 hover:underline"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => setDeleteId(p.id)}
                          className="text-xs text-red-500 hover:underline"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {products.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center text-gray-400 py-10">No products found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
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

      {/* Add/Edit modal */}
      {modal && (
        <ProductModal
          product={modal === 'edit' ? editing : null}
          categories={categories}
          onClose={() => { setModal(null); setEditing(null); }}
          onSaved={onSaved}
        />
      )}

      {/* Delete confirmation */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Product?</h3>
            <p className="text-sm text-gray-600 mb-5">This action cannot be undone.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteId(null)} className="px-4 py-2 text-sm text-gray-600">
                Cancel
              </button>
              <button
                onClick={() => deleteMutation.mutate(deleteId)}
                disabled={deleteMutation.isPending}
                className="px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 disabled:opacity-60"
              >
                {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
