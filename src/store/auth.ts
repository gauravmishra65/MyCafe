import { create } from "zustand";
import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";

interface AuthState {
  user: (User & { fullName?: string }) | null;
  loading: boolean;
  setUser: (u: User | null) => void;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,
  setUser: (u) =>
    set({
      user: u ? { ...u, fullName: u.user_metadata?.full_name as string } : null,
      loading: false,
    }),
  signOut: async () => {
    await supabase.auth.signOut();
    set({ user: null });
  },
}));

supabase.auth.getSession().then(({ data }) => {
  useAuthStore.getState().setUser(data.session?.user ?? null);
});

supabase.auth.onAuthStateChange((_event, session) => {
  useAuthStore.getState().setUser(session?.user ?? null);
});
