import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/auth";
import { InstrumentSearch } from "@/components/shared/InstrumentSearch";
import type { Alert, SearchResult } from "@/types";
import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";

const CONDITIONS = [
  { value: "price_above", label: "Price Above" },
  { value: "price_below", label: "Price Below" },
  { value: "change_pct_above", label: "% Change Above" },
  { value: "change_pct_below", label: "% Change Below" },
  { value: "volume_spike", label: "Volume Spike" },
  { value: "high_52w", label: "Near 52W High" },
  { value: "low_52w", label: "Near 52W Low" },
] as const;

export default function AlertsPage() {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [selectedInstrument, setSelectedInstrument] = useState<SearchResult | null>(null);
  const [condition, setCondition] = useState<Alert["condition"]>("price_above");
  const [threshold, setThreshold] = useState("");
  const [channel, setChannel] = useState<Alert["channel"]>("inapp");
  const [repeat, setRepeat] = useState(false);
  const [saving, setSaving] = useState(false);

  const { data: alerts = [], isLoading } = useQuery({
    queryKey: ["alerts"],
    queryFn: async () => {
      const { data } = await supabase.from("alerts").select("*").order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const handleCreate = async () => {
    if (!selectedInstrument || !threshold) { toast.error("Fill all fields"); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from("alerts").insert({
        user_id: user!.id,
        instrument_id: selectedInstrument.id,
        symbol: selectedInstrument.symbol,
        condition,
        threshold: parseFloat(threshold),
        channel,
        repeat_alert: repeat,
        is_active: true,
      });
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ["alerts"] });
      toast.success("Alert created");
      setShowForm(false);
      setSelectedInstrument(null);
      setThreshold("");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to create alert");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    await supabase.from("alerts").delete().eq("id", id);
    await qc.invalidateQueries({ queryKey: ["alerts"] });
    toast.success("Alert deleted");
  };

  const handleToggle = async (alert: Alert) => {
    await supabase.from("alerts").update({ is_active: !alert.is_active }).eq("id", alert.id);
    await qc.invalidateQueries({ queryKey: ["alerts"] });
  };

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className="w-5 h-5 text-yellow-400" />
          <h1 className="text-2xl font-bold text-slate-100">Price Alerts</h1>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" /> New Alert
        </button>
      </div>

      {/* Create Alert Form */}
      {showForm && (
        <div className="bg-[#1A2236] border border-[#1E293B] rounded-xl p-5 space-y-4">
          <h2 className="text-base font-semibold text-slate-200">Create Alert</h2>
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Instrument</label>
            {selectedInstrument ? (
              <div className="flex items-center justify-between bg-[#0A0E1A] border border-[#1E293B] rounded-lg px-3 py-2">
                <p className="text-sm font-semibold text-slate-100">{selectedInstrument.symbol} — {selectedInstrument.name}</p>
                <button onClick={() => setSelectedInstrument(null)} className="text-slate-500 text-xs hover:text-slate-300">Change</button>
              </div>
            ) : (
              <InstrumentSearch onSelect={setSelectedInstrument} placeholder="Search symbol..." />
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Condition</label>
              <select
                value={condition}
                onChange={e => setCondition(e.target.value as Alert["condition"])}
                className="w-full px-3 py-2.5 bg-[#0A0E1A] border border-[#1E293B] rounded-lg text-sm text-slate-100 focus:outline-none focus:border-blue-500"
              >
                {CONDITIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Threshold</label>
              <input
                type="number" step="0.01" value={threshold}
                onChange={e => setThreshold(e.target.value)}
                placeholder="Enter value"
                className="w-full px-3 py-2.5 bg-[#0A0E1A] border border-[#1E293B] rounded-lg text-sm text-slate-100 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Notify via</label>
              <select
                value={channel}
                onChange={e => setChannel(e.target.value as Alert["channel"])}
                className="w-full px-3 py-2.5 bg-[#0A0E1A] border border-[#1E293B] rounded-lg text-sm text-slate-100 focus:outline-none focus:border-blue-500"
              >
                <option value="inapp">In-App</option>
                <option value="email">Email</option>
                <option value="both">Both</option>
              </select>
            </div>
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer">
                <input type="checkbox" checked={repeat} onChange={e => setRepeat(e.target.checked)} className="rounded border-slate-600" />
                Repeat alert
              </label>
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setShowForm(false)} className="flex-1 py-2.5 bg-[#0A0E1A] border border-[#1E293B] text-slate-300 text-sm rounded-lg hover:bg-[#1F2D45] transition-colors">Cancel</button>
            <button onClick={handleCreate} disabled={saving} className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors">
              {saving ? "Creating..." : "Create Alert"}
            </button>
          </div>
        </div>
      )}

      {/* Alerts List */}
      <div className="bg-[#1A2236] border border-[#1E293B] rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="p-4 space-y-2">{[1,2,3].map(i => <div key={i} className="h-14 bg-[#0A0E1A] rounded animate-pulse" />)}</div>
        ) : alerts.length === 0 ? (
          <div className="text-center py-12">
            <Bell className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400 text-sm">No alerts set up yet</p>
          </div>
        ) : (
          <div>
            {alerts.map((a: Alert, i: number) => (
              <div key={a.id} className={cn("flex items-center gap-4 px-4 py-3 hover:bg-[#1F2D45] transition-colors", i < alerts.length - 1 && "border-b border-[#1E293B]")}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-100 text-sm">{a.symbol}</span>
                    <span className={cn("text-xs px-2 py-0.5 rounded-full", a.is_active ? "bg-emerald-500/20 text-emerald-400" : "bg-slate-500/20 text-slate-400")}>
                      {a.is_active ? "Active" : "Inactive"}
                    </span>
                    {a.triggered_at && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400">Triggered</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {CONDITIONS.find(c => c.value === a.condition)?.label} {a.threshold} · {a.channel}
                    {a.triggered_at && ` · ${formatDate(a.triggered_at)}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => handleToggle(a)} className={cn("p-1.5 rounded transition-colors", a.is_active ? "text-emerald-400 hover:bg-emerald-400/10" : "text-slate-500 hover:bg-slate-500/10")}>
                    <Bell className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => handleDelete(a.id)} className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-400/10 rounded transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
