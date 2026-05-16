import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Star, Bell } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { marketApi } from "@/lib/api";
import { formatINR, formatPct, changeColor } from "@/lib/format";
import { cn } from "@/lib/utils";
import { InstrumentSearch } from "@/components/shared/InstrumentSearch";
import { useAuthStore } from "@/store/auth";
import type { SearchResult } from "@/types";
import toast from "react-hot-toast";

interface WatchlistItem {
  id: string;
  watchlist_id: string;
  symbol: string;
  company_name: string | null;
  exchange: string | null;
  instrument_id: string;
  instrument_type: string;
  position: number;
}

const POPULAR = ["RELIANCE", "TCS", "HDFCBANK", "INFY", "ICICIBANK", "SBIN", "LT", "BAJFINANCE", "TITAN", "ITC"];

export default function WatchlistPage() {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const [showSearch, setShowSearch] = useState(false);

  const { data: watchlists = [] } = useQuery({
    queryKey: ["watchlists"],
    queryFn: async () => {
      const { data } = await supabase.from("watchlists").select("*").order("created_at");
      if (!data?.length && user) {
        const { data: created } = await supabase.from("watchlists").insert({ user_id: user.id, name: "My Watchlist" }).select().single();
        return created ? [created] : [];
      }
      return data ?? [];
    },
  });

  const [activeWlId, setActiveWlId] = useState<string | null>(null);
  const activeWl = watchlists.find(w => w.id === (activeWlId ?? watchlists[0]?.id)) ?? watchlists[0];

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["watchlist-items", activeWl?.id],
    queryFn: async () => {
      if (!activeWl?.id) return [];
      const { data } = await supabase.from("watchlist_items").select("*").eq("watchlist_id", activeWl.id).order("position");
      return data ?? [];
    },
    enabled: !!activeWl?.id,
  });

  const symbols = items.filter((i: WatchlistItem) => i.exchange !== "AMFI").map((i: WatchlistItem) => {
    const suffix = i.exchange === "BSE" ? ".BO" : ".NS";
    return `${i.symbol}${suffix}`;
  });

  const { data: quotes = [] } = useQuery({
    queryKey: ["quotes", symbols.join(",")],
    queryFn: () => symbols.length ? marketApi.getQuotes(symbols) : [],
    refetchInterval: 30_000,
    enabled: symbols.length > 0,
  });

  const quoteMap = new Map(quotes.map(q => [q.symbol, q]));

  const handleAdd = async (r: SearchResult) => {
    if (!activeWl?.id) return;
    const { error } = await supabase.from("watchlist_items").upsert({
      watchlist_id: activeWl.id,
      instrument_type: r.instrument_type,
      instrument_id: r.id,
      symbol: r.symbol,
      company_name: r.name,
      exchange: r.exchange ?? null,
      position: items.length,
    }, { onConflict: "watchlist_id,instrument_id" });
    if (error) { toast.error("Already in watchlist"); return; }
    await qc.invalidateQueries({ queryKey: ["watchlist-items"] });
    toast.success(`${r.symbol} added to watchlist`);
    setShowSearch(false);
  };

  const handleRemove = async (item: WatchlistItem) => {
    await supabase.from("watchlist_items").delete().eq("id", item.id);
    await qc.invalidateQueries({ queryKey: ["watchlist-items"] });
    toast.success("Removed from watchlist");
  };

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Star className="w-5 h-5 text-yellow-400" />
          <h1 className="text-2xl font-bold text-slate-100">Watchlist</h1>
        </div>
        <button
          onClick={() => setShowSearch(!showSearch)}
          className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" /> Add Symbol
        </button>
      </div>

      {/* Watchlist tabs */}
      {watchlists.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          {watchlists.map((w) => (
            <button
              key={w.id}
              onClick={() => setActiveWlId(w.id)}
              className={cn("px-3 py-1.5 text-sm rounded-lg transition-colors", activeWl?.id === w.id ? "bg-blue-600 text-white" : "bg-[#1A2236] text-slate-400 hover:text-slate-200 border border-[#1E293B]")}
            >
              {w.name}
            </button>
          ))}
        </div>
      )}

      {/* Search */}
      {showSearch && (
        <div className="bg-[#1A2236] border border-[#1E293B] rounded-xl p-4">
          <p className="text-xs text-slate-400 mb-2">Search and add to watchlist</p>
          <InstrumentSearch onSelect={handleAdd} placeholder="Search stocks or mutual funds..." clearOnSelect />
        </div>
      )}

      {/* Table */}
      <div className="bg-[#1A2236] border border-[#1E293B] rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="p-4 space-y-2">{[1,2,3].map(i => <div key={i} className="h-12 bg-[#0A0E1A] rounded animate-pulse" />)}</div>
        ) : items.length === 0 ? (
          <div className="text-center py-12">
            <Star className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400 text-sm mb-4">Your watchlist is empty</p>
            <p className="text-slate-500 text-xs mb-4">Quick add popular stocks:</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {POPULAR.map(sym => (
                <button
                  key={sym}
                  onClick={() => handleAdd({ id: sym, symbol: sym, name: sym, instrument_type: "STOCK", exchange: "NSE" })}
                  className="px-3 py-1 text-xs bg-[#0A0E1A] border border-[#1E293B] text-slate-400 hover:text-blue-400 hover:border-blue-500 rounded-lg transition-colors"
                >
                  {sym}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-slate-500 border-b border-[#1E293B]">
                  <th className="px-4 py-2.5 text-left">Symbol</th>
                  <th className="px-4 py-2.5 text-right">LTP</th>
                  <th className="px-4 py-2.5 text-right">Change</th>
                  <th className="px-4 py-2.5 text-right">52W High</th>
                  <th className="px-4 py-2.5 text-right">52W Low</th>
                  <th className="px-4 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item: WatchlistItem) => {
                  const suffix = item.exchange === "BSE" ? ".BO" : ".NS";
                  const quote = quoteMap.get(`${item.symbol}${suffix}`);
                  return (
                    <tr key={item.id} className="border-b border-[#1E293B] last:border-0 hover:bg-[#1F2D45] transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-100">{item.symbol}</p>
                        <p className="text-xs text-slate-500">{item.company_name}</p>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-200 font-medium">
                        {quote ? formatINR(quote.price) : "—"}
                      </td>
                      <td className={cn("px-4 py-3 text-right tabular-nums", changeColor(quote?.changePct ?? 0))}>
                        {quote ? formatPct(quote.changePct) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-400">
                        {quote?.fiftyTwoWeekHigh ? formatINR(quote.fiftyTwoWeekHigh) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-400">
                        {quote?.fiftyTwoWeekLow ? formatINR(quote.fiftyTwoWeekLow) : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button className="p-1.5 text-slate-500 hover:text-yellow-400 hover:bg-yellow-400/10 rounded transition-colors">
                            <Bell className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleRemove(item)} className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-400/10 rounded transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
