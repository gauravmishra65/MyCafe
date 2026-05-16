import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getPortfolioWithPrices } from "@/services/portfolioService";
import { supabase } from "@/lib/supabase";
import { formatINR, formatPct, changeColor, exportToCsv } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Download, AlertCircle } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from "recharts";
import type { PortfolioHolding, PortfolioTransaction } from "@/types";

const DISCLAIMER = "Tax estimates are for informational purposes only. Consult a tax professional or SEBI-registered advisor. Not financial advice.";

const FY_OPTIONS = [
  { label: "FY 2024-25", start: "2024-04-01", end: "2025-03-31" },
  { label: "FY 2023-24", start: "2023-04-01", end: "2024-03-31" },
  { label: "All Time", start: "2000-01-01", end: "2099-12-31" },
];

export default function PnLPage() {
  const [tab, setTab] = useState<"unrealized" | "realized" | "tax">("unrealized");
  const [fy, setFy] = useState(0);

  const { data: portfolio } = useQuery({
    queryKey: ["portfolio"],
    queryFn: getPortfolioWithPrices,
  });

  const { data: transactions = [] } = useQuery({
    queryKey: ["transactions"],
    queryFn: async () => {
      const { data } = await supabase.from("portfolio_transactions").select("*").order("transaction_date");
      return data ?? [];
    },
  });

  const holdings = portfolio?.holdings ?? [];
  const summary = portfolio?.summary;

  const realizedTxs = useMemo(() => {
    const { start, end } = FY_OPTIONS[fy];
    return (transactions as PortfolioTransaction[]).filter(tx =>
      (tx.type === "SELL" || tx.type === "REDEEM") &&
      tx.transaction_date >= start && tx.transaction_date <= end
    );
  }, [transactions, fy]);

  const stcg = realizedTxs.filter(tx => {
    const buyTx = (transactions as PortfolioTransaction[]).find(t => t.symbol === tx.symbol && (t.type === "BUY" || t.type === "SIP" || t.type === "LUMPSUM"));
    if (!buyTx) return true;
    const days = (new Date(tx.transaction_date).getTime() - new Date(buyTx.transaction_date).getTime()) / (1000 * 60 * 60 * 24);
    return days < 365;
  });
  const ltcg = realizedTxs.filter(tx => !stcg.includes(tx));

  const stcgAmount = stcg.reduce((s, tx) => s + tx.quantity * tx.price, 0);
  const ltcgAmount = ltcg.reduce((s, tx) => s + tx.quantity * tx.price, 0);
  const stcgTax = stcgAmount * 0.15;
  const ltcgTax = Math.max(0, ltcgAmount - 100000) * 0.10;

  const bestHoldings = [...holdings].sort((a, b) => (b.pnlPct ?? 0) - (a.pnlPct ?? 0)).slice(0, 5);
  const worstHoldings = [...holdings].sort((a, b) => (a.pnlPct ?? 0) - (b.pnlPct ?? 0)).slice(0, 5);

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-100">P&L Analysis</h1>
        <div className="flex items-center gap-2">
          <select
            value={fy}
            onChange={e => setFy(Number(e.target.value))}
            className="px-3 py-2 bg-[#1A2236] border border-[#1E293B] rounded-lg text-sm text-slate-200 focus:outline-none"
          >
            {FY_OPTIONS.map((o, i) => <option key={i} value={i}>{o.label}</option>)}
          </select>
          <button
            onClick={() => exportToCsv(holdings.map(h => ({ Symbol: h.symbol, Invested: h.invested, Value: h.currentValue, PnL: h.pnl, "PnL%": h.pnlPct })), "pnl.csv")}
            className="flex items-center gap-1.5 px-3 py-2 text-sm bg-[#1A2236] border border-[#1E293B] text-slate-300 rounded-lg hover:bg-[#1F2D45] transition-colors"
          >
            <Download className="w-3.5 h-3.5" /> CSV
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[#1A2236] border border-[#1E293B] rounded-xl p-1 w-fit">
        {(["unrealized","realized","tax"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={cn("px-4 py-1.5 text-sm font-medium rounded-lg transition-colors capitalize", tab === t ? "bg-blue-600 text-white" : "text-slate-400 hover:text-slate-200")}>
            {t}
          </button>
        ))}
      </div>

      {/* Unrealized */}
      {tab === "unrealized" && (
        <div className="space-y-4">
          {summary && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-[#1A2236] border border-[#1E293B] rounded-xl p-4">
                <p className="text-xs text-slate-400 mb-1">Total Invested</p>
                <p className="text-xl font-bold text-slate-100 tabular-nums">{formatINR(summary.totalInvested, true)}</p>
              </div>
              <div className="bg-[#1A2236] border border-[#1E293B] rounded-xl p-4">
                <p className="text-xs text-slate-400 mb-1">Current Value</p>
                <p className="text-xl font-bold text-slate-100 tabular-nums">{formatINR(summary.totalCurrentValue, true)}</p>
              </div>
              <div className="bg-[#1A2236] border border-[#1E293B] rounded-xl p-4">
                <p className="text-xs text-slate-400 mb-1">Unrealized P&L</p>
                <p className={cn("text-xl font-bold tabular-nums", changeColor(summary.totalPnl))}>{formatINR(summary.totalPnl, true)}</p>
                <p className={cn("text-xs", changeColor(summary.totalPnl))}>{formatPct(summary.totalPnlPct)}</p>
              </div>
              <div className="bg-[#1A2236] border border-[#1E293B] rounded-xl p-4">
                <p className="text-xs text-slate-400 mb-1">Day's P&L</p>
                <p className={cn("text-xl font-bold tabular-nums", changeColor(summary.totalDayChange))}>{formatINR(summary.totalDayChange, true)}</p>
              </div>
            </div>
          )}

          {/* Holdings table */}
          <div className="bg-[#1A2236] border border-[#1E293B] rounded-xl overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-slate-500 border-b border-[#1E293B]">
                  <th className="px-4 py-2.5 text-left">Symbol</th>
                  <th className="px-4 py-2.5 text-right">Invested</th>
                  <th className="px-4 py-2.5 text-right">Value</th>
                  <th className="px-4 py-2.5 text-right">P&L</th>
                  <th className="px-4 py-2.5 text-right">Return %</th>
                </tr>
              </thead>
              <tbody>
                {holdings.map((h: PortfolioHolding, i: number) => (
                  <tr key={h.id} className={cn("hover:bg-[#1F2D45] transition-colors", i < holdings.length - 1 && "border-b border-[#1E293B]")}>
                    <td className="px-4 py-2.5 font-semibold text-slate-100">{h.symbol}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-slate-300">{formatINR(h.invested ?? 0, true)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-slate-200">{formatINR(h.currentValue ?? 0, true)}</td>
                    <td className={cn("px-4 py-2.5 text-right tabular-nums", changeColor(h.pnl ?? 0))}>{formatINR(h.pnl ?? 0, true)}</td>
                    <td className={cn("px-4 py-2.5 text-right tabular-nums", changeColor(h.pnlPct ?? 0))}>{formatPct(h.pnlPct ?? 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Best/Worst Performers */}
          {holdings.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-[#1A2236] border border-[#1E293B] rounded-xl p-4">
                <h3 className="text-sm font-semibold text-slate-200 mb-3">Best Performers</h3>
                <div className="space-y-2">
                  {bestHoldings.map(h => (
                    <div key={h.id} className="flex items-center gap-3">
                      <span className="text-xs font-semibold text-slate-300 w-20 truncate">{h.symbol}</span>
                      <div className="flex-1 h-1.5 bg-[#0A0E1A] rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.min(100, Math.abs(h.pnlPct ?? 0))}%` }} />
                      </div>
                      <span className="text-xs text-emerald-400 tabular-nums w-16 text-right">{formatPct(h.pnlPct ?? 0)}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-[#1A2236] border border-[#1E293B] rounded-xl p-4">
                <h3 className="text-sm font-semibold text-slate-200 mb-3">Worst Performers</h3>
                <div className="space-y-2">
                  {worstHoldings.map(h => (
                    <div key={h.id} className="flex items-center gap-3">
                      <span className="text-xs font-semibold text-slate-300 w-20 truncate">{h.symbol}</span>
                      <div className="flex-1 h-1.5 bg-[#0A0E1A] rounded-full overflow-hidden">
                        <div className="h-full bg-red-500 rounded-full" style={{ width: `${Math.min(100, Math.abs(h.pnlPct ?? 0))}%` }} />
                      </div>
                      <span className="text-xs text-red-400 tabular-nums w-16 text-right">{formatPct(h.pnlPct ?? 0)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Realized */}
      {tab === "realized" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-[#1A2236] border border-[#1E293B] rounded-xl p-4">
              <p className="text-xs text-slate-400 mb-1">STCG Proceeds (&lt;1Y)</p>
              <p className="text-xl font-bold text-slate-100 tabular-nums">{formatINR(stcgAmount, true)}</p>
              <p className="text-xs text-slate-500 mt-1">{stcg.length} trades</p>
            </div>
            <div className="bg-[#1A2236] border border-[#1E293B] rounded-xl p-4">
              <p className="text-xs text-slate-400 mb-1">LTCG Proceeds (≥1Y)</p>
              <p className="text-xl font-bold text-slate-100 tabular-nums">{formatINR(ltcgAmount, true)}</p>
              <p className="text-xs text-slate-500 mt-1">{ltcg.length} trades</p>
            </div>
          </div>
          {realizedTxs.length === 0 ? (
            <div className="bg-[#1A2236] border border-[#1E293B] rounded-xl p-8 text-center">
              <p className="text-slate-400 text-sm">No realized trades in {FY_OPTIONS[fy].label}</p>
            </div>
          ) : (
            <div className="bg-[#1A2236] border border-[#1E293B] rounded-xl overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-slate-500 border-b border-[#1E293B]">
                    <th className="px-4 py-2.5 text-left">Symbol</th>
                    <th className="px-4 py-2.5 text-left">Date</th>
                    <th className="px-4 py-2.5 text-right">Qty</th>
                    <th className="px-4 py-2.5 text-right">Price</th>
                    <th className="px-4 py-2.5 text-right">Amount</th>
                    <th className="px-4 py-2.5 text-left">Type</th>
                  </tr>
                </thead>
                <tbody>
                  {realizedTxs.map((tx: PortfolioTransaction, i: number) => (
                    <tr key={tx.id} className={cn("hover:bg-[#1F2D45] transition-colors", i < realizedTxs.length - 1 && "border-b border-[#1E293B]")}>
                      <td className="px-4 py-2.5 font-semibold text-slate-100">{tx.symbol}</td>
                      <td className="px-4 py-2.5 text-slate-400 text-xs">{tx.transaction_date}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-slate-300">{tx.quantity}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-slate-300">{formatINR(tx.price)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-slate-200">{formatINR(tx.amount, true)}</td>
                      <td className="px-4 py-2.5">
                        <span className="text-xs px-1.5 py-0.5 rounded bg-red-500/20 text-red-400">{tx.type}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tax */}
      {tab === "tax" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-[#1A2236] border border-[#1E293B] rounded-xl p-5">
              <h3 className="text-sm font-semibold text-slate-200 mb-3">STCG (15% flat)</h3>
              <p className="text-xs text-slate-400 mb-1">Proceeds</p>
              <p className="text-xl font-bold text-slate-100 tabular-nums mb-3">{formatINR(stcgAmount, true)}</p>
              <p className="text-xs text-slate-400 mb-1">Estimated Tax</p>
              <p className="text-xl font-bold text-red-400 tabular-nums">{formatINR(stcgTax, true)}</p>
            </div>
            <div className="bg-[#1A2236] border border-[#1E293B] rounded-xl p-5">
              <h3 className="text-sm font-semibold text-slate-200 mb-3">LTCG (10% above ₹1L)</h3>
              <p className="text-xs text-slate-400 mb-1">Proceeds</p>
              <p className="text-xl font-bold text-slate-100 tabular-nums mb-3">{formatINR(ltcgAmount, true)}</p>
              <p className="text-xs text-slate-400 mb-1">Estimated Tax</p>
              <p className="text-xl font-bold text-red-400 tabular-nums">{formatINR(ltcgTax, true)}</p>
            </div>
          </div>
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-3 flex gap-2">
            <AlertCircle className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" />
            <p className="text-xs text-yellow-400/80">{DISCLAIMER}</p>
          </div>
        </div>
      )}
    </div>
  );
}
