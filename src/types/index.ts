export interface Stock {
  id: string;
  symbol: string;
  yahoo_symbol: string | null;
  name: string;
  exchange: string;
  sector: string | null;
  industry: string | null;
  cap_category: 'LARGE' | 'MID' | 'SMALL' | null;
  isin: string | null;
  market_cap: number | null;
  face_value: number | null;
  description: string | null;
  logo_url: string | null;
  created_at: string;
}

export interface MutualFund {
  id: string;
  scheme_code: string;
  name: string;
  amc: string | null;
  category: string | null;
  sub_category: string | null;
  risk_level: string | null;
  nav: number | null;
  nav_date: string | null;
  expense_ratio: number | null;
  aum: number | null;
  min_sip: number | null;
  min_lumpsum: number | null;
  fund_manager: string | null;
  isin_growth: string | null;
  isin_idcw: string | null;
  created_at: string;
}

export interface Profile {
  id: string;
  full_name: string | null;
  mobile: string | null;
  broker: string | null;
  risk_tolerance: string | null;
  time_horizon: string | null;
  monthly_surplus: number | null;
  preferences: Record<string, unknown>;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface PortfolioTransaction {
  id: string;
  user_id: string;
  stock_id: string | null;
  mf_id: string | null;
  instrument_type: 'STOCK' | 'MF';
  symbol: string;
  company_name: string;
  exchange: string | null;
  sector: string | null;
  type: 'BUY' | 'SELL' | 'SIP' | 'LUMPSUM' | 'REDEEM';
  quantity: number;
  price: number;
  amount: number;
  brokerage: number;
  transaction_date: string;
  broker: string | null;
  notes: string | null;
  created_at: string;
}

export interface PortfolioHolding {
  id: string;
  user_id: string;
  instrument_type: 'STOCK' | 'MF';
  instrument_id: string;
  symbol: string;
  name: string;
  exchange: string | null;
  sector: string | null;
  quantity: number;
  avg_price: number;
  invested: number | null;
  purchase_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // computed fields added by portfolioService
  ltp?: number;
  currentValue?: number;
  pnl?: number;
  pnlPct?: number;
  dayChange?: number;
  prevClose?: number;
}

export interface Watchlist {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
}

export interface WatchlistItem {
  id: string;
  watchlist_id: string;
  instrument_type: 'STOCK' | 'MF';
  instrument_id: string;
  symbol: string;
  company_name: string | null;
  exchange: string | null;
  alert_price: number | null;
  position: number;
  added_at: string;
  // live data
  ltp?: number;
  change?: number;
  changePct?: number;
  high52w?: number;
  low52w?: number;
}

export interface Alert {
  id: string;
  user_id: string;
  instrument_id: string;
  symbol: string;
  condition: 'price_above' | 'price_below' | 'change_pct_above' | 'change_pct_below' | 'volume_spike' | 'high_52w' | 'low_52w';
  threshold: number;
  channel: 'email' | 'inapp' | 'both';
  is_active: boolean;
  repeat_alert: boolean;
  triggered_at: string | null;
  created_at: string;
}

export interface MarketQuote {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePct: number;
  open: number;
  high: number;
  low: number;
  previousClose: number;
  volume: number;
  marketCap: number | null;
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
  currency: string;
  exchange: string;
  updatedAt: number;
}

export interface Candle {
  t: number;
  o: number | null;
  h: number | null;
  l: number | null;
  c: number | null;
  v: number | null;
}

export interface SearchResult {
  id: string;
  symbol: string;
  yahoo_symbol?: string | null;
  name: string;
  sector?: string | null;
  cap_category?: string | null;
  exchange?: string | null;
  isin?: string | null;
  // MF fields
  scheme_code?: string;
  amc?: string | null;
  category?: string | null;
  sub_category?: string | null;
  nav?: number | null;
  instrument_type: 'STOCK' | 'MF';
}

export interface PortfolioSummary {
  totalInvested: number;
  totalCurrentValue: number;
  totalPnl: number;
  totalPnlPct: number;
  totalDayChange: number;
}
