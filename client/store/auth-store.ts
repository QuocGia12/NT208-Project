'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { AuthUser, LoginStreakStatus } from '@/lib/types/auth';

type AuthState = {
  loginStreak: LoginStreakStatus | null;
  token: string | null;
  user: AuthUser | null;
  setLoginStreak: (streak: LoginStreakStatus | null) => void;
  setSession: (token: string, user: AuthUser, loginStreak?: LoginStreakStatus | null) => void;
  updateUser: (user: AuthUser) => void;
  clearSession: () => void;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      loginStreak: null,
      token: null,
      user: null,
      setLoginStreak: (loginStreak) => set((state) => ({ ...state, loginStreak })),
      setSession: (token, user, loginStreak = null) => set({ token, user, loginStreak }),
      updateUser: (user) => set((state) => ({ ...state, user })),
      clearSession: () => set({ loginStreak: null, token: null, user: null })
    }),
    {
      name: 'zodiac-auth-storage',
      storage: createJSONStorage(() => localStorage)
    }
  )
);
