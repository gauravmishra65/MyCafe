import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Upload, Download, Trash2, Edit2, ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import { getPortfolioWithPrices, addTransaction } from "@/services/portfolioService";
import { formatINR, formatPct, changeColor, exportToCsv } from "@/lib/format";
import { cn } from "@/lib/utils";
import { InstrumentSearch } from "@/components/shared/InstrumentSearch";
import { supabase } from "@/lib/supabase";
import type { SearchResult, PortfolioHolding } from "@/types";
import toast from "react-hot-toast";
import { useForm } from "react-hook-form";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

type SortKey = "symbol" | "quantity" | "avg_price" | "ltp" | "invested" | "currentValue" | "pnl" | "pnlPct";
type SortDir = "asc" | "desc" | "none";

const SECTOR_COLORS = ["#3B82F6","#10B981","#F59E0B","#EF4444","#8B5CF6","#EC4899","#14B8A6","#F97316","#06B6D4"];

function SortIcon({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey; sortDir: SortDir }) {
  if (col !== sortKey || sortDir === "none") return <ChevronsUpDown className="w-3 h-3 text-slate-600" />;
  return sortDir === "asc" ? <ChevronUp className="w-3 h-3 text-blue-400" /> : <ChevronDown className="w-3 h-3 text-blue-400" />;
}

interface TxFormData {
  type: "BUY" | "SELL";
  quantity: string;
  price: string;
  brokerage: string;
  transaction_date: string;
  notes: string;
}

