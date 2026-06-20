const API_KEY = import.meta.env.VITE_EODHD_API_KEY;
const BASE_URL = 'https://eodhd.com/api';
const FRANKFURTER_BASE_URL = 'https://api.frankfurter.dev/v1';
const COINGECKO_BASE_URL = 'https://api.coingecko.com/api/v3';

// Öffentlicher CORS-Proxy, um die Browser-Sicherheitsrichtlinie für externe APIs zu umgehen.
// Dies ist die einfachste Lösung für reine Frontend-Projekte ohne Backend.
const CORS_PROXY = 'https://corsproxy.io/?';

export const hasLivePriceApiKey = Boolean(API_KEY);

const FALLBACK_ISIN_MAPPINGS: Record<string, TickerMapping> = {
  IE00BKM4GZ66: {
    ticker: 'IS3N.XETRA',
    currency: 'EUR',
    source: 'eodhd',
  },
};

interface EodhdSearchResult {
  Code?: string;
  Exchange?: string;
  Currency?: string;
  Name?: string;
}

interface EodhdPriceResult {
  code?: string;
  exchange?: string;
  timestamp?: number;
  close?: number | string;
  previousClose?: number | string;
  price?: number | string;
  last?: number | string;
}

interface FrankfurterResult {
  rates?: Record<string, number>;
}

interface CoinGeckoBitcoinResult {
  bitcoin?: {
    eur?: number;
  };
}

export interface TickerMapping {
  ticker: string;
  currency?: string;
  source: 'eodhd';
}

export interface LiveQuote {
  ticker: string;
  price: number;
  currency: string;
  priceEur: number;
  updatedAt: number;
  source: 'eodhd' | 'coingecko';
}

