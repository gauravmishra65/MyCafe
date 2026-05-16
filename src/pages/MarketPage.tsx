import { useQuery } from "@tanstack/react-query";
import { TrendingUp, TrendingDown, Activity } from "lucide-react";
import { marketApi } from "@/lib/api";
import { formatINR, formatPct, changeColor, changeBg } from "@/lib/format";
import { isMarketOpen } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";

const INDEX_LABELS: Record<string, string> = {
  "^NSEI": "NIFTY 50", "^BSESN": "SENSEX", "^NSEBANK": "NIFTY BANK", "^CNXIT": "NIFTY IT", "^INDIAVIX": "VIX",
};

const SECTORS = [
  { name: "IT", symbols: ["TCS.NS","INFY.NS","HCLTECH.NS","WIPRO.NS"] },
  { name: "Banking", symbols: ["HDFCBANK.NS","ICICIBANK.NS","SBIN.NS","AXISBANK.NS","KOTAKBANK.NS"] },
  { name: "Auto", symbols: ["MARUTI.NS","TATAMOTORS.NS"] },
  { name: "FMCG", symbols: ["HINDUNILVR.NS","ITC.NS","NESTLEIND.NS"] },
  { name: "Pharma", symbols: ["SUNPHARMA.NS"] },
  { name: "Telecom", symbols: ["BHARTIARTL.NS"] },
  { name: "Oil & Gas", symbols: ["RELIANCE.NS"] },
  { name: "Infra", symbols: ["LT.NS"] },
];

export default function MarketPage() {
  const marketOpen = isMarketOpen();

  const { data: indices = [], isLoading: idxLoading } = useQuery({
    queryKey: ["indices"],
    queryFn: () => marketApi.getIndices(),
    refetchInterval: 30_000,
  });

  const { data: movers, isLoading: moversLoading } = useQuery({
    queryKey: ["movers"],
    queryFn: () => marketApi.getMovers(),
    refetchInterval: 30_000,
  });

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-slate-100">Market Overview</h1>
        </div>
        <span className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium", marketOpen ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-slate-500/20 text-slate-400 border border-slate-500/30")}>
          <div className={cn("w-1.5 h-1.5 rounded-full", marketOpen ? "bg-emerald-400 animate-pulse" : "bg-slate-500")} />
          Market {marketOpen ? "Open" : "Closed"}
        </span>
      </div>

      {/* Indices */}
      <section>
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Indices</h2>
        {idxLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {[1,2,3,4,5].map(i => <div key={i} className="h-24 bg-[#1A2236] rounded-xl animate-pulse" />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {indices.map(q => (
              <div key={q.symbol} className="bg-[#1A2236] border border-[#1E293B] rounded-xl p-4">
                <p className="text-xs text-slate-400 mb-1">{INDEX_LABELS[q.symbol] ?? q.symbol}</p>
                <p className="text-lg font-bold text-slate-100 tabular-nums">{formatINR(q.price)}</p>
                <span className={cn("text-xs mt-1 flex items-center gap-0.5 w-fit px-1.5 py-0.5 rounded", changeBg(q.changePct))}>
                  {q.changePct >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  {formatPct(q.changePct)}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Gainers & Losers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {moversLoading ? (
          <div className="h-80 bg-[#1A2236] rounded-xl animate-pulse col-span-2" />
        ) : movers ? (
          <>
            <section>
              <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-400" /> Top Gainers
              </h2>
              <div className="bg-[#1A2236] border border-[#1E293B] rounded-xl overflow-hidden">
                {movers.gainers.map((q, i) => (
                  <Link
                    key={q.symbol}
                    to={`/stocks/${q.symbol.replace(".NS","").replace(".BO","")}`}
                    className={cn("flex items-center justify-between px-4 py-3 hover:bg-[#1F2D45] transition-colors", i < movers.gainers.length - 1 && "border-b border-[#1E293B]")}
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-100">{q.symbol.replace(".NS","").replace(".BO","")}</p>
                      <p className="text-xs text-slate-500 truncate max-w-[160px]">{q.name}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm tabular-nums text-slate-200">{formatINR(q.price)}</p>
                      <p className="text-xs text-emerald-400 tabular-nums">+{q.changePct.toFixed(2)}%</p>
                    </div>
                  </Link>
                ))}
              </div>
            </section>

            <section>
              <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                <TrendingDown className="w-4 h-4 text-red-400" /> Top Losers
              </h2>
              <div className="bg-[#1A2236] border border-[#1E293B] rounded-xl overflow-hidden">
                {movers.losers.map((q, i) => (
                  <Link
                    key={q.symbol}
                    to={`/stocks/${q.symbol.replace(".NS","").replace(".BO","")}`}
                    className={cn("flex items-center justify-between px-4 py-3 hover:bg-[#1F2D45] transition-colors", i < movers.losers.length - 1 && "border-b border-[#1E293B]")}
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-100">{q.symbol.replace(".NS","").replace(".BO","")}</p>
                      <p className="text-xs text-slate-500 truncate max-w-[160px]">{q.name}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm tabular-nums text-slate-200">{formatINR(q.price)}</p>
                      <p className="text-xs text-red-400 tabular-nums">{q.changePct.toFixed(2)}%</p>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          </>
        ) : null}
      </div>

      {/* Sector Heatmap */}
      <section>
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
          <Activity className="w-4 h-4" /> Sector Heatmap
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {SECTORS.map(({ name }) => (
            <Link
              key={name}
              to={`/screener?sector=${encodeURIComponent(name)}`}
              className="bg-[#1A2236] border border-[#1E293B] rounded-xl p-4 hover:bg-[#1F2D45] transition-colors text-center"
            >
              <p className="text-sm font-semibold text-slate-200">{name}</p>
              <p className="text-xs text-slate-500 mt-1">View stocks →</p>
            </Link>
          ))}
        </div>
      </section>

      <p className="text-xs text-slate-600 text-center">Data refreshes every 30s. Prices may be delayed.</p>
    </div>
  );
}
