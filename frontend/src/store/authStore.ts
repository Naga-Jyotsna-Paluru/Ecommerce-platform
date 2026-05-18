import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '../types';

/**
 * Global auth state.
 *
 * accessToken  — kept only in memory (Zustand store, NOT localStorage) 
 *                to limit XSS exposure. The refresh token lives in an
 *                HttpOnly cookie and is never accessible to JS.
 *
 * user         — persisted to sessionStorage so a page refresh doesn't
 *                log the user out (the silent refresh flow will restore
 *                the access token via the cookie).
 */
interface AuthState {
  accessToken: string | null;
  user: User | null;
  isAuthenticated: boolean;
  setAuth: (user: User, accessToken: string) => void;
  setAccessToken: (token: string) => void;
  logout: () => void;
}

const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      user: null,
      isAuthenticated: false,

      setAuth: (user, accessToken) =>
        set({ user, accessToken, isAuthenticated: true }),

      setAccessToken: (token) =>
        set({ accessToken: token, isAuthenticated: true }),

      logout: () =>
        set({ user: null, accessToken: null, isAuthenticated: false }),
    }),
    {
      name: 'auth-storage',
      storage: {
        // Use sessionStorage so data is cleared when the tab closes.
        // We only persist `user`; the access token is regenerated via cookie.
        getItem: (key) => {
          const value = sessionStorage.getItem(key);
          return value ? JSON.parse(value) : null;
        },
        setItem: (key, value) => sessionStorage.setItem(key, JSON.stringify(value)),
        removeItem: (key) => sessionStorage.removeItem(key),
      },
      partialize: (state) => ({ user: state.user, isAuthenticated: state.isAuthenticated } as unknown as AuthState),
    }
  )
);

export default useAuthStore;
