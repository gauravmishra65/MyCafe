export function formatINR(value: number, compact = false): string {
  if (isNaN(value)) return "—";
  if (compact) {
    const abs = Math.abs(value);
    if (abs >= 10_000_000) return `₹${(value / 10_000_000).toFixed(2)} Cr`;
    if (abs >= 100_000) return `₹${(value / 100_000).toFixed(2)} L`;
    if (abs >= 1_000) return `₹${(value / 1_000).toFixed(2)} K`;
  }
  return new Intl.NumberFormat("en-IN", {
    style: "currency", currency: "INR", maximumFractionDigits: 2
  }).format(value);
}

export function formatPct(value: number): string {
  if (isNaN(value)) return "—";
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

export function changeColor(value: number): string {
  if (value > 0) return "text-emerald-500 dark:text-emerald-400";
  if (value < 0) return "text-red-500 dark:text-red-400";
  return "text-slate-500";
}

export function changeBg(value: number): string {
  if (value > 0) return "bg-emerald-500/10 text-emerald-500";
  if (value < 0) return "bg-red-500/10 text-red-500";
  return "bg-slate-500/10 text-slate-500";
}

export function formatVolume(vol: number): string {
  if (!vol) return "—";
  if (vol >= 10_000_000) return `${(vol / 10_000_000).toFixed(2)} Cr`;
  if (vol >= 100_000) return `${(vol / 100_000).toFixed(2)} L`;
  if (vol >= 1_000) return `${(vol / 1_000).toFixed(2)} K`;
  return vol.toString();
}

export function formatMarketCap(cap: number | null): string {
  if (!cap) return "—";
  return formatINR(cap, true);
}

export function exportToCsv(rows: Record<string, unknown>[], filename: string): void {
  if (!rows.length) return;
  const keys = Object.keys(rows[0]);
  const csv = [keys.join(","), ...rows.map(r => keys.map(k => JSON.stringify(r[k] ?? "")).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}
