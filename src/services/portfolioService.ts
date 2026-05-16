import { supabase } from "@/lib/supabase";
import { marketApi } from "@/lib/api";
import type { PortfolioHolding, PortfolioSummary } from "@/types";
import { stockMetrics } from "@/lib/calculations";

export async function getPortfolioWithPrices(): Promise<{
  holdings: PortfolioHolding[];
  summary: PortfolioSummary;
}> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Not authenticated");

  const { data: holdings, error } = await supabase
    .from("portfolio_holdings")
    .select("*")
    .eq("user_id", session.user.id);

  if (error) throw error;
  if (!holdings || holdings.length === 0) {
    return {
      holdings: [],
      summary: { totalInvested: 0, totalCurrentValue: 0, totalPnl: 0, totalPnlPct: 0, totalDayChange: 0 },
    };
  }

  const stockHoldings = holdings.filter((h: PortfolioHolding) => h.instrument_type === "STOCK");
  const yahooSymbols = stockHoldings
    .map((h: PortfolioHolding) => {
      const suffix = h.exchange === "BSE" ? ".BO" : ".NS";
      return `${h.symbol}${suffix}`;
    })
    .filter(Boolean);

  let quotes: Record<string, { price: number; prevClose: number }> = {};
  if (yahooSymbols.length > 0) {
    const chunks = [];
    for (let i = 0; i < yahooSymbols.length; i += 20) chunks.push(yahooSymbols.slice(i, i + 20));
    for (const chunk of chunks) {
      try {
        const results = await marketApi.getQuotes(chunk);
        for (const q of results) {
          quotes[q.symbol] = { price: q.price, prevClose: q.previousClose };
        }
      } catch {
        // partial failure — continue
      }
    }
  }

  let totalInvested = 0, totalCurrentValue = 0, totalDayChange = 0;

  const enriched: PortfolioHolding[] = holdings.map((h: PortfolioHolding) => {
    if (h.instrument_type === "STOCK") {
      const suffix = h.exchange === "BSE" ? ".BO" : ".NS";
      const key = `${h.symbol}${suffix}`;
      const q = quotes[key];
      if (q) {
        const metrics = stockMetrics(h.quantity, h.avg_price, q.price, q.prevClose);
        totalInvested += metrics.invested;
        totalCurrentValue += metrics.currentValue;
        totalDayChange += metrics.dayChange;
        return { ...h, ltp: q.price, prevClose: q.prevClose, ...metrics };
      }
    }
    const invested = h.quantity * h.avg_price;
    totalInvested += invested;
    totalCurrentValue += invested;
    return { ...h, ltp: h.avg_price, currentValue: invested, pnl: 0, pnlPct: 0, dayChange: 0 };
  });

  const totalPnl = totalCurrentValue - totalInvested;
  const totalPnlPct = totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0;

  return {
    holdings: enriched,
    summary: { totalInvested, totalCurrentValue, totalPnl, totalPnlPct, totalDayChange },
  };
}

export async function addTransaction(tx: {
  instrument_type: "STOCK" | "MF";
  instrument_id: string;
  symbol: string;
  company_name: string;
  exchange?: string;
  sector?: string;
  type: "BUY" | "SELL" | "SIP" | "LUMPSUM" | "REDEEM";
  quantity: number;
  price: number;
  brokerage?: number;
  transaction_date: string;
  broker?: string;
  notes?: string;
}) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Not authenticated");

  const { error: txError } = await supabase.from("portfolio_transactions").insert({
    user_id: session.user.id,
    ...tx,
  });
  if (txError) throw txError;

  await recomputeHoldings(session.user.id, tx.instrument_id, tx.instrument_type, tx.symbol, tx.company_name, tx.exchange, tx.sector);
}

export async function recomputeHoldings(
  userId: string,
  instrumentId: string,
  instrumentType: "STOCK" | "MF",
  symbol: string,
  name: string,
  exchange?: string,
  sector?: string
) {
  const { data: txs, error } = await supabase
    .from("portfolio_transactions")
    .select("*")
    .eq("user_id", userId)
    .eq("symbol", symbol)
    .order("transaction_date", { ascending: true });

  if (error) throw error;

  let qty = 0, invested = 0, avgPrice = 0;
  for (const tx of txs ?? []) {
    if (tx.type === "BUY" || tx.type === "SIP" || tx.type === "LUMPSUM") {
      const newQty = qty + tx.quantity;
      avgPrice = newQty > 0 ? (qty * avgPrice + tx.quantity * tx.price) / newQty : tx.price;
      qty = newQty;
      invested += tx.quantity * tx.price;
    } else if (tx.type === "SELL" || tx.type === "REDEEM") {
      qty = Math.max(0, qty - tx.quantity);
      invested = qty * avgPrice;
    }
  }

  if (qty <= 0) {
    await supabase.from("portfolio_holdings").delete()
      .eq("user_id", userId).eq("instrument_id", instrumentId);
    return;
  }

  await supabase.from("portfolio_holdings").upsert({
    user_id: userId,
    instrument_type: instrumentType,
    instrument_id: instrumentId,
    symbol,
    name,
    exchange,
    sector,
    quantity: qty,
    avg_price: avgPrice,
    invested,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id,instrument_id" });
}
