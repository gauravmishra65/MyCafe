import { supabase } from "./supabase";
import type { MarketQuote, Candle, SearchResult } from "@/types";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

async function callEdgeFunction<T>(fn: string, params: Record<string, string>): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${fn}?${qs}`, {
    headers: {
      "Authorization": `Bearer ${session?.access_token ?? import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<T>;
}

export const marketApi = {
  getQuote: (symbol: string) =>
    callEdgeFunction<MarketQuote>("market-data", { action: "quote", symbol }),
  getQuotes: (symbols: string[]) =>
    callEdgeFunction<MarketQuote[]>("market-data", { action: "quotes", symbols: symbols.join(",") }),
  getHistory: (symbol: string, range = "1y", interval = "1d") =>
    callEdgeFunction<Candle[]>("market-data", { action: "history", symbol, range, interval }),
  getIndices: () =>
    callEdgeFunction<MarketQuote[]>("market-data", { action: "indices" }),
  getMovers: () =>
    callEdgeFunction<{ gainers: MarketQuote[]; losers: MarketQuote[] }>("market-data", { action: "movers" }),
};

export const searchApi = {
  search: (q: string, type: "stock" | "mf" = "stock") =>
    callEdgeFunction<SearchResult[]>("stock-search", { q, type }),
};
