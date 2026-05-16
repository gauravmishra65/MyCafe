import { useState } from "react";
import { useAuthStore } from "@/store/auth";
import { useThemeStore } from "@/store/theme";
import { supabase } from "@/lib/supabase";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Sun, Moon, User, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";
import type { Profile } from "@/types";

export default function SettingsPage() {
  const { user } = useAuthStore();
  const { theme, toggleTheme } = useThemeStore();
  const qc = useQueryClient();

  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", user!.id).single();
      return data as Profile | null;
    },
    enabled: !!user,
  });

  const [riskTolerance, setRiskTolerance] = useState(profile?.risk_tolerance ?? "Moderate");
  const [timeHorizon, setTimeHorizon] = useState(profile?.time_horizon ?? "Long");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase.from("profiles").upsert({
      id: user!.id,
      risk_tolerance: riskTolerance,
      time_horizon: timeHorizon,
      updated_at: new Date().toISOString(),
    });
    if (error) toast.error("Failed to save");
    else { toast.success("Settings saved"); await qc.invalidateQueries({ queryKey: ["profile"] }); }
    setSaving(false);
  };

  return (
    <div className="p-4 lg:p-6 space-y-5 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-100">Settings</h1>

      {/* Appearance */}
      <div className="bg-[#1A2236] border border-[#1E293B] rounded-xl p-5 space-y-4">
        <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2"><Sun className="w-4 h-4" /> Appearance</h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-200">Theme</p>
            <p className="text-xs text-slate-500">Choose light or dark mode</p>
          </div>
          <button
            onClick={toggleTheme}
            className={cn("flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors",
              theme === "dark" ? "bg-[#0A0E1A] border-[#1E293B] text-slate-200 hover:bg-[#1F2D45]" : "bg-slate-100 border-slate-200 text-slate-800"
            )}
          >
            {theme === "dark" ? <><Moon className="w-4 h-4" /> Dark</> : <><Sun className="w-4 h-4" /> Light</>}
          </button>
        </div>
      </div>

      {/* Investment Profile */}
      <div className="bg-[#1A2236] border border-[#1E293B] rounded-xl p-5 space-y-4">
        <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2"><User className="w-4 h-4" /> Investment Profile</h2>
        <div>
          <label className="block text-xs text-slate-400 mb-1.5">Risk Tolerance</label>
          <div className="flex gap-2">
            {["Conservative","Moderate","Aggressive"].map(r => (
              <button key={r} onClick={() => setRiskTolerance(r)} className={cn("flex-1 py-2 text-xs font-medium rounded-lg transition-colors", riskTolerance === r ? "bg-blue-600 text-white" : "bg-[#0A0E1A] border border-[#1E293B] text-slate-400 hover:text-slate-200")}>
                {r}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1.5">Investment Horizon</label>
          <div className="flex gap-2">
            {["Short","Medium","Long"].map(h => (
              <button key={h} onClick={() => setTimeHorizon(h)} className={cn("flex-1 py-2 text-xs font-medium rounded-lg transition-colors", timeHorizon === h ? "bg-blue-600 text-white" : "bg-[#0A0E1A] border border-[#1E293B] text-slate-400 hover:text-slate-200")}>
                {h}
              </button>
            ))}
          </div>
        </div>
        <button onClick={handleSave} disabled={saving} className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors">
          {saving ? "Saving..." : "Save Settings"}
        </button>
      </div>

      {/* Security */}
      <div className="bg-[#1A2236] border border-[#1E293B] rounded-xl p-5 space-y-3">
        <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2"><Shield className="w-4 h-4" /> Security</h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-200">Email</p>
            <p className="text-xs text-slate-500">{user?.email}</p>
          </div>
        </div>
        <button
          onClick={async () => {
            await supabase.auth.resetPasswordForEmail(user!.email!, { redirectTo: `${window.location.origin}/reset-password` });
            toast.success("Password reset email sent");
          }}
          className="px-4 py-2 text-sm bg-[#0A0E1A] border border-[#1E293B] text-slate-300 rounded-lg hover:bg-[#1F2D45] transition-colors"
        >
          Change Password
        </button>
      </div>
    </div>
  );
}
