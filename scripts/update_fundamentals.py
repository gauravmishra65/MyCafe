#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
MyCafe -- Stock Fundamentals Updater
=====================================
Fetches 52W high/low, P/E, EPS, dividend yield/rate/history from Yahoo Finance
and stores them in Supabase stock_fundamentals + stock_dividends tables.

Usage:
  python scripts/update_fundamentals.py              # update all NSE stocks (quick mode)
  python scripts/update_fundamentals.py --exchange BSE
  python scripts/update_fundamentals.py --symbols RELIANCE TCS INFY
  python scripts/update_fundamentals.py --full       # include ROE, D/E, analyst target
  python scripts/update_fundamentals.py --dividends  # include 5-year dividend history
  python scripts/update_fundamentals.py --full --dividends  # everything

Requires:
  pip install requests python-dotenv
"""

import argparse
import os
import sys
import time
import json
import requests
from datetime import datetime, date, timezone
from dotenv import load_dotenv

# ── Config ─────────────────────────────────────────────────────────────────

load_dotenv(".env.local")

SUPABASE_URL     = os.environ.get("VITE_SUPABASE_URL", "")
SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()

if not SUPABASE_URL or not SERVICE_ROLE_KEY:
    sys.exit(
        "ERROR: VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local\n"
        "  Get service_role key from: Supabase Dashboard -> Settings -> API"
    )

DB_HEADERS = {
    "apikey": SERVICE_ROLE_KEY,
    "Authorization": f"Bearer {SERVICE_ROLE_KEY}",
    "Content-Type": "application/json",
}

YF_SESSION = requests.Session()
YF_SESSION.headers.update({
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
})

CRUMB: str | None = None
QUOTE_BATCH  = 20    # symbols per Yahoo Finance quote request
DETAIL_DELAY = 1.2   # seconds between quoteSummary calls (rate limit)
BATCH_DELAY  = 0.4   # seconds between quote batch calls

# ── Yahoo Finance auth ──────────────────────────────────────────────────────

def init_yf() -> bool:
    """Cookie + crumb handshake required by Yahoo Finance."""
    global CRUMB
    try:
        print("  Initialising Yahoo Finance session...")
        YF_SESSION.get("https://fc.yahoo.com", timeout=10)
        time.sleep(0.5)
        r = YF_SESSION.get(
            "https://query2.finance.yahoo.com/v1/test/getcrumb",
            timeout=10
        )
        if r.status_code == 200 and r.text.strip():
            CRUMB = r.text.strip()
            print(f"  Crumb: {CRUMB[:12]}...")
            return True
        print(f"  [WARN] crumb fetch returned {r.status_code}")
        return False
    except Exception as e:
        print(f"  [ERROR] Yahoo Finance init failed: {e}")
        return False

def yf_get(url: str, params: dict = {}, retries: int = 3) -> dict | None:
    if CRUMB:
        params = {**params, "crumb": CRUMB}
    for attempt in range(retries):
        try:
            r = YF_SESSION.get(url, params=params, timeout=20)
            if r.status_code == 200:
                return r.json()
            if r.status_code == 429:
                wait = 30 * (attempt + 1)
                print(f"\n  [RATE LIMIT] waiting {wait}s...")
                time.sleep(wait)
                continue
            if r.status_code == 401:
                print("\n  [AUTH] Re-initialising session...")
                init_yf()
                continue
            return None
        except Exception as e:
            if attempt == retries - 1:
                print(f"\n  [ERROR] {e}")
            time.sleep(2)
    return None

# ── Fetch helpers ───────────────────────────────────────────────────────────

def fetch_quotes_batch(yahoo_symbols: list[str]) -> dict[str, dict]:
    """Batch fetch basic quote data for up to 20 symbols. Returns {symbol: fields}."""
    joined = ",".join(yahoo_symbols)
    data = yf_get(
        "https://query1.finance.yahoo.com/v7/finance/quote",
        {"symbols": joined, "fields": (
            "symbol,regularMarketPrice,fiftyTwoWeekHigh,fiftyTwoWeekLow,"
            "trailingPE,forwardPE,priceToBook,epsTrailingTwelveMonths,"
            "epsForward,trailingAnnualDividendYield,trailingAnnualDividendRate,"
            "dividendDate,marketCap,beta"
        )},
    )
    result = {}
    if data:
        for q in data.get("quoteResponse", {}).get("result", []):
            result[q.get("symbol", "")] = q
    return result

def fetch_quote_summary(yahoo_symbol: str) -> dict | None:
    """Fetch detailed fundamentals (ROE, D/E, analyst, last dividend, etc.)."""
    modules = "defaultKeyStatistics,summaryDetail,financialData"
    data = yf_get(
        f"https://query2.finance.yahoo.com/v10/finance/quoteSummary/{yahoo_symbol}",
        {"modules": modules},
    )
    if not data:
        return None
    results = data.get("quoteSummary", {}).get("result", [])
    return results[0] if results else None

def fetch_dividend_history(yahoo_symbol: str) -> list[dict]:
    """Fetch 5-year dividend history."""
    data = yf_get(
        f"https://query1.finance.yahoo.com/v8/finance/chart/{yahoo_symbol}",
        {"interval": "1d", "range": "5y", "events": "dividends"},
    )
    if not data:
        return []
    events = (
        data.get("chart", {})
            .get("result", [{}])[0]
            .get("events", {})
            .get("dividends", {})
    )
    history = []
    for ts, div in events.items():
        ex_date = datetime.fromtimestamp(int(ts)).date()
        history.append({
            "ex_date": ex_date.isoformat(),
            "amount":  round(div.get("amount", 0), 4),
        })
    return sorted(history, key=lambda x: x["ex_date"], reverse=True)

# ── Field extractors ────────────────────────────────────────────────────────

def _raw(module: dict, key: str) -> float | None:
    v = module.get(key, {})
    if isinstance(v, dict):
        return v.get("raw")
    if isinstance(v, (int, float)):
        return float(v)
    return None

def _date(module: dict, key: str) -> str | None:
    v = module.get(key, {})
    if isinstance(v, dict):
        ts = v.get("raw")
        if ts:
            return datetime.fromtimestamp(ts).date().isoformat()
    return None

# All columns that must be present in every record sent to PostgREST.
# PGRST102 fires when records in the same batch have different key sets.
_FUNDAMENTAL_KEYS = (
    "symbol", "exchange", "week52_high", "week52_low", "week52_range_pct",
    "pe_ratio", "forward_pe", "pb_ratio", "eps", "eps_forward",
    "dividend_yield", "dividend_rate", "ex_dividend_date",
    "last_dividend_value", "last_dividend_date",
    "market_cap", "beta", "roe", "debt_to_equity",
    "revenue", "net_income", "analyst_target", "recommendation",
    "fetched_at",
)

def build_fundamental(
    symbol: str,
    exchange: str,
    quote: dict,
    summary: dict | None = None,
) -> dict:
    price = quote.get("regularMarketPrice")
    w52h  = quote.get("fiftyTwoWeekHigh")
    w52l  = quote.get("fiftyTwoWeekLow")
    range_pct = None
    if price and w52h and w52l and (w52h - w52l) > 0:
        range_pct = round((price - w52l) / (w52h - w52l) * 100, 2)

    dy_raw = quote.get("trailingAnnualDividendYield")

    # ex-dividend date from quote (Unix timestamp)
    dd = quote.get("dividendDate")
    ex_div_date = datetime.fromtimestamp(dd).date().isoformat() if dd else None

    rec: dict = {
        "symbol":             symbol,
        "exchange":           exchange,
        "week52_high":        w52h,
        "week52_low":         w52l,
        "week52_range_pct":   range_pct,
        "pe_ratio":           quote.get("trailingPE"),
        "forward_pe":         quote.get("forwardPE"),
        "pb_ratio":           quote.get("priceToBook"),
        "eps":                quote.get("epsTrailingTwelveMonths"),
        "eps_forward":        quote.get("epsForward"),
        "dividend_yield":     round(dy_raw * 100, 4) if dy_raw else None,
        "dividend_rate":      quote.get("trailingAnnualDividendRate"),
        "ex_dividend_date":   ex_div_date,
        "last_dividend_value": None,
        "last_dividend_date":  None,
        "market_cap":         quote.get("marketCap"),
        "beta":               quote.get("beta"),
        "roe":                None,
        "debt_to_equity":     None,
        "revenue":            None,
        "net_income":         None,
        "analyst_target":     None,
        "recommendation":     None,
        "fetched_at":         datetime.now(timezone.utc).isoformat(),
    }

    if summary:
        ks = summary.get("defaultKeyStatistics", {})
        sd = summary.get("summaryDetail", {})
        fd = summary.get("financialData", {})

        rec["pb_ratio"]   = rec["pb_ratio"] or _raw(ks, "priceToBook")
        rec["forward_pe"] = rec["forward_pe"] or _raw(sd, "forwardPE")

        roe_raw = _raw(fd, "returnOnEquity")
        rec["roe"]             = round(roe_raw * 100, 2) if roe_raw else None
        rec["debt_to_equity"]  = _raw(fd, "debtToEquity")
        rec["revenue"]         = _raw(fd, "totalRevenue")
        rec["net_income"]      = _raw(fd, "netIncomeToCommon")
        rec["analyst_target"]  = _raw(fd, "targetMeanPrice")

        rk = fd.get("recommendationKey")
        rec["recommendation"] = rk.get("raw") if isinstance(rk, dict) else rk

        rec["last_dividend_value"] = _raw(ks, "lastDividendValue")
        rec["last_dividend_date"]  = _date(ks, "lastDividendDate")
        if not rec["ex_dividend_date"]:
            rec["ex_dividend_date"] = _date(sd, "exDividendDate")

    # Guarantee every key is present (PostgREST PGRST102 requires uniform keys per batch)
    return {k: rec.get(k) for k in _FUNDAMENTAL_KEYS}

# ── Supabase write ──────────────────────────────────────────────────────────

def upsert_fundamentals(records: list[dict]) -> int:
    if not records:
        return 0
    r = requests.post(
        f"{SUPABASE_URL}/rest/v1/stock_fundamentals",
        json=records,
        headers={**DB_HEADERS, "Prefer": "resolution=merge-duplicates"},
        params={"on_conflict": "symbol,exchange"},
        timeout=30,
    )
    if r.status_code not in (200, 201):
        print(f"\n  [DB ERROR] {r.status_code}: {r.text[:200]}")
        return 0
    return len(records)

def upsert_dividends(records: list[dict]) -> int:
    if not records:
        return 0
    r = requests.post(
        f"{SUPABASE_URL}/rest/v1/stock_dividends",
        json=records,
        headers={**DB_HEADERS, "Prefer": "resolution=merge-duplicates"},
        params={"on_conflict": "symbol,exchange,ex_date"},
        timeout=30,
    )
    if r.status_code not in (200, 201):
        print(f"\n  [DB ERROR dividends] {r.status_code}: {r.text[:200]}")
        return 0
    return len(records)

# ── Load symbols from DB ────────────────────────────────────────────────────

def load_symbols(exchange: str | None, specific: list[str] | None) -> list[tuple[str, str]]:
    """Returns list of (symbol, exchange) tuples. Paginates to get all rows."""
    url = f"{SUPABASE_URL}/rest/v1/stocks"
    all_rows: list[dict] = []
    page_size = 1000
    offset = 0

    while True:
        params: dict = {
            "select": "symbol,exchange",
            "is_active": "eq.true",
            "limit": page_size,
            "offset": offset,
            "order": "symbol.asc",
        }
        if exchange:
            params["exchange"] = f"eq.{exchange}"
        r = requests.get(url, headers=DB_HEADERS, params=params, timeout=30)
        if r.status_code != 200:
            sys.exit(f"ERROR loading symbols: {r.status_code} {r.text[:200]}")
        page = r.json()
        all_rows.extend(page)
        if len(page) < page_size:
            break
        offset += page_size

    if specific:
        specific_upper = [s.upper() for s in specific]
        all_rows = [row for row in all_rows if row["symbol"].upper() in specific_upper]
    return [(row["symbol"], row["exchange"]) for row in all_rows]

# ── Main ────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Update stock fundamentals from Yahoo Finance")
    parser.add_argument("--exchange",  choices=["NSE", "BSE"], help="Filter by exchange")
    parser.add_argument("--symbols",   nargs="+", help="Specific symbols to update")
    parser.add_argument("--full",      action="store_true", help="Include ROE, D/E, analyst target (slower)")
    parser.add_argument("--dividends", action="store_true", help="Include 5-year dividend history")
    parser.add_argument("--limit",     type=int, help="Max stocks to process (for testing)")
    args = parser.parse_args()

    print(f"Supabase: {SUPABASE_URL}")
    print(f"Mode: {'full' if args.full else 'quick'}" +
          (" + dividends" if args.dividends else ""))

    # 1. Load symbol list
    symbols = load_symbols(args.exchange, args.symbols)
    if args.limit:
        symbols = symbols[:args.limit]
    print(f"Symbols to update: {len(symbols)}")
    if not symbols:
        print("Nothing to do.")
        return

    # 2. Init Yahoo Finance
    if not init_yf():
        print("[WARN] Yahoo Finance init failed, some data may be missing")

    start = time.time()
    total_stocks = 0
    total_divs   = 0
    errors       = 0

    # 3. Process in batches
    # Group by exchange for correct Yahoo suffix
    nse_syms = [(s, e) for s, e in symbols if e == "NSE"]
    bse_syms = [(s, e) for s, e in symbols if e == "BSE"]

    def yahoo_sym(symbol: str, exchange: str) -> str:
        return f"{symbol}.NS" if exchange == "NSE" else f"{symbol}.BO"

    def process_group(group: list[tuple[str, str]]):
        nonlocal total_stocks, total_divs, errors

        for i in range(0, len(group), QUOTE_BATCH):
            batch = group[i:i + QUOTE_BATCH]
            yahoo_batch = [yahoo_sym(s, e) for s, e in batch]

            # Batch quote fetch
            quotes = fetch_quotes_batch(yahoo_batch)
            time.sleep(BATCH_DELAY)

            fundamentals_batch = []
            for symbol, exchange in batch:
                ysym  = yahoo_sym(symbol, exchange)
                quote = quotes.get(ysym, {})
                if not quote:
                    errors += 1
                    continue

                if args.full:
                    summary = fetch_quote_summary(ysym)
                    time.sleep(DETAIL_DELAY)
                else:
                    summary = None

                rec = build_fundamental(symbol, exchange, quote, summary)
                fundamentals_batch.append(rec)

                # Dividend history (per symbol, slower)
                if args.dividends:
                    history = fetch_dividend_history(ysym)
                    div_records = [
                        {"symbol": symbol, "exchange": exchange, **d}
                        for d in history
                    ]
                    if div_records:
                        total_divs += upsert_dividends(div_records)
                    time.sleep(BATCH_DELAY)

            if fundamentals_batch:
                total_stocks += upsert_fundamentals(fundamentals_batch)

            done = i + len(batch)
            elapsed = time.time() - start
            rate = done / elapsed if elapsed > 0 else 0
            eta = int((len(group) - done) / rate) if rate > 0 else 0
            print(f"  [{exchange}] {done}/{len(group)} processed "
                  f"| {total_stocks} saved | ETA {eta}s  ", end="\r")

        print()

    if nse_syms:
        print(f"\nProcessing {len(nse_syms)} NSE stocks...")
        process_group(nse_syms)

    if bse_syms:
        print(f"\nProcessing {len(bse_syms)} BSE stocks...")
        process_group(bse_syms)

    elapsed = time.time() - start
    print(f"\nDone in {elapsed:.0f}s")
    print(f"  Fundamentals updated: {total_stocks}")
    if args.dividends:
        print(f"  Dividend records:     {total_divs}")
    if errors:
        print(f"  Skipped (no data):    {errors}")

if __name__ == "__main__":
    main()
