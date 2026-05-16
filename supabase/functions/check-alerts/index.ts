import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = { "Access-Control-Allow-Origin": "*" };

function isMarketHours(): boolean {
  const now = new Date();
  const ist = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  const day = ist.getDay();
  if (day === 0 || day === 6) return false;
  const mins = ist.getHours() * 60 + ist.getMinutes();
  return mins >= 9 * 60 + 15 && mins <= 15 * 60 + 30;
}

Deno.serve(async (_req: Request) => {
  if (!isMarketHours()) {
    return Response.json({ message: "Market closed" }, { headers: CORS });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data: alerts } = await supabase
    .from("alerts")
    .select("*")
    .eq("is_active", true)
    .is("triggered_at", null);

  if (!alerts?.length) return Response.json({ message: "No active alerts" }, { headers: CORS });

  // Group by symbol to batch fetch prices
  const symbols = [...new Set(alerts.map((a: Record<string, string>) => a.symbol))];

  // Fetch quotes for all symbols
  const marketUrl = Deno.env.get("SUPABASE_URL") + "/functions/v1/market-data";
  let quotes: Record<string, { price: number; changePct: number; volume: number; high52w: number; low52w: number }> = {};

  try {
    const res = await fetch(`${marketUrl}?action=quotes&symbols=${symbols.join(",")}`, {
      headers: { Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` }
    });
    const data = await res.json() as Array<Record<string, unknown>>;
    for (const q of data) {
      quotes[q.symbol as string] = {
        price: q.price as number,
        changePct: q.changePct as number,
        volume: q.volume as number,
        high52w: q.fiftyTwoWeekHigh as number,
        low52w: q.fiftyTwoWeekLow as number,
      };
    }
  } catch {
    return Response.json({ error: "Failed to fetch quotes" }, { status: 500, headers: CORS });
  }

  let triggered = 0;
  for (const alert of alerts) {
    const q = quotes[alert.symbol];
    if (!q) continue;

    let fire = false;
    switch (alert.condition) {
      case "price_above": fire = q.price >= alert.threshold; break;
      case "price_below": fire = q.price <= alert.threshold; break;
      case "change_pct_above": fire = q.changePct >= alert.threshold; break;
      case "change_pct_below": fire = q.changePct <= alert.threshold; break;
      case "volume_spike": fire = q.volume >= alert.threshold; break;
      case "high_52w": fire = q.price >= (q.high52w * 0.98); break;
      case "low_52w": fire = q.price <= (q.low52w * 1.02); break;
    }

    if (fire) {
      await supabase.from("alerts").update({
        triggered_at: new Date().toISOString(),
        is_active: alert.repeat_alert,
      }).eq("id", alert.id);
      triggered++;
    }
  }

  return Response.json({ checked: alerts.length, triggered }, { headers: CORS });
});
