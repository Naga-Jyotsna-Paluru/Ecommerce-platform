import api from './apiClient';
import type { ApiResponse, Product } from '../types';

// ─── Orders ──────────────────────────────────────────────────────────────────
export interface AdminOrder {
  id: string;
  user_id: string;
  status: string;
  total_amount: string;
  created_at: string;
}

export interface OrderStats {
  total_orders: string;
  total_revenue: string;
  pending: string;
  confirmed: string;
  processing: string;
  shipped: string;
  delivered: string;
  cancelled: string;
}

export interface AdminOrdersResult {
  orders: AdminOrder[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export const adminOrdersApi = {
  getAll: (params: { page?: number; limit?: number; status?: string } = {}) =>
    api.get<ApiResponse<AdminOrdersResult>>('/orders', { params }),

  getStats: () =>
    api.get<ApiResponse<{ stats: OrderStats }>>('/orders/stats'),

  updateStatus: (id: string, status: string) =>
    api.patch<ApiResponse<{ order: AdminOrder }>>(`/orders/${id}/status`, { status }),
};

// ─── Products ────────────────────────────────────────────────────────────────
export interface CreateProductBody {
  name: string;
  description: string;
  price: number;
  stockQuantity: number;
  categoryId: string;
  images?: string[];
  tags?: string[];
}

export const adminProductsApi = {
  getAll: (params: { page?: number; limit?: number } = {}) =>
    api.get<ApiResponse<{ products: Product[]; total: number; totalPages: number }>>('/products', { params }),

  create: (body: CreateProductBody) =>
    api.post<ApiResponse<{ product: Product }>>('/products', body),

  update: (id: string, body: Partial<CreateProductBody>) =>
    api.patch<ApiResponse<{ product: Product }>>(`/products/${id}`, body),

  delete: (id: string) =>
    api.delete<ApiResponse<null>>(`/products/${id}`),
};

// ─── Categories ──────────────────────────────────────────────────────────────
export interface AdminCategory {
  id: string;
  name: string;
  slug: string;
  description?: string;
}

export const adminCategoriesApi = {
  getAll: () =>
    api.get<ApiResponse<{ categories: AdminCategory[] }>>('/categories'),

  create: (body: { name: string; description?: string }) =>
    api.post<ApiResponse<{ category: AdminCategory }>>('/categories', body),

  update: (id: string, body: { name?: string; description?: string }) =>
    api.patch<ApiResponse<{ category: AdminCategory }>>(`/categories/${id}`, body),
};
