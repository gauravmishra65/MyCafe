#!/usr/bin/env python3
"""
MyCafe — Full NSE + BSE + Mutual Fund data migration
=====================================================
Fetches live data from official sources and upserts into Supabase.

Sources:
  NSE stocks  : https://archives.nseindia.com/content/equities/EQUITY_L.csv
  NSE indices : archives.nseindia.com — NIFTY 50/Next50/Midcap150/Smallcap250/500
  BSE stocks  : https://api.bseindia.com/BseIndiaAPI/api/ListofScripData/w
  Mutual funds: https://www.amfiindia.com/spages/NAVAll.txt

Usage:
  pip install requests python-dotenv
  python scripts/migrate_market_data.py [--nse] [--bse] [--mf] [--all]

Without flags, runs --all.
"""

import argparse
import io
import os
import sys
import time
import csv
import json
import requests
from datetime import datetime
from dotenv import load_dotenv

load_dotenv(".env.local")

SUPABASE_URL = os.environ.get("VITE_SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("VITE_SUPABASE_ANON_KEY", "")

if not SUPABASE_URL or not SUPABASE_KEY:
    sys.exit("ERROR: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set in .env.local")

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
}

NSE_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
    "Referer": "https://www.nseindia.com/",
}

BSE_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Referer": "https://www.bseindia.com/",
    "Accept": "application/json, text/plain, */*",
}

BATCH = 500

# ── Sector normalisation ────────────────────────────────────────────────────

SECTOR_MAP = {
    "AUTOMOBILE AND AUTO COMPONENTS": "Automobile",
    "AUTOMOBILE":                     "Automobile",
    "AUTO":                           "Automobile",
    "CAPITAL GOODS":                  "Capital Goods",
    "CHEMICALS":                      "Chemicals",
    "CONSTRUCTION":                   "Construction",
    "CONSTRUCTION MATERIALS":         "Construction Materials",
    "CEMENT":                         "Construction Materials",
    "CONSUMER DURABLES":              "Consumer Durables",
    "CONSUMER SERVICES":              "Consumer Services",
    "DIVERSIFIED":                    "Conglomerate",
    "CONGLOMERATE":                   "Conglomerate",
    "FAST MOVING CONSUMER GOODS":     "FMCG",
    "FMCG":                           "FMCG",
    "FINANCIAL SERVICES":             "Financial Services",
    "BANKS":                          "Financial Services",
    "FINANCE":                        "Financial Services",
    "INSURANCE":                      "Financial Services",
    "HEALTHCARE":                     "Healthcare",
    "PHARMA":                         "Healthcare",
    "INFORMATION TECHNOLOGY":         "Information Technology",
    "IT":                             "Information Technology",
    "SOFTWARE":                       "Information Technology",
    "MEDIA ENTERTAINMENT & PUBLICATION": "Media",
    "MEDIA":                          "Media",
    "METALS & MINING":                "Metals & Mining",
    "METALS":                         "Metals & Mining",
    "MINING":                         "Metals & Mining",
    "OIL GAS & CONSUMABLE FUELS":     "Oil & Gas",
    "OIL & GAS":                      "Oil & Gas",
    "ENERGY":                         "Oil & Gas",
    "POWER":                          "Power",
    "REALTY":                         "Real Estate",
    "REAL ESTATE":                    "Real Estate",
    "SERVICES":                       "Services",
    "TELECOMMUNICATION":              "Telecommunication",
    "TELECOM":                        "Telecommunication",
    "TEXTILES":                       "Textiles",
    "UTILITIES":                      "Utilities",
    "FOREST MATERIALS":               "Forest Materials",
    "INFRASTRUCTURE":                 "Infrastructure",
    "AGRI":                           "Agriculture",
    "AGRICULTURE":                    "Agriculture",
    "TRADING":                        "Trading",
    "RETAIL":                         "Retail",
    "LOGISTICS":                      "Logistics",
    "TRANSPORT":                      "Logistics",
}

def normalise_sector(raw: str) -> str | None:
    if not raw:
        return None
    up = raw.strip().upper()
    for k, v in SECTOR_MAP.items():
        if k in up:
            return v
    return raw.strip().title() or None


# ── Supabase helpers ────────────────────────────────────────────────────────

def upsert(table: str, records: list[dict], conflict: str):
    url = f"{SUPABASE_URL}/rest/v1/{table}"
    total = 0
    for i in range(0, len(records), BATCH):
        batch = records[i:i + BATCH]
        r = requests.post(
            url, json=batch, headers={**HEADERS, "Prefer": f"resolution=merge-duplicates"},
            params={"on_conflict": conflict}, timeout=30,
        )
        if r.status_code not in (200, 201):
            print(f"\n  [WARN] batch {i}: HTTP {r.status_code} — {r.text[:200]}")
        else:
            total += len(batch)
        print(f"  {total}/{len(records)} upserted …", end="\r")
    print(f"  {total}/{len(records)} upserted.    ")
    return total


