import api from './apiClient';
import type { ApiResponse, Order } from '../types';

interface CreateOrderBody {
  items: { productId: string; quantity: number }[];
  shippingAddress: {
    street: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
}

export const ordersApi = {
  create: (body: CreateOrderBody) =>
    api.post<ApiResponse<Order>>('/orders', body),

  getMy: () =>
    api.get<ApiResponse<Order[]>>('/orders/my'),

  getById: (id: string) =>
    api.get<ApiResponse<Order>>(`/orders/${id}`),

  cancel: (id: string) =>
    api.patch<ApiResponse<Order>>(`/orders/${id}/cancel`),

  // Admin
  getAll: () =>
    api.get<ApiResponse<Order[]>>('/orders'),

  updateStatus: (id: string, status: string) =>
    api.patch<ApiResponse<Order>>(`/orders/${id}/status`, { status }),
};
