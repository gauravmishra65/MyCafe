import { useState } from "react";
import { useAuthStore } from "@/store/auth";
import { supabase } from "@/lib/supabase";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { User, Edit2 } from "lucide-react";
import toast from "react-hot-toast";
import type { Profile } from "@/types";

export default function ProfilePage() {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", user!.id).single();
      return data as Profile | null;
    },
    enabled: !!user,
  });

  const [fullName, setFullName] = useState(profile?.full_name ?? "");
  const [mobile, setMobile] = useState(profile?.mobile ?? "");
  const [broker, setBroker] = useState(profile?.broker ?? "");

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase.from("profiles").upsert({
      id: user!.id,
      full_name: fullName,
      mobile,
      broker,
      updated_at: new Date().toISOString(),
    });
    if (error) toast.error("Failed to save");
    else { toast.success("Profile updated"); await qc.invalidateQueries({ queryKey: ["profile"] }); setEditing(false); }
    setSaving(false);
  };

  return (
    <div className="p-4 lg:p-6 space-y-5 max-w-xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-100">Profile</h1>

      {/* Avatar */}
      <div className="flex flex-col items-center bg-[#1A2236] border border-[#1E293B] rounded-xl p-6">
        <div className="w-20 h-20 bg-blue-600 rounded-full flex items-center justify-center mb-3">
          <User className="w-10 h-10 text-white" />
        </div>
        <h2 className="text-lg font-bold text-slate-100">{profile?.full_name ?? user?.email}</h2>
        <p className="text-sm text-slate-400">{user?.email}</p>
        <p className="text-xs text-slate-500 mt-1">Member since {new Date(user?.created_at ?? "").toLocaleDateString("en-IN", { month: "long", year: "numeric" })}</p>
      </div>

      {/* Details */}
      <div className="bg-[#1A2236] border border-[#1E293B] rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-200">Personal Details</h2>
          {!editing && (
            <button onClick={() => setEditing(true)} className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300">
              <Edit2 className="w-3 h-3" /> Edit
            </button>
          )}
        </div>

        {editing ? (
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Full Name</label>
              <input value={fullName} onChange={e => setFullName(e.target.value)} className="w-full px-3 py-2 bg-[#0A0E1A] border border-[#1E293B] rounded-lg text-sm text-slate-100 focus:outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Mobile</label>
              <input value={mobile} onChange={e => setMobile(e.target.value)} placeholder="+91XXXXXXXXXX" className="w-full px-3 py-2 bg-[#0A0E1A] border border-[#1E293B] rounded-lg text-sm text-slate-100 focus:outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Broker</label>
              <input value={broker} onChange={e => setBroker(e.target.value)} placeholder="Zerodha, Groww, etc." className="w-full px-3 py-2 bg-[#0A0E1A] border border-[#1E293B] rounded-lg text-sm text-slate-100 focus:outline-none focus:border-blue-500" />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setEditing(false)} className="flex-1 py-2 bg-[#0A0E1A] border border-[#1E293B] text-slate-300 text-sm rounded-lg hover:bg-[#1F2D45] transition-colors">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50">
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {[
              { label: "Full Name", value: profile?.full_name ?? "—" },
              { label: "Mobile", value: profile?.mobile ?? "—" },
              { label: "Broker", value: profile?.broker ?? "—" },
              { label: "Risk Tolerance", value: profile?.risk_tolerance ?? "—" },
              { label: "Time Horizon", value: profile?.time_horizon ?? "—" },
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between items-center py-2 border-b border-[#1E293B] last:border-0">
                <span className="text-xs text-slate-500">{label}</span>
                <span className="text-sm text-slate-200">{value}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
