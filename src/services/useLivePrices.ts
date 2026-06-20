import { useState, useEffect, useCallback } from 'react';
import { mapIsinToTicker, getLiveQuotes, getBitcoinEurQuote, hasLivePriceApiKey, type LiveQuote, type TickerMapping } from './eodhdService';
import type { PortfolioProduct } from './transactionService';

const tickerCache = new Map<string, TickerMapping | null>();

const normalizeIsin = (isin: string) => isin.trim().toUpperCase();
const getProductQuoteKey = (product: PortfolioProduct) => (
  product.type === 'btc' || normalizeIsin(product.isin) === 'BTC' ? 'BTC' : normalizeIsin(product.isin)
);

export const useLivePrices = (products: PortfolioProduct[]) => {
  const [quotes, setQuotes] = useState<Record<string, LiveQuote>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [failedIsins, setFailedIsins] = useState<Set<string>>(new Set());

  const uniqueQuoteKeys = Array.from(new Set(products.map(getProductQuoteKey).filter(Boolean))).sort();
  const quoteKeysKey = JSON.stringify(uniqueQuoteKeys);

  const fetchPrices = useCallback(async (isSilent = false) => {
    const currentQuoteKeys = JSON.parse(quoteKeysKey) as string[];
    const currentIsins = currentQuoteKeys.filter((key) => key !== 'BTC');
    const shouldFetchBitcoin = currentQuoteKeys.includes('BTC');

    if (currentQuoteKeys.length === 0) {
      setQuotes({});
      setError(null);
      return;
    }

      if (!isSilent) setLoading(true);
      setError(null);

      try {
        const tickerToIsin: Record<string, string> = {};
        const mappingsToFetch: TickerMapping[] = [];
        const newFailedIsins = new Set<string>();
        const nextQuotes: Record<string, LiveQuote> = {};

        if (shouldFetchBitcoin) {
          const bitcoinQuote = await getBitcoinEurQuote();
          if (bitcoinQuote) {
            nextQuotes.BTC = bitcoinQuote;
          } else {
            newFailedIsins.add('BTC');
          }
        }

        if (!hasLivePriceApiKey && currentIsins.length > 0) {
          currentIsins.forEach((isin) => newFailedIsins.add(isin));
          setQuotes(nextQuotes);
          setFailedIsins(newFailedIsins);
          setError('Für ISIN-Live-Kurse wird VITE_EODHD_API_KEY benötigt.');
          return;
        }

        // 1. ISINs zu Tickers mappen
        await Promise.all(currentIsins.map(async (isin) => {
          let ticker: TickerMapping | null | undefined;
          try {
            ticker = tickerCache.has(isin)
              ? tickerCache.get(isin)
              : await mapIsinToTicker(isin);
            tickerCache.set(isin, ticker ?? null);
          } catch (error) {
            console.warn(`ISIN mapping failed for ${isin}:`, error);
            tickerCache.set(isin, null);
            ticker = null;
          }

          if (ticker) {
            tickerToIsin[ticker.ticker] = isin;
            mappingsToFetch.push(ticker);
          } else {
            newFailedIsins.add(isin);
          }
        }));

        // 2. Gebündelte Live-Preis-Abfrage
        if (mappingsToFetch.length > 0) {
          const liveQuotes = await getLiveQuotes(mappingsToFetch);
          Object.entries(tickerToIsin).forEach(([ticker, isin]) => {
            const tickerCode = ticker.split('.')[0];
            const quote = liveQuotes[ticker] ?? liveQuotes[tickerCode];
            if (isin) {
              if (quote) {
                nextQuotes[isin] = quote;
              } else {
                newFailedIsins.add(isin);
              }
            }
          });
        }

        setQuotes(nextQuotes);
         
        setFailedIsins(newFailedIsins);
      } catch (err) {
        console.error('Fehler im Live-Preis-Abruf:', err);
        setError('Fehler beim Laden der Live-Kurse.');
      } finally {
        if (!isSilent) setLoading(false);
      }
  }, [quoteKeysKey]);

  useEffect(() => {
    // Initialer Ladevorgang
    fetchPrices(false);
    
    // Automatisches Background-Polling der Live-Kurse alle 60 Sekunden
    const intervalId = setInterval(() => fetchPrices(true), 60000);
    
    return () => clearInterval(intervalId);
  }, [fetchPrices]);

  return { quotes, loading, error, failedIsins, refetchPrices: () => fetchPrices(false) };
};