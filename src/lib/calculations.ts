export interface HoldingMetrics {
  invested: number;
  currentValue: number;
  pnl: number;
  pnlPct: number;
  dayChange: number;
}

export function stockMetrics(qty: number, avgPrice: number, ltp: number, prevClose: number): HoldingMetrics {
  const invested = qty * avgPrice;
  const currentValue = qty * ltp;
  const pnl = currentValue - invested;
  const pnlPct = invested > 0 ? (pnl / invested) * 100 : 0;
  const dayChange = qty * (ltp - prevClose);
  return { invested, currentValue, pnl, pnlPct, dayChange };
}

export function fundMetrics(units: number, avgNav: number, currentNav: number): HoldingMetrics {
  const invested = units * avgNav;
  const currentValue = units * currentNav;
  const pnl = currentValue - invested;
  const pnlPct = invested > 0 ? (pnl / invested) * 100 : 0;
  return { invested, currentValue, pnl, pnlPct, dayChange: 0 };
}

export function aggregate(metrics: HoldingMetrics[]): HoldingMetrics {
  const invested = metrics.reduce((s, m) => s + m.invested, 0);
  const currentValue = metrics.reduce((s, m) => s + m.currentValue, 0);
  const pnl = currentValue - invested;
  const pnlPct = invested > 0 ? (pnl / invested) * 100 : 0;
  const dayChange = metrics.reduce((s, m) => s + (m.dayChange ?? 0), 0);
  return { invested, currentValue, pnl, pnlPct, dayChange };
}

export function absoluteReturn(current: number, invested: number): number {
  if (invested === 0) return 0;
  return ((current - invested) / invested) * 100;
}

export function cagr(endValue: number, startValue: number, years: number): number {
  if (startValue <= 0 || years <= 0) return 0;
  return (Math.pow(endValue / startValue, 1 / years) - 1) * 100;
}

export function xirr(cashflows: { amount: number; date: Date }[]): number {
  if (cashflows.length < 2) return 0;
  let rate = 0.1;
  for (let i = 0; i < 200; i++) {
    let npv = 0, dnpv = 0;
    const t0 = cashflows[0].date.getTime();
    for (const cf of cashflows) {
      const t = (cf.date.getTime() - t0) / (365.25 * 24 * 3600 * 1000);
      npv += cf.amount / Math.pow(1 + rate, t);
      dnpv += (-t * cf.amount) / Math.pow(1 + rate, t + 1);
    }
    const newRate = rate - npv / dnpv;
    if (Math.abs(newRate - rate) < 1e-7) return newRate * 100;
    rate = newRate;
  }
  return rate * 100;
}

export function weightedAvgPrice(existingQty: number, existingAvg: number, newQty: number, newPrice: number): number {
  const total = existingQty + newQty;
  if (total === 0) return 0;
  return (existingQty * existingAvg + newQty * newPrice) / total;
}
