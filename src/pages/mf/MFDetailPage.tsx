import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Plus } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { formatINR } from "@/lib/format";
import type { MutualFund } from "@/types";

export default function MFDetailPage() {
  const { schemeCode } = useParams<{ schemeCode: string }>();

  const { data: fund, isLoading } = useQuery({
    queryKey: ["mf", schemeCode],
    queryFn: async () => {
      const { data } = await supabase.from("mutual_funds").select("*").eq("scheme_code", schemeCode).single();
      return data as MutualFund | null;
    },
  });

  if (isLoading) return <div className="p-6"><div className="h-40 bg-[#1A2236] rounded-xl animate-pulse" /></div>;
  if (!fund) return <div className="p-6 text-slate-400">Fund not found</div>;

  return (
    <div className="p-4 lg:p-6 space-y-5 max-w-4xl mx-auto">
      <Link to="/mutual-funds" className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200 w-fit">
        <ArrowLeft className="w-4 h-4" /> Back
      </Link>

      <div className="bg-[#1A2236] border border-[#1E293B] rounded-xl p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-lg font-bold text-slate-100 leading-tight">{fund.name}</h1>
            <p className="text-sm text-slate-400 mt-1">{fund.amc}</p>
            <div className="flex items-center gap-2 mt-2">
              {fund.category && <span className="px-2 py-0.5 text-xs bg-purple-500/20 text-purple-400 rounded">{fund.category}</span>}
              {fund.risk_level && <span className="px-2 py-0.5 text-xs bg-yellow-500/20 text-yellow-400 rounded">{fund.risk_level}</span>}
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-slate-100 tabular-nums">₹{fund.nav?.toFixed(4) ?? "—"}</p>
            <p className="text-xs text-slate-500 mt-1">NAV as of {fund.nav_date ?? "—"}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[
          { label: "AUM", value: fund.aum ? formatINR(fund.aum * 100000, true) : "—" },
          { label: "Expense Ratio", value: fund.expense_ratio ? `${fund.expense_ratio}%` : "—" },
          { label: "Min SIP", value: fund.min_sip ? formatINR(fund.min_sip) : "—" },
          { label: "Min Lumpsum", value: fund.min_lumpsum ? formatINR(fund.min_lumpsum) : "—" },
          { label: "Fund Manager", value: fund.fund_manager ?? "—" },
          { label: "Sub-Category", value: fund.sub_category ?? "—" },
        ].map(({ label, value }) => (
          <div key={label} className="bg-[#1A2236] border border-[#1E293B] rounded-xl p-3">
            <p className="text-xs text-slate-500 mb-1">{label}</p>
            <p className="text-sm font-semibold text-slate-200">{value}</p>
          </div>
        ))}
      </div>

      <Link to="/portfolio" className="flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg transition-colors w-fit text-sm">
        <Plus className="w-4 h-4" /> Add to Portfolio
      </Link>
    </div>
  );
}
