import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { GitCompare } from "lucide-react";
import { formatINR } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { MutualFund } from "@/types";

const CATEGORIES = ["All","Equity","Debt","Hybrid","ELSS","Index","ETF"];

export default function MutualFundsPage() {
  const [cat, setCat] = useState("All");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const PER = 50;

  const { data: funds = [], isLoading } = useQuery({
    queryKey: ["mutual-funds", cat],
    queryFn: async () => {
      let q = supabase.from("mutual_funds").select("*").order("aum", { ascending: false, nullsFirst: false }).limit(1000);
      if (cat !== "All") q = q.ilike("category", `%${cat}%`);
      const { data } = await q;
      return (data ?? []) as MutualFund[];
    },
    staleTime: 5 * 60_000,
  });

  const filtered = funds.filter(f => !search || f.name.toLowerCase().includes(search.toLowerCase()));
  const paginated = filtered.slice(page * PER, (page + 1) * PER);
  const totalPages = Math.ceil(filtered.length / PER);

  return (
    <div className="p-4 lg:p-6 space-y-5 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-100">Mutual Funds</h1>
        <Link to="/mf/compare" className="flex items-center gap-1.5 px-3 py-2 text-sm bg-[#1A2236] border border-[#1E293B] text-slate-300 rounded-lg hover:bg-[#1F2D45] transition-colors">
          <GitCompare className="w-3.5 h-3.5" /> Compare
        </Link>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex gap-1 flex-wrap">
          {CATEGORIES.map(c => (
            <button key={c} onClick={() => { setCat(c); setPage(0); }} className={cn("px-3 py-1.5 text-xs font-medium rounded-lg transition-colors", cat === c ? "bg-blue-600 text-white" : "bg-[#1A2236] text-slate-400 border border-[#1E293B] hover:text-slate-200")}>
              {c}
            </button>
          ))}
        </div>
        <input
          value={search} onChange={e => { setSearch(e.target.value); setPage(0); }}
          placeholder="Search funds..."
          className="px-3 py-1.5 bg-[#1A2236] border border-[#1E293B] rounded-lg text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-blue-500 w-full sm:w-64"
        />
      </div>

      <p className="text-xs text-slate-500">{filtered.length} funds</p>

      <div className="bg-[#1A2236] border border-[#1E293B] rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="p-4 space-y-2">{[1,2,3,4,5].map(i => <div key={i} className="h-12 bg-[#0A0E1A] rounded animate-pulse" />)}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-slate-500 border-b border-[#1E293B]">
                  <th className="px-4 py-2.5 text-left">Fund Name</th>
                  <th className="px-4 py-2.5 text-left">Category</th>
                  <th className="px-4 py-2.5 text-left">Risk</th>
                  <th className="px-4 py-2.5 text-right">NAV</th>
                  <th className="px-4 py-2.5 text-right">AUM (Cr)</th>
                  <th className="px-4 py-2.5 text-right">Min SIP</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((f: MutualFund, i: number) => (
                  <tr key={f.id} className={cn("hover:bg-[#1F2D45] transition-colors", i < paginated.length - 1 && "border-b border-[#1E293B]")}>
                    <td className="px-4 py-2.5">
                      <Link to={`/mf/${f.scheme_code}`} className="font-medium text-slate-100 hover:text-blue-400 transition-colors text-xs">{f.name}</Link>
                      <p className="text-xs text-slate-500">{f.amc}</p>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-slate-400">{f.category ?? "—"}</td>
                    <td className="px-4 py-2.5">
                      {f.risk_level && (
                        <span className={cn("text-xs px-1.5 py-0.5 rounded",
                          f.risk_level?.toLowerCase().includes("high") ? "bg-red-500/20 text-red-400" :
                          f.risk_level?.toLowerCase().includes("mod") ? "bg-yellow-500/20 text-yellow-400" :
                          "bg-green-500/20 text-green-400"
                        )}>
                          {f.risk_level}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-slate-200">₹{f.nav?.toFixed(4) ?? "—"}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-slate-400">{f.aum ? f.aum.toLocaleString("en-IN") : "—"}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-slate-400">{f.min_sip ? formatINR(f.min_sip) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="px-3 py-1.5 text-sm bg-[#1A2236] border border-[#1E293B] text-slate-300 rounded-lg disabled:opacity-40 hover:bg-[#1F2D45] transition-colors">Prev</button>
          <span className="text-sm text-slate-400">{page + 1} / {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="px-3 py-1.5 text-sm bg-[#1A2236] border border-[#1E293B] text-slate-300 rounded-lg disabled:opacity-40 hover:bg-[#1F2D45] transition-colors">Next</button>
        </div>
      )}
    </div>
  );
}
