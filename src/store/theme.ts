import { create } from "zustand";
import { persist } from "zustand/middleware";

interface ThemeState {
  theme: "dark" | "light";
  toggleTheme: () => void;
  setTheme: (t: "dark" | "light") => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: "dark",
      toggleTheme: () => {
        const next = get().theme === "dark" ? "light" : "dark";
        set({ theme: next });
        document.documentElement.classList.toggle("light", next === "light");
        document.documentElement.classList.toggle("dark", next === "dark");
      },
      setTheme: (t) => {
        set({ theme: t });
        document.documentElement.classList.toggle("light", t === "light");
        document.documentElement.classList.toggle("dark", t === "dark");
      },
    }),
    { name: "mycafe-theme" }
  )
);
