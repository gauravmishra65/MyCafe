import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getPortfolioWithPrices } from "@/services/portfolioService";
import { marketApi } from "@/lib/api";
import { formatINR, formatPct, changeColor } from "@/lib/format";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, ArrowRight, AlertCircle } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import type { Candle } from "@/types";

const DISCLAIMER = "Projections are mechanical extrapolations of trailing CAGR ± 1σ volatility. NOT forecasts. Not financial advice. Consult a SEBI-registered investment advisor.";

function FundamentalsPanel({ symbol, yahooSymbol }: { symbol: string; yahooSymbol: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["fundamentals", yahooSymbol],
    queryFn: async () => {
      const { data: { session } } = await import("@/lib/supabase").then(m => m.supabase.auth.getSession());
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const res = await fetch(
        `${supabaseUrl}/functions/v1/market-data?action=fundamentals&symbol=${yahooSymbol}`,
        { headers: { Authorization: `Bearer ${session?.access_token ?? import.meta.env.VITE_SUPABASE_ANON_KEY}` } }
      );
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    staleTime: 24 * 60 * 60 * 1000,
  });

  const { data: history = [] } = useQuery({
    queryKey: ["history", yahooSymbol, "5y", "1mo"],
    queryFn: () => marketApi.getHistory(yahooSymbol, "5y", "1mo"),
    staleTime: 60 * 60 * 1000,
  });

  const { data: quote } = useQuery({
    queryKey: ["quote", yahooSymbol],
    queryFn: () => marketApi.getQuote(yahooSymbol),
    refetchInterval: 60_000,
  });

  if (isLoading) return <div className="flex-1 h-full bg-[#1A2236] rounded-xl animate-pulse" />;

  type YahooModule = Record<string, { raw?: number; fmt?: string }>;
  type YahooData = { quoteSummary?: { result?: Array<Record<string, YahooModule>> } };
  const parsed = data as YahooData | undefined;
  const fin = parsed?.quoteSummary?.result?.[0] as Record<string, YahooModule> | undefined;
  const fd = fin?.financialData;
  const ks = fin?.defaultKeyStatistics;
  const sd = fin?.summaryDetail;
  const ap = fin?.assetProfile;
  const _rt = fin?.recommendationTrend;

  const stats = [
    { label: "P/E (trailing)", value: sd?.trailingPE?.fmt ?? "—" },
    { label: "P/B Ratio", value: ks?.priceToBook?.fmt ?? "—" },
    { label: "ROE", value: fd?.returnOnEquity?.raw != null ? `${(fd.returnOnEquity.raw * 100).toFixed(2)}%` : "—" },
    { label: "Div Yield", value: sd?.dividendYield?.raw != null ? `${(sd.dividendYield.raw * 100).toFixed(2)}%` : "—" },
    { label: "Market Cap", value: sd?.marketCap?.fmt ?? "—" },
    { label: "EPS", value: ks?.trailingEps?.fmt ?? "—" },
    { label: "Beta", value: sd?.beta?.fmt ?? "—" },
    { label: "Debt/Equity", value: fd?.debtToEquity?.fmt ?? "—" },
    { label: "52W High", value: sd?.fiftyTwoWeekHigh?.fmt ?? "—" },
    { label: "52W Low", value: sd?.fiftyTwoWeekLow?.fmt ?? "—" },
    { label: "Analyst Target", value: fd?.targetMeanPrice?.fmt ?? "—" },
    { label: "Recommendation", value: fd?.recommendationKey?.raw ?? "—" },
  ];

  const chartData = history.map((c: Candle) => ({
    date: new Date(c.t * 1000).toLocaleDateString("en-IN", { month: "short", year: "2-digit" }),
    price: c.c,
  })).filter((d: { price: number | null }) => d.price !== null);

  return (
    <div className="flex-1 space-y-4 overflow-y-auto">
      {/* Hero */}
      {quote && (
        <div className="bg-[#1A2236] border border-[#1E293B] rounded-xl p-4">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-100">{symbol}</h2>
              <p className="text-sm text-slate-400">{quote.name}</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-slate-100 tabular-nums">{formatINR(quote.price)}</p>
              <p className={cn("text-sm tabular-nums", changeColor(quote.changePct))}>
                {formatPct(quote.changePct)} ({formatINR(quote.change)})
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Key stats */}
      <div className="bg-[#1A2236] border border-[#1E293B] rounded-xl p-4">
        <h3 className="text-sm font-semibold text-slate-200 mb-3">Fundamentals</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {stats.map(({ label, value }) => (
            <div key={label} className="bg-[#0A0E1A] rounded-lg p-2.5">
              <p className="text-xs text-slate-500 mb-0.5">{label}</p>
              <p className="text-sm font-semibold text-slate-200 tabular-nums capitalize">{String(value)}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Chart */}
      {chartData.length > 0 && (
        <div className="bg-[#1A2236] border border-[#1E293B] rounded-xl p-4">
          <h3 className="text-sm font-semibold text-slate-200 mb-3">5-Year Price History</h3>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#475569" }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 10, fill: "#475569" }} tickLine={false} axisLine={false} tickFormatter={(v) => formatINR(v, true)} width={70} />
              <Tooltip contentStyle={{ background: "#1A2236", border: "1px solid #1E293B", borderRadius: 8, fontSize: 12 }} formatter={(v: unknown) => [formatINR(v as number), "Price"]} />
              <Area type="monotone" dataKey="price" stroke="#3B82F6" fill="url(#priceGrad)" strokeWidth={1.5} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* About */}
      {ap && (ap as Record<string, { longBusinessSummary?: string }>)?.assetProfile?.longBusinessSummary && (
        <div className="bg-[#1A2236] border border-[#1E293B] rounded-xl p-4">
          <h3 className="text-sm font-semibold text-slate-200 mb-2">About</h3>
          <p className="text-xs text-slate-400 leading-relaxed line-clamp-4">
            {(ap as Record<string, { longBusinessSummary?: string }>)?.assetProfile?.longBusinessSummary}
          </p>
        </div>
      )}

      {/* Disclaimer */}
      <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-3 flex gap-2">
        <AlertCircle className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" />
        <p className="text-xs text-yellow-400/80">{DISCLAIMER}</p>
      </div>
    </div>
  );
}

export default function ResearchPage() {
  const { data: portfolio } = useQuery({
    queryKey: ["portfolio"],
    queryFn: getPortfolioWithPrices,
  });

  const stockHoldings = portfolio?.holdings.filter(h => h.instrument_type === "STOCK") ?? [];
  const [selected, setSelected] = useState<{ symbol: string; yahooSymbol: string } | null>(null);

  const defaultSelected = stockHoldings.length > 0
    ? { symbol: stockHoldings[0].symbol, yahooSymbol: `${stockHoldings[0].symbol}.NS` }
    : null;

  const active = selected ?? defaultSelected;

  return (
    <div className="h-full flex flex-col lg:flex-row p-4 lg:p-6 gap-4 max-w-7xl mx-auto">
      {/* Holdings Rail */}
      <div className="lg:w-72 shrink-0">
        <h2 className="text-base font-semibold text-slate-200 mb-3">Your Holdings</h2>
        {stockHoldings.length === 0 ? (
          <div className="bg-[#1A2236] border border-[#1E293B] rounded-xl p-6 text-center">
            <p className="text-slate-400 text-sm">Add stocks to your portfolio to research them here</p>
          </div>
        ) : (
          <div className="bg-[#1A2236] border border-[#1E293B] rounded-xl overflow-hidden">
            {stockHoldings.map((h, i) => {
              const isActive = active?.symbol === h.symbol;
              return (
                <button
                  key={h.id}
                  onClick={() => setSelected({ symbol: h.symbol, yahooSymbol: `${h.symbol}${h.exchange === "BSE" ? ".BO" : ".NS"}` })}
                  className={cn("w-full flex items-center justify-between px-4 py-3 hover:bg-[#1F2D45] transition-colors text-left", isActive && "bg-blue-600/10 border-l-2 border-blue-500", i < stockHoldings.length - 1 && "border-b border-[#1E293B]")}
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-100">{h.symbol}</p>
                    <p className="text-xs text-slate-500">{formatINR(h.currentValue ?? h.invested ?? 0, true)}</p>
                  </div>
                  <div className={cn("flex items-center gap-1", changeColor(h.pnlPct ?? 0))}>
                    {(h.pnlPct ?? 0) >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    <span className="text-xs tabular-nums">{formatPct(h.pnlPct ?? 0)}</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Research Panel */}
      <div className="flex-1 min-w-0">
        {active ? (
          <FundamentalsPanel symbol={active.symbol} yahooSymbol={active.yahooSymbol} />
        ) : (
          <div className="h-full bg-[#1A2236] border border-[#1E293B] rounded-xl flex items-center justify-center">
            <div className="text-center">
              <ArrowRight className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <p className="text-slate-400">Select a holding to research</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
