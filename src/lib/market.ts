export function calcSMA(closes: number[], period: number): number[] {
  const result: number[] = new Array(closes.length).fill(NaN);
  for (let i = period - 1; i < closes.length; i++) {
    result[i] = closes.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0) / period;
  }
  return result;
}

export function calcRSI(closes: number[], period = 14): number[] {
  const result: number[] = new Array(closes.length).fill(NaN);
  if (closes.length < period + 1) return result;
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) gains += diff; else losses -= diff;
  }
  let avgGain = gains / period, avgLoss = losses / period;
  result[period] = 100 - 100 / (1 + avgGain / (avgLoss || 1));
  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + Math.max(diff, 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-diff, 0)) / period;
    result[i] = 100 - 100 / (1 + avgGain / (avgLoss || 1));
  }
  return result;
}

export function calcEMA(closes: number[], period: number): number[] {
  const result: number[] = new Array(closes.length).fill(NaN);
  const k = 2 / (period + 1);
  let ema = closes.slice(0, period).reduce((a, b) => a + b, 0) / period;
  result[period - 1] = ema;
  for (let i = period; i < closes.length; i++) {
    ema = closes[i] * k + ema * (1 - k);
    result[i] = ema;
  }
  return result;
}

export function calcMACD(closes: number[]): { macd: number[]; signal: number[]; histogram: number[] } {
  const ema12 = calcEMA(closes, 12);
  const ema26 = calcEMA(closes, 26);
  const macd = closes.map((_, i) => (isNaN(ema12[i]) || isNaN(ema26[i])) ? NaN : ema12[i] - ema26[i]);
  const validMacd = macd.filter(v => !isNaN(v));
  const rawSignal = calcEMA(validMacd, 9);
  const signal: number[] = new Array(closes.length).fill(NaN);
  let vi = 0;
  for (let i = 0; i < closes.length; i++) {
    if (!isNaN(macd[i])) { signal[i] = rawSignal[vi++] ?? NaN; }
  }
  const histogram = closes.map((_, i) => (isNaN(macd[i]) || isNaN(signal[i])) ? NaN : macd[i] - signal[i]);
  return { macd, signal, histogram };
}

export function calcBollingerBands(closes: number[], period = 20, mult = 2): { upper: number[]; middle: number[]; lower: number[] } {
  const middle = calcSMA(closes, period);
  const upper: number[] = new Array(closes.length).fill(NaN);
  const lower: number[] = new Array(closes.length).fill(NaN);
  for (let i = period - 1; i < closes.length; i++) {
    const slice = closes.slice(i - period + 1, i + 1);
    const mean = middle[i];
    const std = Math.sqrt(slice.reduce((s, v) => s + (v - mean) ** 2, 0) / period);
    upper[i] = mean + mult * std;
    lower[i] = mean - mult * std;
  }
  return { upper, middle, lower };
}

export function calcLinearRegression(closes: number[], days = 14): { slope: number; intercept: number; target: number; confidence: number } {
  const n = Math.min(days, closes.length);
  const slice = closes.slice(-n);
  const xs = Array.from({ length: n }, (_, i) => i);
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = slice.reduce((a, b) => a + b, 0) / n;
  const slope = xs.reduce((s, x, i) => s + (x - meanX) * (slice[i] - meanY), 0) /
    xs.reduce((s, x) => s + (x - meanX) ** 2, 0);
  const intercept = meanY - slope * meanX;
  const target = slope * n + intercept;
  const ssRes = slice.reduce((s, y, i) => s + (y - (slope * xs[i] + intercept)) ** 2, 0);
  const ssTot = slice.reduce((s, y) => s + (y - meanY) ** 2, 0);
  const confidence = ssTot > 0 ? Math.max(0, 1 - ssRes / ssTot) : 0;
  return { slope, intercept, target, confidence };
}
