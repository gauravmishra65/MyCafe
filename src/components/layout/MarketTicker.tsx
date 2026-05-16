import { useQuery } from "@tanstack/react-query";
import { marketApi } from "@/lib/api";
import { formatINR, formatPct } from "@/lib/format";
import { TrendingUp, TrendingDown } from "lucide-react";

const INDEX_LABELS: Record<string, string> = {
  "^NSEI": "NIFTY 50",
  "^BSESN": "SENSEX",
  "^NSEBANK": "NIFTY BANK",
  "^CNXIT": "NIFTY IT",
  "^INDIAVIX": "INDIA VIX",
};

export function MarketTicker() {
  const { data: indices = [] } = useQuery({
    queryKey: ["indices"],
    queryFn: () => marketApi.getIndices(),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  if (indices.length === 0) {
    return (
      <div className="h-8 bg-[#0D1424] border-b border-[#1E293B] flex items-center px-4">
        <div className="w-full h-3 bg-[#1A2236] rounded animate-pulse" />
      </div>
    );
  }

  const items = [...indices, ...indices];

  return (
    <div className="h-8 bg-[#0D1424] border-b border-[#1E293B] overflow-hidden flex items-center">
      <div className="flex animate-marquee whitespace-nowrap">
        {items.map((idx, i) => {
          const label = INDEX_LABELS[idx.symbol] ?? idx.symbol;
          const positive = idx.changePct >= 0;
          return (
            <span key={`${idx.symbol}-${i}`} className="inline-flex items-center gap-1.5 px-6 text-xs">
              <span className="text-slate-400 font-medium">{label}</span>
              <span className="text-slate-200 tabular-nums font-semibold">
                {formatINR(idx.price)}
              </span>
              <span className={positive ? "text-emerald-400 flex items-center gap-0.5" : "text-red-400 flex items-center gap-0.5"}>
                {positive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {formatPct(idx.changePct)}
              </span>
              <span className="text-[#1E293B] ml-4">|</span>
            </span>
          );
        })}
      </div>
    </div>
  );
}
