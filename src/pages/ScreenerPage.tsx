import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Filter } from "lucide-react";
import { formatINR } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";
import type { Stock } from "@/types";

const SECTORS = [
  "Financial Services","Information Technology","Oil Gas & Consumable Fuels","FMCG",
  "Automobile","Capital Goods","Pharma","Telecom","Consumer Durables","Construction Materials",
  "Services","Metals & Mining","Power","Healthcare","Media","Real Estate",
];
const CAP_CATS = ["LARGE","MID","SMALL"] as const;

export default function ScreenerPage() {
  const [sector, setSector] = useState<string[]>([]);
  const [caps, setCaps] = useState<string[]>([]);
  const [exchange, setExchange] = useState<"" | "NSE" | "BSE">("");
  const [page, setPage] = useState(0);
  const PER_PAGE = 50;

  const { data: stocks = [], isLoading } = useQuery({
    queryKey: ["screener-stocks"],
    queryFn: async () => {
      const { data } = await supabase
        .from("stocks")
        .select("id,symbol,yahoo_symbol,name,sector,cap_category,exchange,isin,market_cap")
        .order("market_cap", { ascending: false, nullsFirst: false })
        .limit(2000);
      return data ?? [];
    },
    staleTime: 5 * 60_000,
  });

  const filtered = useMemo(() => {
    let r = stocks as Stock[];
    if (sector.length) r = r.filter(s => s.sector && sector.includes(s.sector));
    if (caps.length) r = r.filter(s => s.cap_category && caps.includes(s.cap_category));
    if (exchange) r = r.filter(s => s.exchange === exchange);
    return r;
  }, [stocks, sector, caps, exchange]);

  const paginated = filtered.slice(page * PER_PAGE, (page + 1) * PER_PAGE);
  const totalPages = Math.ceil(filtered.length / PER_PAGE);

  const toggleSector = (s: string) => setSector(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  const toggleCap = (c: string) => setCaps(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);

  return (
    <div className="p-4 lg:p-6 space-y-5 max-w-7xl mx-auto">
      <div className="flex items-center gap-2">
        <Filter className="w-5 h-5 text-blue-400" />
        <h1 className="text-2xl font-bold text-slate-100">Stock Screener</h1>
        {filtered.length > 0 && <span className="ml-2 text-xs text-slate-400 bg-[#1A2236] px-2 py-1 rounded-full">{filtered.length} results</span>}
      </div>

      {/* Filters */}
      <div className="bg-[#1A2236] border border-[#1E293B] rounded-xl p-4 space-y-4">
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Exchange</p>
          <div className="flex gap-2">
            {(["","NSE","BSE"] as const).map(e => (
              <button key={e} onClick={() => setExchange(e)} className={cn("px-3 py-1.5 text-xs font-medium rounded-lg transition-colors", exchange === e ? "bg-blue-600 text-white" : "bg-[#0A0E1A] text-slate-400 border border-[#1E293B] hover:text-slate-200")}>
                {e || "All"}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Market Cap</p>
          <div className="flex gap-2">
            {CAP_CATS.map(c => (
              <button key={c} onClick={() => toggleCap(c)} className={cn("px-3 py-1.5 text-xs font-medium rounded-lg transition-colors", caps.includes(c) ? "bg-blue-600 text-white" : "bg-[#0A0E1A] text-slate-400 border border-[#1E293B] hover:text-slate-200")}>
                {c}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Sector</p>
          <div className="flex flex-wrap gap-2">
            {SECTORS.map(s => (
              <button key={s} onClick={() => toggleSector(s)} className={cn("px-2.5 py-1 text-xs rounded-lg transition-colors", sector.includes(s) ? "bg-blue-600 text-white" : "bg-[#0A0E1A] text-slate-400 border border-[#1E293B] hover:text-slate-200")}>
                {s}
              </button>
            ))}
          </div>
        </div>

        {(sector.length > 0 || caps.length > 0 || exchange) && (
          <button onClick={() => { setSector([]); setCaps([]); setExchange(""); }} className="text-xs text-blue-400 hover:text-blue-300">
            Clear all filters
          </button>
        )}
      </div>

      {/* Results Table */}
      <div className="bg-[#1A2236] border border-[#1E293B] rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="p-4 space-y-2">{[1,2,3,4,5].map(i => <div key={i} className="h-12 bg-[#0A0E1A] rounded animate-pulse" />)}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-slate-500 border-b border-[#1E293B]">
                  <th className="px-4 py-2.5 text-left">Symbol</th>
                  <th className="px-4 py-2.5 text-left">Name</th>
                  <th className="px-4 py-2.5 text-left">Sector</th>
                  <th className="px-4 py-2.5 text-left">Cap</th>
                  <th className="px-4 py-2.5 text-left">Exchange</th>
                  <th className="px-4 py-2.5 text-right">Market Cap</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((s: Stock, i: number) => (
                  <tr key={s.id} className={cn("hover:bg-[#1F2D45] transition-colors", i < paginated.length - 1 && "border-b border-[#1E293B]")}>
                    <td className="px-4 py-2.5">
                      <Link to={`/stocks/${s.symbol}`} className="font-semibold text-blue-400 hover:text-blue-300 transition-colors">
                        {s.symbol}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-slate-300 max-w-[200px] truncate">{s.name}</td>
                    <td className="px-4 py-2.5 text-slate-400 text-xs">{s.sector ?? "—"}</td>
                    <td className="px-4 py-2.5">
                      {s.cap_category && (
                        <span className={cn("text-xs px-1.5 py-0.5 rounded font-medium",
                          s.cap_category === "LARGE" ? "bg-blue-500/20 text-blue-400" :
                          s.cap_category === "MID" ? "bg-yellow-500/20 text-yellow-400" :
                          "bg-slate-500/20 text-slate-400"
                        )}>
                          {s.cap_category}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={cn("text-xs px-1.5 py-0.5 rounded font-medium", s.exchange === "NSE" ? "bg-orange-500/20 text-orange-400" : "bg-sky-500/20 text-sky-400")}>
                        {s.exchange}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-slate-400 text-xs">
                      {s.market_cap ? formatINR(s.market_cap, true) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="px-3 py-1.5 text-sm bg-[#1A2236] border border-[#1E293B] text-slate-300 rounded-lg disabled:opacity-40 hover:bg-[#1F2D45] transition-colors">
            Prev
          </button>
          <span className="text-sm text-slate-400">{page + 1} / {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="px-3 py-1.5 text-sm bg-[#1A2236] border border-[#1E293B] text-slate-300 rounded-lg disabled:opacity-40 hover:bg-[#1F2D45] transition-colors">
            Next
          </button>
        </div>
      )}
    </div>
  );
}
