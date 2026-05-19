import { useState, useEffect, useCallback } from 'react';
import { mapIsinToTicker, getLivePrices } from './eodhdService';
import type { PortfolioProduct } from './transactionService';

export const useLivePrices = (products: PortfolioProduct[]) => {
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [failedIsins, setFailedIsins] = useState<Set<string>>(new Set());

  // Alle eindeutigen ISINs extrahieren und stringifizieren, um Re-Renders zu minimieren
  const uniqueIsins = Array.from(new Set(products.map(p => p.isin))).sort();
  const isinsKey = JSON.stringify(uniqueIsins);

  const fetchPrices = useCallback(async (isSilent = false) => {
    const currentIsins = JSON.parse(isinsKey) as string[];
    if (currentIsins.length === 0) {
      setPrices({});
      return;
    }

      if (!isSilent) setLoading(true);
      setError(null);
      
      try {
        const tickerToIsin: Record<string, string> = {};
        const tickersToFetch: string[] = [];
        const newFailedIsins = new Set<string>();

        // 1. ISINs zu Tickers mappen
        await Promise.all(currentIsins.map(async (isin) => {
          const ticker = await mapIsinToTicker(isin);
          if (ticker) {
            tickerToIsin[ticker] = isin;
            tickersToFetch.push(ticker);
          } else {
            newFailedIsins.add(isin);
          }
        }));

        // 2. Gebündelte Live-Preis-Abfrage
        if (tickersToFetch.length > 0) {
          const livePrices = await getLivePrices(tickersToFetch);
          const isinPrices: Record<string, number> = {};
          
          Object.entries(livePrices).forEach(([ticker, price]) => {
            const isin = tickerToIsin[ticker];
            if (isin) {
              isinPrices[isin] = price;
            }
          });
          
          setPrices(isinPrices);
        }
        
        setFailedIsins(newFailedIsins);
      } catch (err) {
        console.error('Fehler im Live-Preis-Abruf:', err);
        setError('Fehler beim Laden der Live-Kurse.');
      } finally {
        if (!isSilent) setLoading(false);
      }
  }, [isinsKey]);

  useEffect(() => {
    // Initialer Ladevorgang
    fetchPrices(false);
    
    // Automatisches Background-Polling der Live-Kurse alle 60 Sekunden
    const intervalId = setInterval(() => fetchPrices(true), 60000);
    
    return () => clearInterval(intervalId);
  }, [fetchPrices]);

  return { prices, loading, error, failedIsins, refetchPrices: () => fetchPrices(false) };
};