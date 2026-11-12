'use client';

import type { AuthTokens, UserView } from '@vp/shared';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthState {
  user: UserView | null;
  tokens: AuthTokens | null;
  hydrated: boolean;
  setSession: (user: UserView, tokens: AuthTokens) => void;
  setTokens: (tokens: AuthTokens) => void;
  setUser: (user: UserView) => void;
  clear: () => void;
  setHydrated: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      tokens: null,
      hydrated: false,
      setSession: (user, tokens) => set({ user, tokens }),
      setTokens: (tokens) => set({ tokens }),
      setUser: (user) => set({ user }),
      clear: () => set({ user: null, tokens: null }),
      setHydrated: () => set({ hydrated: true }),
    }),
    {
      name: 'vp-auth',
      partialize: (s) => ({ user: s.user, tokens: s.tokens }),
      onRehydrateStorage: () => (state) => state?.setHydrated(),
    },
  ),
);

export function getAccessToken(): string | null {
  return useAuthStore.getState().tokens?.accessToken ?? null;
}