# ── NSE ────────────────────────────────────────────────────────────────────

NSE_EQUITY_URL  = "https://archives.nseindia.com/content/equities/EQUITY_L.csv"
NSE_INDEX_URLS  = {
    "Large Cap":  [
        "https://archives.nseindia.com/content/indices/ind_nifty50list.csv",
        "https://archives.nseindia.com/content/indices/ind_niftynext50list.csv",
    ],
    "Mid Cap":    ["https://archives.nseindia.com/content/indices/ind_niftymidcap150list.csv"],
    "Small Cap":  ["https://archives.nseindia.com/content/indices/ind_niftysmallcap250list.csv"],
    "_sector500": ["https://archives.nseindia.com/content/indices/ind_nifty500list.csv"],
}

def fetch_nse_session():
    """Prime NSE cookies."""
    s = requests.Session()
    s.headers.update(NSE_HEADERS)
    try:
        s.get("https://www.nseindia.com/", timeout=10)
        time.sleep(1)
    except Exception:
        pass
    return s

def fetch_csv(session, url: str) -> list[dict]:
    try:
        r = session.get(url, timeout=30)
        r.raise_for_status()
        text = r.content.decode("utf-8-sig", errors="replace")
        reader = csv.DictReader(io.StringIO(text))
        return [row for row in reader]
    except Exception as e:
        print(f"  [WARN] Could not fetch {url}: {e}")
        return []

def migrate_nse():
    print("\n── NSE Stocks ─────────────────────────────────────────────")
    session = fetch_nse_session()

    # Build sector + cap maps from index CSVs
    sector_map: dict[str, str]   = {}
    cap_map:    dict[str, str]   = {}

    for cap, urls in NSE_INDEX_URLS.items():
        for url in urls:
            rows = fetch_csv(session, url)
            for row in rows:
                sym = (row.get("Symbol") or row.get("SYMBOL") or "").strip().upper()
                if not sym:
                    continue
                ind = (row.get("Industry") or row.get("INDUSTRY") or "").strip()
                if ind and sym not in sector_map:
                    sector_map[sym] = normalise_sector(ind) or ind.title()
                if cap != "_sector500" and sym not in cap_map:
                    cap_map[sym] = cap
            time.sleep(0.5)

    print(f"  Index data: {len(sector_map)} sectors, {len(cap_map)} cap mappings")

    # All NSE EQ series stocks
    print("  Fetching EQUITY_L.csv …")
    rows = fetch_csv(session, NSE_EQUITY_URL)
    print(f"  Downloaded {len(rows)} rows")

    records = []
    for row in rows:
        sym    = (row.get("SYMBOL") or "").strip().upper()
        name   = (row.get("NAME OF COMPANY") or "").strip()
        series = (row.get(" SERIES") or row.get("SERIES") or "").strip()
        isin   = (row.get(" ISIN NUMBER") or row.get("ISIN NUMBER") or "").strip()
        fv_raw = (row.get(" FACE VALUE") or row.get("FACE VALUE") or "10").strip()

        # Only EQ series (excludes BE, SM, ST, etc.)
        if series not in ("EQ", ""):
            continue
        if not sym or not name:
            continue

        try:
            fv = float(fv_raw)
        except ValueError:
            fv = 10.0

        records.append({
            "symbol":       sym,
            "name":         name,
            "exchange":     "NSE",
            "isin":         isin or None,
            "sector":       sector_map.get(sym),
            "cap_category": cap_map.get(sym),
            "face_value":   fv,
            "is_active":    True,
        })

    print(f"  Upserting {len(records)} NSE stocks …")
    upsert("stocks", records, "symbol,exchange")
    print(f"  NSE done.")


# ── BSE ────────────────────────────────────────────────────────────────────

BSE_LIST_URL = (
    "https://api.bseindia.com/BseIndiaAPI/api/ListofScripData/w"
    "?Group=&Scripcode=&industry=&segment=Equity&status=Active"
)

def migrate_bse():
    print("\n── BSE Stocks ─────────────────────────────────────────────")
    try:
        r = requests.get(BSE_LIST_URL, headers=BSE_HEADERS, timeout=30)
        r.raise_for_status()
        data = r.json()
    except Exception as e:
        print(f"  [SKIP] BSE API unavailable: {e}")
        print("  BSE stocks can be added later via the BSE scripmaster CSV.")
        return

    items = data if isinstance(data, list) else data.get("Table", []) or data.get("data", [])
    print(f"  Downloaded {len(items)} BSE scrips")

    # Cap classification from BSE index groups
    # A = Large/Mid, B = Mid/Small, S/T/Z = Small
    cap_by_group = {"A": "Large Cap", "B": "Mid Cap", "S": "Small Cap", "T": "Small Cap", "Z": "Small Cap"}

    records = []
    for item in items:
        scrip   = str(item.get("SCRIP_CD") or item.get("scripcd") or "").strip()
        name    = (item.get("Scrip_Name") or item.get("scrip_name") or item.get("SCRIP_NAME") or "").strip()
        isin    = (item.get("ISIN_NUMBER") or item.get("isin_number") or "").strip()
        sector  = normalise_sector(item.get("INDUSTRY") or item.get("industry") or "")
        group   = (item.get("GROUP") or item.get("group_") or "").strip().upper()
        status  = (item.get("STATUS") or item.get("status") or "Active").strip()

        if not scrip or not name:
            continue
        if status.lower() not in ("active", "1", "true"):
            continue

        records.append({
            "symbol":       scrip,
            "name":         name,
            "exchange":     "BSE",
            "isin":         isin or None,
            "sector":       sector,
            "cap_category": cap_by_group.get(group),
            "is_active":    True,
        })

    print(f"  Upserting {len(records)} BSE stocks …")
    upsert("stocks", records, "symbol,exchange")
    print("  BSE done.")


