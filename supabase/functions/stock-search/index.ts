import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  const url = new URL(req.url);
  const q = url.searchParams.get("q") ?? "";
  const type = url.searchParams.get("type") ?? "stock";

  if (!q || q.length < 1) return Response.json([], { headers: CORS });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const term = q.trim().toUpperCase();

  if (type === "mf") {
    const { data } = await supabase
      .from("mutual_funds")
      .select("id, scheme_code, name, amc, category, sub_category, nav")
      .ilike("name", `%${term}%`)
      .limit(20);
    const results = (data ?? []).map((r: Record<string, unknown>) => ({ ...r, instrument_type: "MF" }));
    return Response.json(results, { headers: CORS });
  }

  // Stocks: exact match first, then prefix, then fuzzy name
  const [{ data: exact }, { data: prefix }, { data: fuzzy }] = await Promise.all([
    supabase
      .from("stocks")
      .select("id, symbol, yahoo_symbol, name, sector, cap_category, exchange, isin")
      .eq("symbol", term)
      .limit(5),
    supabase
      .from("stocks")
      .select("id, symbol, yahoo_symbol, name, sector, cap_category, exchange, isin")
      .ilike("symbol", `${term}%`)
      .neq("symbol", term)
      .limit(15),
    supabase
      .from("stocks")
      .select("id, symbol, yahoo_symbol, name, sector, cap_category, exchange, isin")
      .ilike("name", `%${term}%`)
      .limit(20),
  ]);

  const seen = new Set<string>();
  const combined = [...(exact ?? []), ...(prefix ?? []), ...(fuzzy ?? [])]
    .filter((r) => {
      if (seen.has(r.id)) return false;
      seen.add(r.id);
      return true;
    })
    .slice(0, 30)
    .map((r) => ({ ...r, instrument_type: "STOCK" }));

  return Response.json(combined, { headers: CORS });
});