export default function PortfolioPage() {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [selectedInstrument, setSelectedInstrument] = useState<SearchResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<"ALL" | "NSE" | "BSE">("ALL");
  const [sortKey, setSortKey] = useState<SortKey>("pnl");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const { data: portfolio, isLoading } = useQuery({
    queryKey: ["portfolio"],
    queryFn: getPortfolioWithPrices,
    staleTime: 60_000,
  });

  const { register, handleSubmit, reset, setValue } = useForm<TxFormData>({
    defaultValues: { type: "BUY", quantity: "", price: "", brokerage: "0", transaction_date: new Date().toISOString().split("T")[0], notes: "" },
  });

  const stocks = useMemo(() => {
    let h = portfolio?.holdings.filter(h => h.instrument_type === "STOCK") ?? [];
    if (filter !== "ALL") h = h.filter(h => h.exchange === filter);
    if (sortDir !== "none") {
      h = [...h].sort((a, b) => {
        const av = (a as unknown as Record<string, number>)[sortKey] ?? 0;
        const bv = (b as unknown as Record<string, number>)[sortKey] ?? 0;
        return sortDir === "asc" ? av - bv : bv - av;
      });
    }
    return h;
  }, [portfolio, filter, sortKey, sortDir]);

  const mfs = useMemo(() => portfolio?.holdings.filter(h => h.instrument_type === "MF") ?? [], [portfolio]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === "desc" ? "asc" : d === "asc" ? "none" : "desc");
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const sectorData = useMemo(() => {
    const map: Record<string, number> = {};
    for (const h of portfolio?.holdings ?? []) {
      const sector = h.sector ?? "Other";
      map[sector] = (map[sector] ?? 0) + (h.currentValue ?? h.invested ?? 0);
    }
    return Object.entries(map).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value }));
  }, [portfolio]);

  const onSubmit = async (data: TxFormData) => {
    if (!selectedInstrument) { toast.error("Select an instrument"); return; }
    setSaving(true);
    try {
      await addTransaction({
        instrument_type: selectedInstrument.instrument_type,
        instrument_id: selectedInstrument.id,
        symbol: selectedInstrument.symbol,
        company_name: selectedInstrument.name,
        exchange: selectedInstrument.exchange ?? undefined,
        sector: selectedInstrument.sector ?? undefined,
        type: data.type,
        quantity: parseFloat(data.quantity),
        price: parseFloat(data.price),
        brokerage: parseFloat(data.brokerage || "0"),
        transaction_date: data.transaction_date,
        notes: data.notes || undefined,
      });
      await qc.invalidateQueries({ queryKey: ["portfolio"] });
      toast.success("Transaction added!");
      setShowModal(false);
      reset();
      setSelectedInstrument(null);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (h: PortfolioHolding) => {
    if (!confirm(`Delete ${h.symbol} from portfolio?`)) return;
    const { error } = await supabase.from("portfolio_holdings").delete().eq("id", h.id);
    if (error) { toast.error("Delete failed"); return; }
    await qc.invalidateQueries({ queryKey: ["portfolio"] });
    toast.success("Holding removed");
  };

  const summary = portfolio?.summary;

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-100">Portfolio</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => exportToCsv(stocks.map(h => ({
              Symbol: h.symbol, Name: h.name, Qty: h.quantity, "Avg Price": h.avg_price,
              LTP: h.ltp, Invested: h.invested, Value: h.currentValue, "P&L": h.pnl, "P&L%": h.pnlPct
            })), "portfolio.csv")}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-slate-300 hover:text-slate-100 bg-[#1A2236] hover:bg-[#1F2D45] border border-[#1E293B] rounded-lg transition-colors"
          >
            <Download className="w-3.5 h-3.5" /> Export
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" /> Add Transaction
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="h-24 bg-[#1A2236] rounded-xl animate-pulse" />)}
        </div>
      ) : summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Invested", value: formatINR(summary.totalInvested, true) },
            { label: "Current Value", value: formatINR(summary.totalCurrentValue, true) },
            { label: "Total P&L", value: formatINR(summary.totalPnl, true), pct: formatPct(summary.totalPnlPct), pos: summary.totalPnl >= 0 },
            { label: "Day's P&L", value: formatINR(summary.totalDayChange, true), pos: summary.totalDayChange >= 0 },
          ].map(({ label, value, pct, pos }) => (
            <div key={label} className="bg-[#1A2236] border border-[#1E293B] rounded-xl p-4">
              <p className="text-xs text-slate-400 mb-1">{label}</p>
              <p className="text-xl font-bold text-slate-100 tabular-nums">{value}</p>
              {pct && <p className={cn("text-xs mt-1", pos ? "text-emerald-400" : "text-red-400")}>{pct}</p>}
            </div>
          ))}
        </div>
      )}

      {/* Sector Allocation Chart */}
      {sectorData.length > 0 && (
        <div className="bg-[#1A2236] border border-[#1E293B] rounded-xl p-4">
          <h2 className="text-sm font-semibold text-slate-200 mb-4">Sector Allocation</h2>
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <ResponsiveContainer width={180} height={180}>
              <PieChart>
                <Pie data={sectorData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" paddingAngle={2}>
                  {sectorData.map((_, i) => (
                    <Cell key={i} fill={SECTOR_COLORS[i % SECTOR_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: unknown) => formatINR(v as number, true)} contentStyle={{ background: "#1A2236", border: "1px solid #1E293B", borderRadius: 8 }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="grid grid-cols-2 gap-x-8 gap-y-2 flex-1">
              {sectorData.map(({ name, value }, i) => (
                <div key={name} className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: SECTOR_COLORS[i % SECTOR_COLORS.length] }} />
                  <span className="text-xs text-slate-400 truncate">{name}</span>
                  <span className="text-xs text-slate-300 tabular-nums ml-auto">{formatINR(value, true)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-2">
        {(["ALL", "NSE", "BSE"] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} className={cn("px-3 py-1.5 text-xs font-medium rounded-lg transition-colors", filter === f ? "bg-blue-600 text-white" : "bg-[#1A2236] text-slate-400 hover:text-slate-200 border border-[#1E293B]")}>
            {f}
          </button>
        ))}
      </div>

      {/* Stocks Table */}
      <div className="bg-[#1A2236] border border-[#1E293B] rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-[#1E293B]">
          <h2 className="text-sm font-semibold text-slate-200">Stocks ({stocks.length})</h2>
        </div>
        {isLoading ? (
          <div className="space-y-2 p-4">
            {[1,2,3].map(i => <div key={i} className="h-12 bg-[#0A0E1A] rounded-lg animate-pulse" />)}
          </div>
        ) : stocks.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-slate-400 text-sm mb-3">No stock holdings yet</p>
            <button onClick={() => setShowModal(true)} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-500 transition-colors">
              Add Transaction →
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-slate-500 border-b border-[#1E293B]">
                  {([
                    ["symbol","Symbol"], ["quantity","Qty"], ["avg_price","Avg Price"],
                    ["ltp","LTP"], ["invested","Invested"], ["currentValue","Value"], ["pnl","P&L ↕"]
                  ] as [SortKey, string][]).map(([key, label]) => (
                    <th key={key} onClick={() => handleSort(key)} className="px-4 py-2.5 text-left cursor-pointer hover:text-slate-300 transition-colors select-none">
                      <span className="flex items-center gap-1">{label} <SortIcon col={key} sortKey={sortKey} sortDir={sortDir} /></span>
                    </th>
                  ))}
                  <th className="px-4 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {stocks.map((h) => (
                  <tr key={h.id} className="border-b border-[#1E293B] last:border-0 hover:bg-[#1F2D45] transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-100">{h.symbol}</p>
                      <p className="text-xs text-slate-500 truncate max-w-[120px]">{h.name}</p>
                    </td>
                    <td className="px-4 py-3 tabular-nums text-slate-300">{h.quantity}</td>
                    <td className="px-4 py-3 tabular-nums text-slate-300">{formatINR(h.avg_price)}</td>
                    <td className="px-4 py-3 tabular-nums text-slate-200 font-medium">{h.ltp ? formatINR(h.ltp) : "—"}</td>
                    <td className="px-4 py-3 tabular-nums text-slate-300">{formatINR(h.invested ?? 0, true)}</td>
                    <td className="px-4 py-3 tabular-nums text-slate-200">{formatINR(h.currentValue ?? 0, true)}</td>
                    <td className="px-4 py-3 tabular-nums">
                      <p className={changeColor(h.pnl ?? 0)}>{formatINR(h.pnl ?? 0, true)}</p>
                      <p className={cn("text-xs", changeColor(h.pnlPct ?? 0))}>{formatPct(h.pnlPct ?? 0)}</p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => handleDelete(h)} className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-400/10 rounded transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MF Table */}
      {mfs.length > 0 && (
        <div className="bg-[#1A2236] border border-[#1E293B] rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-[#1E293B]">
            <h2 className="text-sm font-semibold text-slate-200">Mutual Funds ({mfs.length})</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-slate-500 border-b border-[#1E293B]">
                  <th className="px-4 py-2.5 text-left">Scheme</th>
                  <th className="px-4 py-2.5 text-left">Units</th>
                  <th className="px-4 py-2.5 text-left">Avg NAV</th>
                  <th className="px-4 py-2.5 text-left">Invested</th>
                  <th className="px-4 py-2.5 text-left">Value</th>
                  <th className="px-4 py-2.5 text-left">P&L</th>
                  <th className="px-4 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {mfs.map((h) => (
                  <tr key={h.id} className="border-b border-[#1E293B] last:border-0 hover:bg-[#1F2D45] transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-100 text-xs">{h.name}</p>
                      <p className="text-xs text-slate-500">{h.symbol}</p>
                    </td>
                    <td className="px-4 py-3 tabular-nums text-slate-300">{h.quantity.toFixed(3)}</td>
                    <td className="px-4 py-3 tabular-nums text-slate-300">{formatINR(h.avg_price)}</td>
                    <td className="px-4 py-3 tabular-nums text-slate-300">{formatINR(h.invested ?? 0, true)}</td>
                    <td className="px-4 py-3 tabular-nums text-slate-200">{formatINR(h.currentValue ?? h.invested ?? 0, true)}</td>
                    <td className="px-4 py-3 tabular-nums">
                      <p className={changeColor(h.pnl ?? 0)}>{formatINR(h.pnl ?? 0, true)}</p>
                      <p className={cn("text-xs", changeColor(h.pnlPct ?? 0))}>{formatPct(h.pnlPct ?? 0)}</p>
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => handleDelete(h)} className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-400/10 rounded transition-colors ml-auto flex">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Transaction Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1A2236] border border-[#1E293B] rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#1E293B]">
              <h2 className="text-base font-semibold text-slate-100">Add Transaction</h2>
              <button onClick={() => { setShowModal(false); reset(); setSelectedInstrument(null); }} className="text-slate-400 hover:text-slate-100">✕</button>
            </div>
            <form onSubmit={handleSubmit(onSubmit)} className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Instrument</label>
                {selectedInstrument ? (
                  <div className="flex items-center justify-between bg-[#0A0E1A] border border-[#1E293B] rounded-lg px-3 py-2.5">
                    <div>
                      <p className="text-sm font-semibold text-slate-100">{selectedInstrument.symbol}</p>
                      <p className="text-xs text-slate-400">{selectedInstrument.name}</p>
                    </div>
                    <button type="button" onClick={() => setSelectedInstrument(null)} className="text-slate-500 hover:text-slate-300 text-xs">Change</button>
                  </div>
                ) : (
                  <InstrumentSearch onSelect={setSelectedInstrument} placeholder="Search stock or MF..." />
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Type</label>
                  <select {...register("type")} className="w-full px-3 py-2.5 bg-[#0A0E1A] border border-[#1E293B] rounded-lg text-sm text-slate-100 focus:outline-none focus:border-blue-500">
                    <option value="BUY">BUY</option>
                    <option value="SELL">SELL</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Date</label>
                  <input {...register("transaction_date")} type="date" max={new Date().toISOString().split("T")[0]} className="w-full px-3 py-2.5 bg-[#0A0E1A] border border-[#1E293B] rounded-lg text-sm text-slate-100 focus:outline-none focus:border-blue-500" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Quantity</label>
                  <input {...register("quantity")} type="number" step="0.001" min="0.001" placeholder="0" className="w-full px-3 py-2.5 bg-[#0A0E1A] border border-[#1E293B] rounded-lg text-sm text-slate-100 focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Price (₹)</label>
                  <input {...register("price")} type="number" step="0.01" min="0" placeholder="0.00" className="w-full px-3 py-2.5 bg-[#0A0E1A] border border-[#1E293B] rounded-lg text-sm text-slate-100 focus:outline-none focus:border-blue-500" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Brokerage (₹)</label>
                <input {...register("brokerage")} type="number" step="0.01" min="0" defaultValue="0" className="w-full px-3 py-2.5 bg-[#0A0E1A] border border-[#1E293B] rounded-lg text-sm text-slate-100 focus:outline-none focus:border-blue-500" />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Notes (optional)</label>
                <input {...register("notes")} placeholder="Add a note..." className="w-full px-3 py-2.5 bg-[#0A0E1A] border border-[#1E293B] rounded-lg text-sm text-slate-100 focus:outline-none focus:border-blue-500" />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowModal(false); reset(); setSelectedInstrument(null); }} className="flex-1 py-2.5 bg-[#0A0E1A] border border-[#1E293B] text-slate-300 text-sm font-medium rounded-lg hover:bg-[#1F2D45] transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors">
                  {saving ? "Saving..." : "Save Transaction"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
