import api from './apiClient';
import type { ApiResponse, AuthTokens, User } from '../types';

export const authApi = {
  register: (body: { email: string; password: string; firstName: string; lastName: string }) =>
    api.post<ApiResponse<{ user: User; accessToken: string }>>('/auth/register', body),

  login: (body: { email: string; password: string }) =>
    api.post<ApiResponse<{ user: User; accessToken: string }>>('/auth/login', body),

  logout: () =>
    api.post<ApiResponse<null>>('/auth/logout'),

  refresh: () =>
    api.post<ApiResponse<AuthTokens>>('/auth/refresh'),

  getMe: () =>
    api.get<ApiResponse<User>>('/auth/me'),
};
