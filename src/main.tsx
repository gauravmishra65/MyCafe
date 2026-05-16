import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "react-hot-toast";
import "./index.css";
import App from "./App";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: 2,
      refetchOnWindowFocus: true,
    },
  },
});

const saved = localStorage.getItem("mycafe-theme");
let theme = "dark";
try {
  if (saved) theme = (JSON.parse(saved) as { state: { theme: string } }).state.theme;
} catch { /* default dark */ }
document.documentElement.classList.add(theme);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: "#1A2236",
            color: "#F1F5F9",
            border: "1px solid #1E293B",
          },
        }}
      />
    </QueryClientProvider>
  </StrictMode>
);
