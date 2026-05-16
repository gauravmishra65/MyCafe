// Complete implementation:
let cachedCookie = "";
let cachedCrumb = "";
let crumbFetchedAt = 0;

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function getCrumb(): Promise<{ cookie: string; crumb: string }> {
  if (cachedCrumb && Date.now() - crumbFetchedAt < 55 * 60 * 1000) {
    return { cookie: cachedCookie, crumb: cachedCrumb };
  }
  const r1 = await fetch("https://fc.yahoo.com", {
    redirect: "follow",
    headers: { "User-Agent": UA, "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" },
  });
  const rawCookies = r1.headers.getSetCookie?.() ?? [];
  const cookie = rawCookies.map((c: string) => c.split(";")[0]).join("; ");

  const r2 = await fetch("https://query1.finance.yahoo.com/v1/test/getcrumb", {
    headers: { cookie, "User-Agent": UA },
  });
  const crumb = (await r2.text()).trim();
  if (!crumb || crumb.includes("<")) {
    throw new Error("Failed to get Yahoo crumb");
  }
  cachedCookie = cookie;
  cachedCrumb = crumb;
  crumbFetchedAt = Date.now();
  return { cookie, crumb };
}

async function yahooFetch(url: string): Promise<unknown> {
  const { cookie, crumb } = await getCrumb();
  const sep = url.includes("?") ? "&" : "?";
  const res = await fetch(`${url}${sep}crumb=${encodeURIComponent(crumb)}`, {
    headers: { cookie, "User-Agent": UA },
  });
  if (res.status === 401) {
    cachedCrumb = "";
    throw new Error("Yahoo 401 — crumb expired");
  }
  if (!res.ok) throw new Error(`Yahoo ${res.status}: ${await res.text()}`);
  return res.json();
}

function parseChartQuote(data: unknown, symbol: string): Record<string, unknown> {
  const d = data as { chart?: { result?: Array<{ meta?: Record<string, unknown> }> } };
  const meta = d?.chart?.result?.[0]?.meta;
  if (!meta) throw new Error(`No result for ${symbol}`);
  const prev = (meta.previousClose ?? meta.chartPreviousClose ?? meta.regularMarketPreviousClose) as number;
  const price = meta.regularMarketPrice as number;
  return {
    symbol,
    name: (meta.longName ?? meta.shortName ?? symbol) as string,
    price,
    change: price - prev,
    changePct: prev > 0 ? ((price - prev) / prev) * 100 : 0,
    open: meta.regularMarketOpen as number,
    high: meta.regularMarketDayHigh as number,
    low: meta.regularMarketDayLow as number,
    previousClose: prev,
    volume: meta.regularMarketVolume as number,
    marketCap: (meta.marketCap ?? null) as number | null,
    fiftyTwoWeekHigh: (meta.fiftyTwoWeekHigh ?? null) as number | null,
    fiftyTwoWeekLow: (meta.fiftyTwoWeekLow ?? null) as number | null,
    currency: (meta.currency ?? "INR") as string,
    exchange: (meta.exchangeName ?? "") as string,
    updatedAt: Date.now(),
  };
}

function parseCandles(data: unknown): Array<Record<string, unknown>> {
  const d = data as { chart?: { result?: Array<{ timestamp?: number[]; indicators?: { quote?: Array<{ open: number[]; high: number[]; low: number[]; close: number[]; volume: number[] }> } }> } };
  const r = d?.chart?.result?.[0];
  if (!r) return [];
  const { timestamp, indicators } = r;
  const q = indicators?.quote?.[0];
  if (!q || !timestamp) return [];
  return timestamp.map((t, i) => ({
    t, o: q.open[i], h: q.high[i], l: q.low[i], c: q.close[i], v: q.volume[i],
  })).filter((c) => c.c !== null && c.c !== undefined);
}

const NIFTY50 = [
  "RELIANCE.NS","TCS.NS","HDFCBANK.NS","INFY.NS","ICICIBANK.NS",
  "SBIN.NS","LT.NS","AXISBANK.NS","KOTAKBANK.NS","BAJFINANCE.NS",
  "MARUTI.NS","SUNPHARMA.NS","TATAMOTORS.NS","WIPRO.NS","HCLTECH.NS",
  "ADANIENT.NS","HINDUNILVR.NS","BHARTIARTL.NS","ITC.NS","TITAN.NS",
];

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  const url = new URL(req.url);
  const action = url.searchParams.get("action") ?? "quote";

  try {
    if (action === "indices") {
      const symbols = ["^NSEI", "^BSESN", "^NSEBANK", "^CNXIT", "^INDIAVIX"];
      const results = await Promise.all(
        symbols.map(async (sym) => {
          try {
            return parseChartQuote(
              await yahooFetch(`https://query1.finance.yahoo.com/v8/finance/chart/${sym}?interval=1d&range=1d`),
              sym
            );
          } catch {
            return null;
          }
        })
      );
      return Response.json(results.filter(Boolean), { headers: CORS });
    }

    if (action === "quote") {
      const symbol = url.searchParams.get("symbol")!;
      const data = await yahooFetch(
        `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`
      );
      return Response.json(parseChartQuote(data, symbol), { headers: CORS });
    }

    if (action === "quotes") {
      const symbols = (url.searchParams.get("symbols") ?? "").split(",").filter(Boolean);
      const results = await Promise.all(
        symbols.map(async (sym) => {
          try {
            return parseChartQuote(
              await yahooFetch(`https://query1.finance.yahoo.com/v8/finance/chart/${sym}?interval=1d&range=1d`),
              sym
            );
          } catch {
            return null;
          }
        })
      );
      return Response.json(results.filter(Boolean), { headers: CORS });
    }

    if (action === "history") {
      const symbol = url.searchParams.get("symbol")!;
      const range = url.searchParams.get("range") ?? "1y";
      const interval = url.searchParams.get("interval") ?? "1d";
      const data = await yahooFetch(
        `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=${range}&interval=${interval}`
      );
      return Response.json(parseCandles(data), { headers: CORS });
    }

    if (action === "movers") {
      const quotes = (
        await Promise.all(
          NIFTY50.map(async (sym) => {
            try {
              return parseChartQuote(
                await yahooFetch(`https://query1.finance.yahoo.com/v8/finance/chart/${sym}?interval=1d&range=1d`),
                sym
              );
            } catch {
              return null;
            }
          })
        )
      ).filter(Boolean) as Array<Record<string, unknown>>;

      quotes.sort((a, b) => (b.changePct as number) - (a.changePct as number));
      return Response.json(
        {
          gainers: quotes.filter((q) => (q.changePct as number) > 0).slice(0, 5),
          losers: [...quotes].reverse().filter((q) => (q.changePct as number) < 0).slice(0, 5),
        },
        { headers: CORS }
      );
    }

    if (action === "fundamentals") {
      const symbol = url.searchParams.get("symbol")!;
      const modules = "financialData,defaultKeyStatistics,summaryDetail,assetProfile,recommendationTrend,price";
      const data = await yahooFetch(
        `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${symbol}?modules=${modules}`
      );
      return Response.json(data, { headers: CORS });
    }

    return Response.json({ error: "Unknown action" }, { status: 400, headers: CORS });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500, headers: CORS });
  }
});
