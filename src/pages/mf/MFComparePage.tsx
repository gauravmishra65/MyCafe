import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { InstrumentSearch } from "@/components/shared/InstrumentSearch";
import { X } from "lucide-react";
import type { SearchResult, MutualFund } from "@/types";
import { formatINR } from "@/lib/format";

export default function MFComparePage() {
  const [selected, setSelected] = useState<string[]>([]);

  const { data: funds = [] } = useQuery({
    queryKey: ["mf-compare", selected],
    queryFn: async () => {
      if (!selected.length) return [];
      const { data } = await supabase.from("mutual_funds").select("*").in("scheme_code", selected);
      return (data ?? []) as MutualFund[];
    },
    enabled: selected.length > 0,
  });

  const handleSelect = (r: SearchResult) => {
    if (selected.length >= 3) return;
    if (r.scheme_code && !selected.includes(r.scheme_code)) {
      setSelected(prev => [...prev, r.scheme_code!]);
    }
  };

  const ROWS = [
    { label: "NAV", key: "nav", format: (v: number) => `₹${v?.toFixed(4) ?? "—"}` },
    { label: "Category", key: "category", format: (v: string) => v ?? "—" },
    { label: "AUM", key: "aum", format: (v: number) => v ? formatINR(v * 100000, true) : "—" },
    { label: "Expense Ratio", key: "expense_ratio", format: (v: number) => v ? `${v}%` : "—" },
    { label: "Min SIP", key: "min_sip", format: (v: number) => v ? formatINR(v) : "—" },
    { label: "Risk", key: "risk_level", format: (v: string) => v ?? "—" },
    { label: "Fund Manager", key: "fund_manager", format: (v: string) => v ?? "—" },
  ];

  return (
    <div className="p-4 lg:p-6 space-y-5 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-100">Compare Mutual Funds</h1>
      <p className="text-sm text-slate-400">Select up to 3 funds to compare side-by-side</p>

      {selected.length < 3 && (
        <div className="max-w-sm">
          <InstrumentSearch onSelect={handleSelect} segment="MF" placeholder="Search mutual fund..." />
        </div>
      )}

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selected.map(code => {
            const fund = funds.find(f => f.scheme_code === code);
            return (
              <span key={code} className="flex items-center gap-2 px-3 py-1.5 bg-[#1A2236] border border-[#1E293B] rounded-lg text-xs text-slate-200">
                {fund?.name ?? code}
                <button onClick={() => setSelected(prev => prev.filter(s => s !== code))} className="text-slate-500 hover:text-slate-200">
                  <X className="w-3 h-3" />
                </button>
              </span>
            );
          })}
        </div>
      )}

      {funds.length > 0 && (
        <div className="bg-[#1A2236] border border-[#1E293B] rounded-xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1E293B]">
                <th className="px-4 py-3 text-left text-xs text-slate-500">Metric</th>
                {funds.map(f => (
                  <th key={f.id} className="px-4 py-3 text-left text-xs text-slate-200 font-semibold max-w-[160px]">
                    <p className="truncate">{f.name}</p>
                    <p className="text-slate-500 font-normal">{f.amc}</p>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROWS.map(({ label, key, format }) => (
                <tr key={key} className="border-b border-[#1E293B] last:border-0">
                  <td className="px-4 py-2.5 text-xs text-slate-400">{label}</td>
                  {funds.map(f => (
                    <td key={f.id} className="px-4 py-2.5 text-sm text-slate-200 tabular-nums">
                      {format((f as unknown as Record<string, unknown>)[key] as never)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