const fetchJson = async <T>(targetUrl: string): Promise<T> => {
  const devProxyUrl = toDevProxyUrl(targetUrl);
  if (devProxyUrl) {
    const res = await fetch(devProxyUrl);
    if (!res.ok) {
      throw new Error(`${res.status} ${res.statusText}`);
    }
    return await res.json() as T;
  }

  const proxiedUrl = `${CORS_PROXY}${encodeURIComponent(targetUrl)}`;
  const urls = [targetUrl, proxiedUrl];

  let lastError: unknown = null;
  for (const url of urls) {
    try {
      const res = await fetch(url);
      if (!res.ok) {
        lastError = new Error(`${res.status} ${res.statusText}`);
        continue;
      }
      return await res.json() as T;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error('API request failed');
};

const toDevProxyUrl = (targetUrl: string): string | null => {
  if (!import.meta.env.DEV) return null;

  const url = new URL(targetUrl);
  if (targetUrl.startsWith(BASE_URL)) {
    return `/api/eodhd${url.pathname.replace('/api', '')}${url.search}`;
  }
  if (targetUrl.startsWith(FRANKFURTER_BASE_URL)) {
    return `/api/frankfurter${url.pathname.replace('/v1', '')}${url.search}`;
  }
  if (targetUrl.startsWith(COINGECKO_BASE_URL)) {
    return `/api/coingecko${url.pathname.replace('/api/v3', '')}${url.search}`;
  }

  return null;
};

const normalizeIsin = (isin: string) => isin.trim().toUpperCase();

const toTickerMapping = (mapping: EodhdSearchResult): TickerMapping | null => {
  if (!mapping.Code || !mapping.Exchange) return null;
  return {
    ticker: `${mapping.Code}.${mapping.Exchange}`.toUpperCase(),
    currency: mapping.Currency?.toUpperCase(),
    source: 'eodhd',
  };
};

const parsePrice = (item: EodhdPriceResult): number | null => {
  const candidates = [item.close, item.price, item.last, item.previousClose]
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value > 0);

  return candidates[0] ?? null;
};

export const mapIsinToTicker = async (isin: string): Promise<TickerMapping | null> => {
  const normalizedIsin = normalizeIsin(isin);
  const fallbackMapping = FALLBACK_ISIN_MAPPINGS[normalizedIsin];

  if (fallbackMapping) {
    return fallbackMapping;
  }

  if (!API_KEY) {
    return null;
  }
  
  try {
    // EODHD Search API unterstützt die explizite Suche nach ISINs
    const targetUrl = `${BASE_URL}/search/${encodeURIComponent(normalizedIsin)}?api_token=${API_KEY}&fmt=json`;
    const data = await fetchJson<unknown>(targetUrl);

    // Die Search-API liefert ein Array von Treffern zurück
    if (data && Array.isArray(data) && data.length > 0) {
      const results = data as EodhdSearchResult[];

      // Bevorzuge XETRA (Deutschland)
      let mapping = results.find((m) => m.Exchange === 'XETRA');
      
      // Falls XETRA nicht gefunden, suche nach Frankfurt, Stuttgart, München etc.
      if (!mapping) {
        mapping = results.find((m) => m.Exchange !== undefined && ['F', 'STU', 'MU', 'HA', 'DU'].includes(m.Exchange));
      }
      
      // Falls auch keine deutsche Börse, suche eine mit Euro
      if (!mapping) {
        mapping = results.find((m) => m.Currency === 'EUR');
      }
      
      // Fallback: Der erste gefundene Treffer
      if (!mapping) {
        mapping = results[0];
      }

      return mapping ? toTickerMapping(mapping) : null;
    }
    
    console.warn(`Kein Ticker für die ISIN ${normalizedIsin} gefunden.`);
    return FALLBACK_ISIN_MAPPINGS[normalizedIsin] ?? null;
  } catch (e) {
    console.error(`Error mapping ISIN ${normalizedIsin}:`, e);
    return FALLBACK_ISIN_MAPPINGS[normalizedIsin] ?? null;
  }
};

const getCurrencyToEurRate = async (currency: string): Promise<number | null> => {
  const normalizedCurrency = currency.toUpperCase();
  if (normalizedCurrency === 'EUR') return 1;

  try {
    const url = `${FRANKFURTER_BASE_URL}/latest?from=${encodeURIComponent(normalizedCurrency)}&to=EUR`;
    const data = await fetchJson<FrankfurterResult>(url);
    const rate = data.rates?.EUR;

    return Number.isFinite(rate) && rate && rate > 0 ? rate : null;
  } catch (error) {
    console.warn(`FX lookup failed for ${normalizedCurrency}/EUR:`, error);
    return null;
  }
};

const toLiveQuote = async (
  ticker: string,
  price: number,
  currency: string | undefined,
  source: 'eodhd',
): Promise<LiveQuote | null> => {
  const normalizedCurrency = (currency || 'EUR').toUpperCase();
  const eurRate = await getCurrencyToEurRate(normalizedCurrency);
  if (!eurRate) return null;

  return {
    ticker,
    price,
    currency: normalizedCurrency,
    priceEur: price * eurRate,
    updatedAt: Date.now(),
    source,
  };
};

export const getLiveQuotes = async (mappings: TickerMapping[]): Promise<Record<string, LiveQuote>> => {
  if (mappings.length === 0) return {};

  const eodhdMappings = mappings;
  const quotes: Record<string, LiveQuote> = {};

  if (!API_KEY || eodhdMappings.length === 0) return quotes;
  
  const firstTicker = eodhdMappings[0].ticker;
  const otherTickers = eodhdMappings.slice(1).map((mapping) => mapping.ticker).join(',');
  
  try {
    let url = `${BASE_URL}/real-time/${firstTicker}?api_token=${API_KEY}&fmt=json`;
    if (otherTickers) {
      url += `&s=${otherTickers}`;
    }
    
    const requestedTickers = eodhdMappings.map((mapping) => mapping.ticker.toUpperCase());
    const mappingByTicker = new Map(eodhdMappings.map((mapping) => [mapping.ticker.toUpperCase(), mapping]));
    const data = await fetchJson<unknown>(url);
    const items = (Array.isArray(data) ? data : [data]) as EodhdPriceResult[];
    
    await Promise.all(items.map(async (item, index) => {
      const price = parsePrice(item);
      if (!price) return;

      const code = item.code?.toUpperCase();
      const exchange = item.exchange?.toUpperCase();
      const fullTicker = code && exchange ? `${code}.${exchange}` : undefined;
      const requestedTicker = requestedTickers[index];
      const mapping = mappingByTicker.get(requestedTicker);
      const quote = await toLiveQuote(
        requestedTicker,
        price,
        mapping?.currency,
        'eodhd',
      );

      if (!quote) return;

      if (requestedTicker) {
        quotes[requestedTicker] = quote;
      }
      if (fullTicker) {
        quotes[fullTicker] = quote;
      }
      if (code) {
        quotes[code] = quote;
        requestedTickers
          .filter((ticker) => ticker.startsWith(`${code}.`))
          .forEach((ticker) => {
            quotes[ticker] = quote;
          });
      }
    }));
    return quotes;
  } catch (e) {
    console.error('Error fetching live prices:', e);
    return quotes;
  }
};

export const getBitcoinEurQuote = async (): Promise<LiveQuote | null> => {
  try {
    const url = `${COINGECKO_BASE_URL}/simple/price?ids=bitcoin&vs_currencies=eur`;
    const data = await fetchJson<CoinGeckoBitcoinResult>(url);
    const price = Number(data.bitcoin?.eur);

    if (!Number.isFinite(price) || price <= 0) {
      return null;
    }

    return {
      ticker: 'BTC',
      price,
      currency: 'EUR',
      priceEur: price,
      updatedAt: Date.now(),
      source: 'coingecko',
    };
  } catch (error) {
    console.warn('BTC/EUR lookup failed:', error);
    return null;
  }
};