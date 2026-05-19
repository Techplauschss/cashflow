const API_KEY = import.meta.env.VITE_EODHD_API_KEY || '6a0b4abcd31ee0.19095986';
const BASE_URL = 'https://eodhd.com/api';

// Öffentlicher CORS-Proxy, um die Browser-Sicherheitsrichtlinie für externe APIs zu umgehen.
// Dies ist die einfachste Lösung für reine Frontend-Projekte ohne Backend.
const CORS_PROXY = 'https://corsproxy.io/?';

export const mapIsinToTicker = async (isin: string): Promise<string | null> => {
  if (!API_KEY) {
    console.warn('EODHD API-Key fehlt! Bitte VITE_EODHD_API_KEY in der .env-Datei setzen und den Server neustarten.');
    return null;
  }
  
  try {
    // EODHD Search API unterstützt die explizite Suche nach ISINs
    const targetUrl = `${BASE_URL}/search/${isin}?api_token=${API_KEY}&fmt=json`;
    const res = await fetch(`${CORS_PROXY}${encodeURIComponent(targetUrl)}`);
    
    if (!res.ok) {
      console.error(`EODHD API Fehler beim Mapping der ISIN ${isin}: ${res.status} ${res.statusText}`);
      return null;
    }
    
    const data = await res.json();
    // Die Search-API liefert ein Array von Treffern zurück
    if (data && Array.isArray(data) && data.length > 0) {
      // Bevorzuge XETRA (Deutschland)
      let mapping = data.find((m: any) => m.Exchange === 'XETRA');
      
      // Falls XETRA nicht gefunden, suche nach Frankfurt, Stuttgart, München etc.
      if (!mapping) {
        mapping = data.find((m: any) => ['F', 'STU', 'MU', 'HA', 'DU'].includes(m.Exchange));
      }
      
      // Falls auch keine deutsche Börse, suche eine mit Euro
      if (!mapping) {
        mapping = data.find((m: any) => m.Currency === 'EUR');
      }
      
      // Fallback: Der erste gefundene Treffer
      if (!mapping) {
        mapping = data[0];
      }

      if (mapping.Code && mapping.Exchange) {
        return `${mapping.Code}.${mapping.Exchange}`;
      }
    }
    
    console.warn(`Kein Ticker für die ISIN ${isin} gefunden.`);
    return null;
  } catch (e) {
    console.error(`Error mapping ISIN ${isin}:`, e);
    return null;
  }
};

export const getLivePrices = async (tickers: string[]): Promise<Record<string, number>> => {
  if (!API_KEY || tickers.length === 0) return {};
  
  const firstTicker = tickers[0];
  const otherTickers = tickers.slice(1).join(',');
  
  try {
    let url = `${BASE_URL}/real-time/${firstTicker}?api_token=${API_KEY}&fmt=json`;
    if (otherTickers) {
      url += `&s=${otherTickers}`;
    }
    
    const res = await fetch(`${CORS_PROXY}${encodeURIComponent(url)}`);
    if (!res.ok) {
      console.error(`EODHD API Fehler bei Live-Preisen: ${res.status} ${res.statusText}`);
      throw new Error('API request failed');
    }
    
    const data = await res.json();
    const items = Array.isArray(data) ? data : [data];
    
    const prices: Record<string, number> = {};
    items.forEach(item => {
      if (item && item.code) {
        // Bevorzuge close als Preis, ansonsten fallback auf previousClose
        const price = item.close !== 'NA' && item.close > 0 ? Number(item.close) : Number(item.previousClose);
        if (!isNaN(price)) {
          prices[item.code] = price;
        }
      }
    });
    return prices;
  } catch (e) {
    console.error('Error fetching live prices:', e);
    throw e;
  }
};