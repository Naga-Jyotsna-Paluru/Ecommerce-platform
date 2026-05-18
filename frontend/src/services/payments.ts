import api from './apiClient';
import type { ApiResponse } from '../types';

interface CreateIntentResult {
  clientSecret: string;
  paymentId: string;
}

export const paymentsApi = {
  createIntent: (orderId: string, totalAmount: string, currency = 'inr') =>
    api.post<ApiResponse<CreateIntentResult>>('/payments/create-intent', {
      orderId,
      totalAmount,
      currency,
    }),

  getByOrderId: (orderId: string) =>
    api.get<ApiResponse<{ status: string; amountCents: number }>>(`/payments/order/${orderId}`),
};