# ── Mutual Funds ────────────────────────────────────────────────────────────

AMFI_URL = "https://www.amfiindia.com/spages/NAVAll.txt"

# Maps AMFI scheme category string → simplified category
MF_CATEGORY_MAP = {
    "equity scheme":          "Equity",
    "debt scheme":            "Debt",
    "hybrid scheme":          "Hybrid",
    "solution oriented":      "Hybrid",
    "other scheme - index":   "Index",
    "other scheme - etf":     "ETF",
    "other scheme - fund of": "Hybrid",
    "other scheme":           "Other",
}

def classify_mf(line: str) -> str | None:
    low = line.lower()
    for k, v in MF_CATEGORY_MAP.items():
        if k in low:
            return v
    return None

def parse_amfi(text: str) -> list[dict]:
    records = []
    current_category = None
    current_amc      = None

    for raw in text.splitlines():
        line = raw.strip()
        if not line:
            continue

        # Scheme-type header (ends with semicolons or starts with known keywords)
        cat = classify_mf(line)
        if cat and ";" not in line:
            current_category = cat
            current_amc      = None
            continue

        # AMC name (no semicolons, reasonably long)
        if ";" not in line:
            if len(line) > 5:
                current_amc = line
            continue

        parts = line.split(";")
        if len(parts) < 6:
            continue

        scheme_code = parts[0].strip()
        name        = parts[3].strip() if len(parts) > 3 else parts[1].strip()
        nav_str     = parts[4].strip() if len(parts) > 4 else ""
        date_str    = parts[5].strip() if len(parts) > 5 else ""

        if not scheme_code.isdigit() or not name:
            continue

        # Parse NAV
        nav = None
        try:
            nav = float(nav_str.replace(",", ""))
        except ValueError:
            pass

        # Parse date
        nav_date = None
        if date_str:
            for fmt in ("%d-%b-%Y", "%d/%m/%Y", "%Y-%m-%d", "%d-%m-%Y"):
                try:
                    nav_date = datetime.strptime(date_str, fmt).strftime("%Y-%m-%d")
                    break
                except ValueError:
                    pass

        # Detect fund type from name
        fund_type = "Open Ended"
        lname = name.lower()
        if "close ended" in lname or "fof" in lname:
            fund_type = "Close Ended"
        elif "interval" in lname:
            fund_type = "Interval"

        # Detect ELSS
        category = current_category
        if "elss" in lname or "tax sav" in lname or "tax-sav" in lname:
            category = "ELSS"

        records.append({
            "scheme_code": scheme_code,
            "name":        name,
            "amc":         current_amc,
            "category":    category,
            "fund_type":   fund_type,
            "nav":         nav,
            "nav_date":    nav_date,
            "is_active":   True,
        })

    return records

def migrate_mf():
    print("\n── Mutual Funds ────────────────────────────────────────────")
    print("  Downloading AMFI NAVAll.txt …")
    try:
        r = requests.get(AMFI_URL, timeout=60)
        r.raise_for_status()
        text = r.content.decode("utf-8-sig", errors="replace")
    except Exception as e:
        print(f"  [SKIP] AMFI unavailable: {e}")
        return

    records = parse_amfi(text)
    print(f"  Parsed {len(records)} funds")
    upsert("mutual_funds", records, "scheme_code")
    print("  Mutual funds done.")


# ── Entry point ─────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="MyCafe market data migration")
    parser.add_argument("--nse", action="store_true", help="Migrate NSE stocks")
    parser.add_argument("--bse", action="store_true", help="Migrate BSE stocks")
    parser.add_argument("--mf",  action="store_true", help="Migrate mutual funds")
    parser.add_argument("--all", action="store_true", help="Migrate everything (default)")
    args = parser.parse_args()

    run_all = args.all or not (args.nse or args.bse or args.mf)

    print(f"Supabase: {SUPABASE_URL}")
    start = time.time()

    if run_all or args.nse:
        migrate_nse()
    if run_all or args.bse:
        migrate_bse()
    if run_all or args.mf:
        migrate_mf()

    elapsed = time.time() - start
    print(f"\nDone in {elapsed:.1f}s")

if __name__ == "__main__":
    main()
