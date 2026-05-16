#!/usr/bin/env python3
"""
Seed mutual_funds table from AMFI NAVAll.txt
Usage: python scripts/seed_mf.py

Requires:
  pip install requests supabase python-dotenv

Downloads the latest NAV data from AMFI and upserts into Supabase.
"""
import os, re, sys, requests
from datetime import datetime
from dotenv import load_dotenv

load_dotenv(".env.local")

SUPABASE_URL = os.environ["VITE_SUPABASE_URL"]
SUPABASE_KEY = os.environ["VITE_SUPABASE_ANON_KEY"]

AMFI_URL = "https://www.amfiindia.com/spages/NAVAll.txt"

CATEGORY_MAP = {
    "Equity Scheme": "Equity",
    "Debt Scheme": "Debt",
    "Hybrid Scheme": "Hybrid",
    "Solution Oriented Scheme": "Hybrid",
    "Other Scheme - Index Funds": "Index",
    "Other Scheme - ETFs": "ETF",
    "Other Scheme - Fund of Funds": "Hybrid",
}

def fetch_amfi():
    print("Downloading AMFI NAVAll.txt …")
    r = requests.get(AMFI_URL, timeout=60)
    r.raise_for_status()
    return r.text

def parse_amfi(text: str):
    records = []
    current_category = None
    current_amc = None

    for line in text.splitlines():
        line = line.strip()
        if not line:
            continue

        # Category header
        if line.endswith(";") or re.match(r"^(Equity|Debt|Hybrid|Solution|Other) Scheme", line):
            for k, v in CATEGORY_MAP.items():
                if k.lower() in line.lower():
                    current_category = v
                    break
            continue

        # AMC name line (no semicolons, not a data row)
        if ";" not in line and len(line) > 10:
            current_amc = line
            continue

        parts = line.split(";")
        if len(parts) < 5:
            continue

        scheme_code = parts[0].strip()
        name        = parts[1].strip() if len(parts) > 1 else ""
        isin        = parts[2].strip() if len(parts) > 2 else None
        nav_str     = parts[4].strip() if len(parts) > 4 else ""
        date_str    = parts[5].strip() if len(parts) > 5 else ""

        if not scheme_code.isdigit() or not name:
            continue

        try:
            nav = float(nav_str)
        except ValueError:
            nav = None

        nav_date = None
        if date_str:
            for fmt in ("%d-%b-%Y", "%d/%m/%Y", "%Y-%m-%d"):
                try:
                    nav_date = datetime.strptime(date_str, fmt).strftime("%Y-%m-%d")
                    break
                except ValueError:
                    pass

        records.append({
            "scheme_code": scheme_code,
            "name":        name,
            "amc":         current_amc,
            "category":    current_category,
            "nav":         nav,
            "nav_date":    nav_date,
            "is_active":   True,
        })

    return records

def upsert_batch(records, headers):
    url = f"{SUPABASE_URL}/rest/v1/mutual_funds"
    batch_size = 500
    total = 0
    for i in range(0, len(records), batch_size):
        batch = records[i:i+batch_size]
        r = requests.post(
            url,
            json=batch,
            headers={**headers, "Prefer": "resolution=merge-duplicates"},
        )
        if r.status_code not in (200, 201):
            print(f"  Error at batch {i}: {r.status_code} {r.text[:200]}")
        else:
            total += len(batch)
            print(f"  Upserted {total}/{len(records)} …", end="\r")
    print(f"\nDone — {total} funds seeded.")

def main():
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
    }
    text = fetch_amfi()
    records = parse_amfi(text)
    print(f"Parsed {len(records)} fund records")
    upsert_batch(records, headers)

if __name__ == "__main__":
    main()
