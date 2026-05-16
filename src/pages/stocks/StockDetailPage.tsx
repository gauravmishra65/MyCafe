import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, TrendingUp, TrendingDown, Star, Plus, Bell } from "lucide-react";
import { marketApi } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { formatINR, formatPct, formatVolume, changeBg, changeColor } from "@/lib/format";
import { cn } from "@/lib/utils";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import type { Candle } from "@/types";
import toast from "react-hot-toast";

const RANGES = [
  { label: "1D", range: "1d", interval: "5m" },
  { label: "5D", range: "5d", interval: "15m" },
  { label: "1M", range: "1mo", interval: "1d" },
  { label: "3M", range: "3mo", interval: "1d" },
  { label: "6M", range: "6mo", interval: "1d" },
  { label: "1Y", range: "1y", interval: "1d" },
  { label: "5Y", range: "5y", interval: "1mo" },
];

export default function StockDetailPage() {
  const { symbol } = useParams<{ symbol: string }>();
  const [rangeIdx, setRangeIdx] = useState(5);
  const yahooSymbol = `${symbol}.NS`;

  const { data: quote } = useQuery({
    queryKey: ["quote", yahooSymbol],
    queryFn: () => marketApi.getQuote(yahooSymbol),
    refetchInterval: 60_000,
  });

  const { data: history = [], isLoading: histLoading } = useQuery({
    queryKey: ["history", yahooSymbol, RANGES[rangeIdx].range, RANGES[rangeIdx].interval],
    queryFn: () => marketApi.getHistory(yahooSymbol, RANGES[rangeIdx].range, RANGES[rangeIdx].interval),
    staleTime: 60_000,
  });

  const { data: stockInfo } = useQuery({
    queryKey: ["stock-info", symbol],
    queryFn: async () => {
      const { data } = await supabase.from("stocks").select("*").eq("symbol", symbol).single();
      return data;
    },
  });

  const chartData = history
    .filter((c: Candle) => c.c !== null)
    .map((c: Candle) => ({
      time: new Date(c.t * 1000).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
      price: c.c,
      volume: c.v,
    }));

  const positive = quote ? quote.changePct >= 0 : true;

  const handleAddToWatchlist = async () => {
    if (!stockInfo) { toast.error("Stock not found in database"); return; }
    const { data: wl } = await supabase.from("watchlists").select("id").limit(1).single();
    if (!wl) { toast.error("No watchlist found"); return; }
    const { error } = await supabase.from("watchlist_items").upsert({
      watchlist_id: wl.id,
      instrument_type: "STOCK",
      instrument_id: stockInfo.id,
      symbol: stockInfo.symbol,
      company_name: stockInfo.name,
      exchange: stockInfo.exchange,
    }, { onConflict: "watchlist_id,instrument_id" });
    if (error) toast.error("Already in watchlist");
    else toast.success("Added to watchlist");
  };

  return (
    <div className="p-4 lg:p-6 space-y-5 max-w-7xl mx-auto">
      {/* Back */}
      <Link to="/market" className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200 transition-colors w-fit">
        <ArrowLeft className="w-4 h-4" /> Back to Market
      </Link>

      {/* Hero */}
      {quote ? (
        <div className="bg-[#1A2236] border border-[#1E293B] rounded-xl p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-2xl font-bold text-slate-100">{symbol}</h1>
                <span className="px-2 py-0.5 text-xs font-medium bg-orange-500/20 text-orange-400 rounded">NSE</span>
                {stockInfo?.cap_category && (
                  <span className="px-2 py-0.5 text-xs font-medium bg-blue-500/20 text-blue-400 rounded">{stockInfo.cap_category}</span>
                )}
              </div>
              <p className="text-sm text-slate-400">{quote.name}</p>
              {stockInfo?.sector && <p className="text-xs text-slate-500 mt-0.5">{stockInfo.sector}</p>}
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold text-slate-100 tabular-nums">{formatINR(quote.price)}</p>
              <span className={cn("inline-flex items-center gap-1 text-sm tabular-nums px-2 py-0.5 rounded mt-1", changeBg(quote.changePct))}>
                {positive ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                {formatINR(quote.change)} ({formatPct(quote.changePct)})
              </span>
            </div>
          </div>

          {/* Day range */}
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <div><p className="text-xs text-slate-500">Open</p><p className="tabular-nums text-slate-200">{formatINR(quote.open)}</p></div>
            <div><p className="text-xs text-slate-500">High</p><p className="tabular-nums text-emerald-400">{formatINR(quote.high)}</p></div>
            <div><p className="text-xs text-slate-500">Low</p><p className="tabular-nums text-red-400">{formatINR(quote.low)}</p></div>
            <div><p className="text-xs text-slate-500">Volume</p><p className="tabular-nums text-slate-200">{formatVolume(quote.volume)}</p></div>
          </div>

          {/* 52W */}
          {quote.fiftyTwoWeekHigh && quote.fiftyTwoWeekLow && (
            <div className="mt-3">
              <div className="flex justify-between text-xs text-slate-500 mb-1">
                <span>52W Low: {formatINR(quote.fiftyTwoWeekLow)}</span>
                <span>52W High: {formatINR(quote.fiftyTwoWeekHigh)}</span>
              </div>
              <div className="h-1.5 bg-[#0A0E1A] rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full"
                  style={{ width: `${((quote.price - quote.fiftyTwoWeekLow) / (quote.fiftyTwoWeekHigh - quote.fiftyTwoWeekLow)) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2 mt-4">
            <button onClick={handleAddToWatchlist} className="flex items-center gap-1.5 px-3 py-2 text-sm bg-[#0A0E1A] border border-[#1E293B] text-slate-300 rounded-lg hover:bg-[#1F2D45] transition-colors">
              <Star className="w-3.5 h-3.5 text-yellow-400" /> Watchlist
            </button>
            <Link to="/alerts" className="flex items-center gap-1.5 px-3 py-2 text-sm bg-[#0A0E1A] border border-[#1E293B] text-slate-300 rounded-lg hover:bg-[#1F2D45] transition-colors">
              <Bell className="w-3.5 h-3.5 text-blue-400" /> Alert
            </Link>
            <Link to="/portfolio" className="flex items-center gap-1.5 px-3 py-2 text-sm bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg transition-colors">
              <Plus className="w-3.5 h-3.5" /> Add to Portfolio
            </Link>
          </div>
        </div>
      ) : (
        <div className="h-40 bg-[#1A2236] rounded-xl animate-pulse" />
      )}

      {/* Chart */}
      <div className="bg-[#1A2236] border border-[#1E293B] rounded-xl p-4">
        <div className="flex items-center gap-1 mb-4 flex-wrap">
          {RANGES.map((r, i) => (
            <button key={r.label} onClick={() => setRangeIdx(i)} className={cn("px-3 py-1 text-xs font-medium rounded-lg transition-colors", rangeIdx === i ? "bg-blue-600 text-white" : "text-slate-400 hover:text-slate-200 hover:bg-[#1F2D45]")}>
              {r.label}
            </button>
          ))}
        </div>
        {histLoading ? (
          <div className="h-52 bg-[#0A0E1A] rounded-lg animate-pulse" />
        ) : chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={positive ? "#10B981" : "#EF4444"} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={positive ? "#10B981" : "#EF4444"} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="time" tick={{ fontSize: 10, fill: "#475569" }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 10, fill: "#475569" }} tickLine={false} axisLine={false} tickFormatter={(v) => formatINR(v, true)} width={70} domain={["auto","auto"]} />
              <Tooltip
                contentStyle={{ background: "#1A2236", border: "1px solid #1E293B", borderRadius: 8, fontSize: 12 }}
                formatter={(v: unknown) => [formatINR(v as number), "Price"]}
              />
              <Area type="monotone" dataKey="price" stroke={positive ? "#10B981" : "#EF4444"} fill="url(#priceGradient)" strokeWidth={1.5} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-52 flex items-center justify-center text-slate-500 text-sm">No chart data available</div>
        )}
      </div>

      {/* Key stats */}
      {quote && (
        <div className="bg-[#1A2236] border border-[#1E293B] rounded-xl p-4">
          <h3 className="text-sm font-semibold text-slate-200 mb-3">Key Statistics</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Market Cap", value: quote.marketCap ? formatINR(quote.marketCap, true) : "—" },
              { label: "52W High", value: quote.fiftyTwoWeekHigh ? formatINR(quote.fiftyTwoWeekHigh) : "—" },
              { label: "52W Low", value: quote.fiftyTwoWeekLow ? formatINR(quote.fiftyTwoWeekLow) : "—" },
              { label: "Prev Close", value: formatINR(quote.previousClose) },
              { label: "Open", value: formatINR(quote.open) },
              { label: "Day High", value: formatINR(quote.high) },
              { label: "Day Low", value: formatINR(quote.low) },
              { label: "Volume", value: formatVolume(quote.volume) },
            ].map(({ label, value }) => (
              <div key={label} className="bg-[#0A0E1A] rounded-lg p-2.5">
                <p className="text-xs text-slate-500 mb-0.5">{label}</p>
                <p className="text-sm font-semibold text-slate-200 tabular-nums">{value}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
