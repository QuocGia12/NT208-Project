'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { AuthUser } from '@/lib/types/auth';

type AuthState = {
  token: string | null;
  user: AuthUser | null;
  setSession: (token: string, user: AuthUser) => void;
  updateUser: (user: AuthUser) => void;
  clearSession: () => void;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      setSession: (token, user) => set({ token, user }),
      updateUser: (user) => set((state) => ({ ...state, user })),
      clearSession: () => set({ token: null, user: null })
    }),
    {
      name: 'zodiac-auth-storage',
      storage: createJSONStorage(() => localStorage)
    }
  )
);
