const M4TH_BASE_URL = "https://api.m4th.com";

async function m4thGet<T>(path: string): Promise<T> {
  const res = await fetch(`${M4TH_BASE_URL}${path}`, {
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`M4th API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

// ─── Ticker Search (autocomplete) ────────────────────────

export interface TickerSearchResult {
  ticker: string;
  name: string;
  exchange: string;
}

export async function searchTicker(query: string): Promise<TickerSearchResult[]> {
  if (!query || query.length < 1) return [];
  const data = await m4thGet<{ items: { symbol: string; name: string; exchange: string }[] }>(
    `/api/ticker-search?query=${encodeURIComponent(query)}`
  );
  return (data.items || []).map((item) => ({
    ticker: item.symbol,
    name: item.name,
    exchange: item.exchange,
  }));
}

// ─── Valuation (GET, ?symbol=) ───────────────────────────

export async function getValuation(symbol: string): Promise<unknown> {
  return m4thGet(`/get/valuation?symbol=${encodeURIComponent(symbol)}`);
}

// ─── Company Profile (GET, ?symbol=) ─────────────────────

export async function getCompanyProfile(symbol: string): Promise<unknown> {
  return m4thGet(`/get/company-profile?symbol=${encodeURIComponent(symbol)}`);
}

// ─── Valuation Peers (GET, ?symbol=) ─────────────────────

export async function getValuationPeers(symbol: string): Promise<unknown> {
  return m4thGet(`/get/valuation-peers?symbol=${encodeURIComponent(symbol)}`);
}

// ─── Refresh Price (GET, ?symbol=) ───────────────────────

export async function refreshPrice(symbol: string): Promise<unknown> {
  return m4thGet(`/get/refresh-price?symbol=${encodeURIComponent(symbol)}`);
}
