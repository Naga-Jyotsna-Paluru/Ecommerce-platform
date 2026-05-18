import api from './apiClient';
import type { ApiResponse, PaginatedProducts, Product, Category } from '../types';

export interface ProductFilters {
  page?: number;
  limit?: number;
  search?: string;
  categoryId?: string;
  minPrice?: number;
  maxPrice?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export const productsApi = {
  getAll: (filters: ProductFilters = {}) =>
    api.get<ApiResponse<PaginatedProducts>>('/products', { params: filters }),

  getBySlug: (slug: string) =>
    api.get<ApiResponse<Product>>(`/products/${slug}`),

  getCategories: () =>
    api.get<ApiResponse<Category[]>>('/categories'),

  // Admin
  create: (body: Partial<Product>) =>
    api.post<ApiResponse<Product>>('/products', body),

  update: (id: string, body: Partial<Product>) =>
    api.patch<ApiResponse<Product>>(`/products/${id}`, body),

  delete: (id: string) =>
    api.delete<ApiResponse<null>>(`/products/${id}`),
};
