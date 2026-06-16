const API_KEY = import.meta.env.VITE_EODHD_API_KEY;
const BASE_URL = 'https://eodhd.com/api';
const YAHOO_BASE_URL = 'https://query2.finance.yahoo.com';
const YAHOO_TICKER_PREFIX = 'YAHOO:';

// Öffentlicher CORS-Proxy, um die Browser-Sicherheitsrichtlinie für externe APIs zu umgehen.
// Dies ist die einfachste Lösung für reine Frontend-Projekte ohne Backend.
const CORS_PROXY = 'https://corsproxy.io/?';

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

interface YahooSearchResult {
  quotes?: Array<{
    symbol?: string;
    quoteType?: string;
    isYahooFinance?: boolean;
  }>;
}

interface YahooChartResult {
  chart?: {
    result?: Array<{
      meta?: {
        regularMarketPrice?: number;
        previousClose?: number;
        chartPreviousClose?: number;
      };
    }>;
  };
}

const fetchJson = async <T>(targetUrl: string): Promise<T> => {
  const urls = [
    targetUrl,
    `${CORS_PROXY}${encodeURIComponent(targetUrl)}`,
  ];

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

const normalizeIsin = (isin: string) => isin.trim().toUpperCase();

const toTicker = (mapping: EodhdSearchResult) => {
  if (!mapping.Code || !mapping.Exchange) return null;
  return `${mapping.Code}.${mapping.Exchange}`.toUpperCase();
};

const parsePrice = (item: EodhdPriceResult): number | null => {
  const candidates = [item.close, item.price, item.last, item.previousClose]
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value > 0);

  return candidates[0] ?? null;
};

const mapIsinToYahooTicker = async (isin: string): Promise<string | null> => {
  const data = await fetchJson<YahooSearchResult>(
    `${YAHOO_BASE_URL}/v1/finance/search?q=${encodeURIComponent(isin)}&quotesCount=10&newsCount=0`,
  );

  const quote = data.quotes?.find((item) =>
    item.symbol && item.isYahooFinance !== false && ['ETF', 'EQUITY', 'MUTUALFUND'].includes(item.quoteType ?? ''),
  ) ?? data.quotes?.find((item) => item.symbol);

  return quote?.symbol ? `${YAHOO_TICKER_PREFIX}${quote.symbol.toUpperCase()}` : null;
};

export const mapIsinToTicker = async (isin: string): Promise<string | null> => {
  const normalizedIsin = normalizeIsin(isin);

  if (!API_KEY) {
    return mapIsinToYahooTicker(normalizedIsin);
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

      return mapping ? toTicker(mapping) : null;
    }
    
    console.warn(`Kein Ticker für die ISIN ${normalizedIsin} gefunden.`);
    return mapIsinToYahooTicker(normalizedIsin);
  } catch (e) {
    console.error(`Error mapping ISIN ${normalizedIsin}:`, e);
    return mapIsinToYahooTicker(normalizedIsin);
  }
};

const getYahooLivePrices = async (tickers: string[]): Promise<Record<string, number>> => {
  const prices: Record<string, number> = {};

  await Promise.all(tickers.map(async (ticker) => {
    try {
      const symbol = ticker.replace(YAHOO_TICKER_PREFIX, '');
      const url = `${YAHOO_BASE_URL}/v8/finance/chart/${encodeURIComponent(symbol)}?range=5d&interval=1d`;
      const data = await fetchJson<YahooChartResult>(url);
      const meta = data.chart?.result?.[0]?.meta;
      const price = meta?.regularMarketPrice ?? meta?.previousClose ?? meta?.chartPreviousClose;

      if (Number.isFinite(price) && price && price > 0) {
        prices[ticker] = price;
      }
    } catch (error) {
      console.warn(`Yahoo price lookup failed for ${ticker}:`, error);
    }
  }));

  return prices;
};

export const getLivePrices = async (tickers: string[]): Promise<Record<string, number>> => {
  if (tickers.length === 0) return {};

  const yahooTickers = tickers.filter((ticker) => ticker.startsWith(YAHOO_TICKER_PREFIX));
  const eodhdTickers = tickers.filter((ticker) => !ticker.startsWith(YAHOO_TICKER_PREFIX));
  const prices: Record<string, number> = {};

  if (yahooTickers.length > 0) {
    Object.assign(prices, await getYahooLivePrices(yahooTickers));
  }

  if (!API_KEY || eodhdTickers.length === 0) return prices;
  
  const firstTicker = eodhdTickers[0];
  const otherTickers = eodhdTickers.slice(1).join(',');
  
  try {
    let url = `${BASE_URL}/real-time/${firstTicker}?api_token=${API_KEY}&fmt=json`;
    if (otherTickers) {
      url += `&s=${otherTickers}`;
    }
    
    const requestedTickers = eodhdTickers.map((ticker) => ticker.toUpperCase());
    const data = await fetchJson<unknown>(url);
    const items = (Array.isArray(data) ? data : [data]) as EodhdPriceResult[];
    
    items.forEach((item, index) => {
      const price = parsePrice(item);
      if (!price) return;

      const code = item.code?.toUpperCase();
      const exchange = item.exchange?.toUpperCase();
      const fullTicker = code && exchange ? `${code}.${exchange}` : undefined;
      const requestedTicker = requestedTickers[index];

      if (requestedTicker) {
        prices[requestedTicker] = price;
      }
      if (fullTicker) {
        prices[fullTicker] = price;
      }
      if (code) {
        prices[code] = price;
        requestedTickers
          .filter((ticker) => ticker.startsWith(`${code}.`))
          .forEach((ticker) => {
            prices[ticker] = price;
          });
      }
    });
    return prices;
  } catch (e) {
    console.error('Error fetching live prices:', e);
    return prices;
  }
};