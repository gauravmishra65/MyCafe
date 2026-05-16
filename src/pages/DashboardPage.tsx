import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { TrendingUp, TrendingDown, ArrowRight, Briefcase, RefreshCw } from "lucide-react";
import { marketApi } from "@/lib/api";
import { getPortfolioWithPrices } from "@/services/portfolioService";
import { formatINR, formatPct, changeColor, changeBg } from "@/lib/format";
import { isMarketOpen } from "@/lib/utils";
import { cn } from "@/lib/utils";

function SummaryCard({ label, value, sub, positive }: { label: string; value: string; sub?: string; positive?: boolean }) {
  return (
    <div className="bg-[#1A2236] border border-[#1E293B] rounded-xl p-4">
      <p className="text-xs text-slate-400 mb-1">{label}</p>
      <p className="text-xl font-bold text-slate-100 tabular-nums animate-count-up">{value}</p>
      {sub && (
        <p className={cn("text-xs mt-1 tabular-nums", positive === true ? "text-emerald-400" : positive === false ? "text-red-400" : "text-slate-500")}>
          {sub}
        </p>
      )}
    </div>
  );
}

function IndexCard({ quote }: { quote: { symbol: string; name: string; price: number; changePct: number; change: number } }) {
  const pos = quote.changePct >= 0;
  const labels: Record<string, string> = {
    "^NSEI": "NIFTY 50", "^BSESN": "SENSEX", "^NSEBANK": "NIFTY BANK", "^CNXIT": "NIFTY IT", "^INDIAVIX": "VIX",
  };
  return (
    <div className="bg-[#1A2236] border border-[#1E293B] rounded-xl p-4 flex flex-col gap-1">
      <p className="text-xs text-slate-400">{labels[quote.symbol] ?? quote.symbol}</p>
      <p className="text-lg font-bold text-slate-100 tabular-nums">{formatINR(quote.price)}</p>
      <span className={cn("text-xs px-2 py-0.5 rounded self-start flex items-center gap-1", changeBg(quote.changePct))}>
        {pos ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
        {formatPct(quote.changePct)}
      </span>
    </div>
  );
}

export default function DashboardPage() {
  const marketOpen = isMarketOpen();

  const { data: portfolio, isLoading: portLoading } = useQuery({
    queryKey: ["portfolio"],
    queryFn: getPortfolioWithPrices,
    staleTime: 60_000,
  });

  const { data: indices = [], isLoading: idxLoading } = useQuery({
    queryKey: ["indices"],
    queryFn: () => marketApi.getIndices(),
    refetchInterval: 60_000,
  });

  const { data: movers, isLoading: moversLoading } = useQuery({
    queryKey: ["movers"],
    queryFn: () => marketApi.getMovers(),
    refetchInterval: 60_000,
  });

  const summary = portfolio?.summary;
  const topHoldings = portfolio?.holdings.slice(0, 5) ?? [];

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Dashboard</h1>
          <div className="flex items-center gap-2 mt-1">
            <div className={cn("w-2 h-2 rounded-full", marketOpen ? "bg-emerald-400 animate-pulse" : "bg-slate-500")} />
            <span className="text-xs text-slate-400">{marketOpen ? "Market Open" : "Market Closed"}</span>
          </div>
        </div>
        <Link to="/portfolio" className="flex items-center gap-1 text-sm text-blue-400 hover:text-blue-300 transition-colors">
          Full Portfolio <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Portfolio Summary */}
      {portLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="h-24 bg-[#1A2236] rounded-xl animate-pulse" />)}
        </div>
      ) : summary ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <SummaryCard label="Total Invested" value={formatINR(summary.totalInvested, true)} />
          <SummaryCard label="Current Value" value={formatINR(summary.totalCurrentValue, true)} />
          <SummaryCard
            label="Total P&L"
            value={formatINR(summary.totalPnl, true)}
            sub={formatPct(summary.totalPnlPct)}
            positive={summary.totalPnl >= 0}
          />
          <SummaryCard
            label="Day's P&L"
            value={formatINR(summary.totalDayChange, true)}
            positive={summary.totalDayChange >= 0}
          />
        </div>
      ) : (
        <div className="bg-[#1A2236] border border-[#1E293B] rounded-xl p-8 text-center">
          <Briefcase className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400 mb-3">No portfolio data yet</p>
          <Link to="/portfolio" className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors">
            Add your first holding →
          </Link>
        </div>
      )}

      {/* Indices */}
      <section>
        <h2 className="text-base font-semibold text-slate-200 mb-3">Market Indices</h2>
        {idxLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {[1,2,3,4,5].map(i => <div key={i} className="h-20 bg-[#1A2236] rounded-xl animate-pulse" />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {indices.map((q) => <IndexCard key={q.symbol} quote={q} />)}
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Movers */}
        <section>
          <h2 className="text-base font-semibold text-slate-200 mb-3">Top Movers</h2>
          {moversLoading ? (
            <div className="h-64 bg-[#1A2236] rounded-xl animate-pulse" />
          ) : movers ? (
            <div className="bg-[#1A2236] border border-[#1E293B] rounded-xl overflow-hidden">
              <div className="grid grid-cols-2 divide-x divide-[#1E293B]">
                <div>
                  <div className="px-4 py-2.5 border-b border-[#1E293B] flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-xs font-semibold text-emerald-400">Top Gainers</span>
                  </div>
                  {movers.gainers.map((q) => (
                    <Link key={q.symbol} to={`/stocks/${q.symbol.replace(".NS","").replace(".BO","")}`} className="flex items-center justify-between px-4 py-2.5 hover:bg-[#1F2D45] transition-colors border-b border-[#1E293B] last:border-0">
                      <div>
                        <p className="text-xs font-semibold text-slate-200">{q.symbol.replace(".NS","").replace(".BO","")}</p>
                        <p className="text-xs text-slate-500 tabular-nums">{formatINR(q.price)}</p>
                      </div>
                      <span className="text-xs font-medium text-emerald-400 tabular-nums">+{q.changePct.toFixed(2)}%</span>
                    </Link>
                  ))}
                </div>
                <div>
                  <div className="px-4 py-2.5 border-b border-[#1E293B] flex items-center gap-1.5">
                    <TrendingDown className="w-3.5 h-3.5 text-red-400" />
                    <span className="text-xs font-semibold text-red-400">Top Losers</span>
                  </div>
                  {movers.losers.map((q) => (
                    <Link key={q.symbol} to={`/stocks/${q.symbol.replace(".NS","").replace(".BO","")}`} className="flex items-center justify-between px-4 py-2.5 hover:bg-[#1F2D45] transition-colors border-b border-[#1E293B] last:border-0">
                      <div>
                        <p className="text-xs font-semibold text-slate-200">{q.symbol.replace(".NS","").replace(".BO","")}</p>
                        <p className="text-xs text-slate-500 tabular-nums">{formatINR(q.price)}</p>
                      </div>
                      <span className="text-xs font-medium text-red-400 tabular-nums">{q.changePct.toFixed(2)}%</span>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </section>

        {/* Top Holdings */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-slate-200">Top Holdings</h2>
            <Link to="/portfolio" className="text-xs text-blue-400 hover:text-blue-300">View all →</Link>
          </div>
          {portLoading ? (
            <div className="h-64 bg-[#1A2236] rounded-xl animate-pulse" />
          ) : topHoldings.length > 0 ? (
            <div className="bg-[#1A2236] border border-[#1E293B] rounded-xl overflow-hidden">
              {topHoldings.map((h, i) => (
                <Link
                  key={h.id}
                  to={h.instrument_type === "STOCK" ? `/stocks/${h.symbol}` : `/mf/${h.instrument_id}`}
                  className={cn("flex items-center justify-between px-4 py-3 hover:bg-[#1F2D45] transition-colors", i < topHoldings.length - 1 && "border-b border-[#1E293B]")}
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-200">{h.symbol}</p>
                    <p className="text-xs text-slate-500 truncate max-w-[140px]">{h.name}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-slate-200 tabular-nums">{formatINR(h.currentValue ?? h.invested ?? 0, true)}</p>
                    <p className={cn("text-xs tabular-nums", changeColor(h.pnl ?? 0))}>
                      {formatPct(h.pnlPct ?? 0)}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="bg-[#1A2236] border border-[#1E293B] rounded-xl p-8 text-center">
              <p className="text-slate-400 text-sm">Add holdings to see them here</p>
            </div>
          )}
        </section>
      </div>

      {/* Disclaimer */}
      <p className="text-xs text-slate-600 text-center pb-2">
        Market data is delayed. <RefreshCw className="w-3 h-3 inline" /> Refreshes every 60s. Not financial advice.
      </p>
    </div>
  );
}
