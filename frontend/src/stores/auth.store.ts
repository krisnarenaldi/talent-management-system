/**
 * Zustand store untuk auth state global.
 * User data disimpan setelah login berhasil.
 */
import { create } from "zustand";
import type { AuthUser } from "@/types";

interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
  setUser: (user: AuthUser | null) => void;
  setLoading: (loading: boolean) => void;
  logout: () => void;
  isRole: (...roles: string[]) => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isLoading: true,
  setUser: (user) => set({ user }),
  setLoading: (loading) => set({ isLoading: loading }),
  logout: () => set({ user: null, isLoading: false }),
  isRole: (...roles) => {
    const { user } = get();
    return user ? roles.includes(user.role) : false;
  },
}));
