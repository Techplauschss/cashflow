import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { addExchange, updateExchange, deleteExchange, subscribeToExchanges, type Exchange, type PortfolioProduct } from '../services/transactionService';
import { useLivePrices } from '../services/useLivePrices';

export const VermoegenOverview: React.FC = () => {
  const [exchanges, setExchanges] = useState<Exchange[]>([]);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [balance, setBalance] = useState('');
  const [shortcut, setShortcut] = useState('');
  const [parentId, setParentId] = useState<string | null>(null);
  const [products, setProducts] = useState<PortfolioProduct[]>([]);
  const [newProductType, setNewProductType] = useState<NonNullable<PortfolioProduct['type']>>('isin');
  const [newProductIsin, setNewProductIsin] = useState('');
  const [newProductShares, setNewProductShares] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [showTotalWealth, setShowTotalWealth] = useState(true);
  const [depotExchange, setDepotExchange] = useState<Exchange | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeToExchanges((data) => {
      setExchanges(data);
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const allProducts = React.useMemo(() => {
    return exchanges.flatMap(ex => ex.products || []);
  }, [exchanges]);

  const { quotes, loading: pricesLoading, error: pricesError, failedIsins, refetchPrices } = useLivePrices(allProducts);

  const getProductType = (product: PortfolioProduct): NonNullable<PortfolioProduct['type']> => (
    product.type ?? (product.isin.trim().toUpperCase() === 'BTC' ? 'btc' : 'isin')
  );

  const getProductQuoteKey = (product: PortfolioProduct) => (
    getProductType(product) === 'btc' ? 'BTC' : product.isin.toUpperCase()
  );

  const getProductLabel = (product: PortfolioProduct) => (
    getProductType(product) === 'btc' ? 'Bitcoin (BTC)' : product.isin.toUpperCase()
  );

  const getProductValue = (product: PortfolioProduct) => {
    const quote = quotes[getProductQuoteKey(product)];
    return quote ? quote.priceEur * product.shares : 0;
  };

  const getExchangeProductValue = (ex: Exchange) => {
    return (ex.products || []).reduce((sum, p) => sum + getProductValue(p), 0);
  };

  function getExchangeTotalValue(ex: Exchange): number {
    const children = exchanges.filter((child) => child.parentId === ex.id);
    return ex.balance + getExchangeProductValue(ex) + children.reduce((sum, child) => sum + getExchangeTotalValue(child), 0);
  }

  const totalWealth = exchanges
    .filter((ex) => !ex.parentId)
    .reduce((sum, ex) => sum + getExchangeTotalValue(ex), 0);

  const formatAmount = (amount: number): string => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };

  const handleBalanceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value;

    // 1. Entferne alle Zeichen, die keine Ziffern, Komma, Punkt oder Minus sind
    value = value.replace(/[^\d,.-]/g, '');

    // 2. Behandle das Minuszeichen: Nur am Anfang erlaubt
    if (value.startsWith('-')) {
      value = '-' + value.substring(1).replace(/-/g, ''); // Stelle sicher, dass nur ein führendes Minus vorhanden ist
    } else {
      value = value.replace(/-/g, ''); // Entferne alle nicht-führenden Minuszeichen
    }

    // 3. Stelle sicher, dass nur ein Dezimaltrennzeichen (Komma) vorhanden ist
    const parts = value.split(',');
    if (parts.length > 2) {
      value = parts[0] + ',' + parts.slice(1).join(''); // Behalte den ersten Teil, füge den Rest ohne Kommas zusammen
    }

    // 4. Verhindere Punkte nach dem Dezimalkomma (da Punkte im deutschen Format Tausendertrennzeichen sind)
    if (value.includes(',')) {
      const commaIndex = value.indexOf(',');
      value = value.substring(0, commaIndex + 1) + value.substring(commaIndex + 1).replace(/\./g, '');
    }

    setBalance(value);
  };

  const hasPortfolioFeatures = (accountName: string) => {
    const lower = accountName.trim().toLowerCase();
    return lower.includes('portfolio') || lower.includes('depot');
  };

  const shouldShowPortfolioPanel = (exchange: Exchange) => (
    hasPortfolioFeatures(exchange.name) || (exchange.products?.length ?? 0) > 0
  );

  const getChildren = (id: string) => exchanges.filter((ex) => ex.parentId === id);
  const hasChildren = (id: string | null) => !!id && exchanges.some((ex) => ex.parentId === id);
  const editingHasChildren = editingId ? hasChildren(editingId) : false;
  const editingDescendantIds = React.useMemo(() => {
    const ids = new Set<string>();
    const collectDescendants = (exchangeId: string) => {
      exchanges.filter((ex) => ex.parentId === exchangeId).forEach((child) => {
        ids.add(child.id);
        collectDescendants(child.id);
      });
    };

    if (editingId) {
      collectDescendants(editingId);
    }

    return ids;
  }, [editingId, exchanges]);
  const parentOptions = exchanges
    .filter((ex) => ex.id !== editingId && !editingDescendantIds.has(ex.id))
    .sort((a, b) => a.name.localeCompare(b.name, 'de'));

  const topLevelExchanges = exchanges
    .filter((ex) => !ex.parentId)
    .map((mainExchange) => {
      const children = getChildren(mainExchange.id);
      return { ...mainExchange, children, combinedBalance: getExchangeTotalValue(mainExchange) };
    })
    .sort((a, b) => b.combinedBalance - a.combinedBalance);

  const pieChartData = topLevelExchanges
    .filter((ex) => ex.combinedBalance > 0)
    .map((ex) => ({ name: ex.name, value: ex.combinedBalance }));

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    let numericBalance = parseFloat(balance.replace(/\./g, '').replace(',', '.'));
    // Wenn kein Wert oder ein ungültiger Wert eingegeben wurde, setze das Guthaben auf 0
    if (isNaN(numericBalance)) numericBalance = 0;

    if (editingId && hasChildren(editingId)) {
      numericBalance = 0;
    }

    if (!name.trim()) return;

    if (editingId) {
      await updateExchange(editingId, {
        name: name.trim(),
        balance: numericBalance,
        parentId,
        shortcut: shortcut.trim() === '' ? null : shortcut.trim(), // Set to null if empty to explicitly delete the field in Firebase
      });
    } else {
      await addExchange(name.trim(), numericBalance, parentId, shortcut.trim() || undefined);
    }
    resetForm();
  };

  const handleEdit = (exchange: Exchange) => {
    setEditingId(exchange.id);
    setName(exchange.name);
    setBalance(exchange.balance.toString().replace('.', ','));
    setShortcut(exchange.shortcut || '');
    setParentId(exchange.parentId || null);
    setIsAccountModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (hasChildren(id)) {
      alert('Bitte löschen oder verschieben Sie zuerst alle Unterkonten, bevor Sie dieses Hauptkonto löschen.');
      return;
    }

    if (window.confirm('Börse/Konto wirklich löschen?')) {
      await deleteExchange(id);
    }
  };

  const resetForm = () => {
    setIsAccountModalOpen(false);
    setEditingId(null);
    setName('');
    setBalance('');
    setShortcut('');
    setParentId(null);
  };

  const openCreateAccountModal = () => {
    setEditingId(null);
    setName('');
    setBalance('');
    setShortcut('');
    setParentId(null);
    setIsAccountModalOpen(true);
  };

  const openCreateSubaccountModal = () => {
    if (!editingId) return;

    const currentAccountId = editingId;
    setEditingId(null);
    setName('');
    setBalance('');
    setShortcut('');
    setParentId(currentAccountId);
  };

  const handleOpenDepotModal = (exchange: Exchange, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setDepotExchange(exchange);
    setProducts(exchange.products?.map((product) => ({
      id: product.id,
      isin: product.isin.toUpperCase(),
      shares: Number(product.shares) || 0,
      type: getProductType(product),
    })) || []);
    setNewProductType('isin');
    setNewProductIsin('');
    setNewProductShares('');
  };

  const closeDepotModal = () => {
    setDepotExchange(null);
    setProducts([]);
    setNewProductType('isin');
    setNewProductIsin('');
    setNewProductShares('');
  };

  const handleAddProductDraft = () => {
    const type = newProductType;
    const isin = type === 'btc' ? 'BTC' : newProductIsin.trim().toUpperCase();
    const shares = parseFloat(newProductShares.replace(',', '.'));
    
    if ((type === 'isin' && !isin) || Number.isNaN(shares) || shares <= 0) {
      alert(type === 'btc' ? 'Bitte gültige BTC-Anteile eingeben.' : 'Bitte gültige ISIN und Stückzahl eingeben.');
      return;
    }

    setProducts((current) => [
      ...current,
      { id: `${Date.now()}-${isin}`, isin, shares, type },
    ]);
    setNewProductType('isin');
    setNewProductIsin('');
    setNewProductShares('');
  };

  const handleSaveDepot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!depotExchange) return;

    try {
      await updateExchange(depotExchange.id, {
        products,
      });
      closeDepotModal();
    } catch (error) {
      console.error('Fehler beim Speichern des Depots:', error);
      alert('Fehler beim Speichern des Depots.');
    }
  };

  const removeProductDraft = (productId: string) => {
    setProducts((current) => current.filter((product) => product.id !== productId));
  };

   // Funktion zum Rendern der Portfolio-Produkte (inkl. Ladezustände & Live-Kurse)
  const renderProducts = (exchange: Exchange) => (
    <div className="space-y-2">
      {(exchange.products || []).map((product) => {
        const productLabel = getProductLabel(product);
        const quoteKey = getProductQuoteKey(product);
        const liveQuote = quotes[quoteKey];
        const isFailed = failedIsins.has(quoteKey);
        const totalValue = liveQuote ? liveQuote.priceEur * product.shares : 0;
        
        return (
          <div key={product.id} className="group flex items-center justify-between gap-3 rounded-lg bg-slate-800/50 hover:bg-slate-800/70 transition-colors px-3 py-2 text-slate-200 text-sm">
            <div className="flex flex-col">
              <span className="font-medium">{productLabel}</span>
              <span className="text-slate-400">Anteile: {product.shares}</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex flex-col text-right">
                {pricesLoading ? (
                  <div className="animate-pulse flex flex-col items-end gap-1 mt-1">
                    <div className="h-4 w-16 bg-slate-600 rounded"></div>
                    <div className="h-3 w-12 bg-slate-600 rounded"></div>
                  </div>
                ) : isFailed ? (
                  <span className="text-amber-400 text-xs">Kurs nicht verfügbar</span>
                ) : liveQuote ? (
                  <>
                    <span className="font-semibold text-green-400">{formatAmount(totalValue)}</span>
                    <span className="text-xs text-slate-400">{formatAmount(liveQuote.priceEur)} / Stück</span>
                    {liveQuote.currency !== 'EUR' && (
                      <span className="text-[11px] text-slate-500">
                        {liveQuote.currency} {liveQuote.price.toFixed(2)} → EUR
                      </span>
                    )}
                  </>
                ) : (
                  <span className="text-slate-500 text-xs">Warte auf Kurs...</span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );

  const renderAccountChildren = (parentAccount: Exchange, level = 1): React.ReactNode => {
    const children = getChildren(parentAccount.id)
      .sort((a, b) => getExchangeTotalValue(b) - getExchangeTotalValue(a));

    if (children.length === 0) return null;

    return (
      <div className={`${level === 1 ? 'pl-3 sm:pl-4 ml-3 sm:ml-4' : 'pl-4 ml-4'} space-y-2 border-l-2 border-slate-700/50`}>
        {children.map((child) => {
          const childTotal = getExchangeTotalValue(child);

          return (
            <React.Fragment key={child.id}>
              <div className="flex justify-between items-center p-2 sm:p-3 bg-slate-800/20 border border-slate-700/50 rounded-lg hover:bg-slate-800/40 transition-colors group">
                <span className="text-slate-300 font-medium text-sm flex items-center gap-2">
                  <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                  {child.name}
                  {hasPortfolioFeatures(child.name) && (
                    <button
                      onClick={(e) => handleOpenDepotModal(child, e)}
                      className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-200 transition-colors hover:bg-emerald-500/20"
                      title="Depot bearbeiten"
                    >
                      Depot
                    </button>
                  )}
                </span>
                <div className="flex items-center space-x-4">
                  <span className="text-slate-300 font-semibold text-sm">
                    {pricesLoading ? (
                      <span className="animate-pulse bg-slate-700/50 rounded h-5 w-20 inline-block align-middle"></span>
                    ) : (
                      formatAmount(childTotal)
                    )}
                  </span>
                  <div className="flex items-center space-x-2 opacity-80 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => handleEdit(child)} className="p-1 text-slate-400 hover:text-blue-400 hover:bg-slate-700/50 rounded-md transition-all" title="Bearbeiten">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                    </button>
                    <button onClick={() => handleDelete(child.id)} className="p-1 text-slate-400 hover:text-red-400 hover:bg-slate-700/50 rounded-md transition-all" title="Löschen">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </div>
                </div>
              </div>
              {shouldShowPortfolioPanel(child) && (
                <div className="pl-6 sm:pl-8 pb-2">
                  <div className="space-y-2 bg-slate-900/20 border border-slate-700/50 rounded-xl p-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <span className="text-slate-300 text-sm font-medium">Portfolio-Produkte</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500">{child.products?.length ?? 0} Einträge</span>
                        {hasPortfolioFeatures(child.name) && (
                          <button
                            type="button"
                            onClick={(e) => handleOpenDepotModal(child, e)}
                            className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-200 transition-colors hover:bg-emerald-500/20"
                          >
                            + Produkt
                          </button>
                        )}
                      </div>
                    </div>
                    {child.products && child.products.length > 0 ? (
                      renderProducts(child)
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => handleOpenDepotModal(child, e)}
                        className="w-full rounded-xl border border-dashed border-emerald-500/25 bg-emerald-500/5 px-3 py-3 text-sm font-medium text-emerald-200 transition hover:bg-emerald-500/10"
                      >
                        Erstes Finanzprodukt hinzufügen
                      </button>
                    )}
                  </div>
                </div>
              )}
              {renderAccountChildren(child, level + 1)}
            </React.Fragment>
          );
        })}
      </div>
    );
  };
  if (isLoading) return null;

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#6366f1', '#ec4899', '#14b8a6', '#f43f5e', '#06b6d4', '#f97316'];

  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ name: string; value: number }> }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-800 border border-slate-600 rounded-lg p-2 shadow-lg z-50">
          <p className="text-white font-medium text-sm">{payload[0].name}</p>
          {showTotalWealth && (
            <p className="text-slate-300 text-xs mt-1">{formatAmount(payload[0].value)}</p>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="flex items-center justify-center px-3 sm:px-4 pb-4 sm:pb-8">
      <div className="w-full max-w-4xl">
        <div className="bg-white/5 backdrop-blur-lg rounded-xl sm:rounded-2xl border border-white/10 p-4 sm:p-6 shadow-2xl mt-4 sm:mt-8">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-2 sm:gap-3">
            <h2 className="text-xl sm:text-2xl font-semibold text-white">Vermögen</h2>
            <button 
              onClick={refetchPrices}
              disabled={pricesLoading}
              className={`p-1.5 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-md transition-all ${pricesLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
              title="Live-Kurse aktualisieren"
            >
              <svg className={`w-4 h-4 sm:w-5 sm:h-5 ${pricesLoading ? 'animate-spin text-blue-400' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            </button>
          </div>
          {pricesError && (
            <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
              {pricesError}
            </div>
          )}
          <div className="text-right">
            <div className="flex items-center justify-end gap-2">
              <p className="text-sm text-slate-400">Gesamtvermögen</p>
              <button 
                onClick={() => setShowTotalWealth(!showTotalWealth)} 
                className="text-slate-400 hover:text-white transition-colors"
                title={showTotalWealth ? "Gesamtsumme ausblenden" : "Gesamtsumme einblenden"}
                type="button"
              >
                {showTotalWealth ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                )}
              </button>
            </div>
            <p className="text-xl font-bold text-green-400">
              {!showTotalWealth ? '•••••• €' : pricesLoading ? (
                <span className="animate-pulse bg-slate-700/50 rounded h-7 w-32 inline-block align-middle mt-1"></span>
              ) : (
                formatAmount(totalWealth)
              )}
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {topLevelExchanges.map((mainExchange) => {
            return (
              <div key={mainExchange.id} className="space-y-2">
                {/* Main Account */}
                <div className="flex justify-between items-center p-3 sm:p-4 bg-slate-800/40 border border-slate-600/40 rounded-lg hover:bg-slate-800/60 transition-colors group shadow-sm">
                  <span className="text-white font-medium flex items-center gap-2">
                    {mainExchange.name}
                    {hasPortfolioFeatures(mainExchange.name) && (
                      <button
                        onClick={(e) => handleOpenDepotModal(mainExchange, e)}
                        className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-200 transition-colors hover:bg-emerald-500/20"
                        title="Depot bearbeiten"
                      >
                        Depot
                      </button>
                    )}
                  </span>
                  <div className="flex items-center space-x-4">
                    <span className="text-white font-bold">
                      {pricesLoading ? (
                        <span className="animate-pulse bg-slate-700/50 rounded h-6 w-24 inline-block align-middle"></span>
                      ) : (
                        formatAmount(mainExchange.combinedBalance)
                      )}
                    </span>
                    <div className="flex items-center space-x-2 opacity-80 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => handleEdit(mainExchange)} className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-slate-700/50 rounded-md transition-all" title="Bearbeiten">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                      </button>
                      <button onClick={() => handleDelete(mainExchange.id)} className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-700/50 rounded-md transition-all" title="Löschen">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </div>
                  </div>
                </div>

              {/* Main Account Products */}
              {shouldShowPortfolioPanel(mainExchange) && (
                <div className="pl-6 sm:pl-8 pb-2 mt-2 border-l-2 border-transparent ml-3 sm:ml-4">
                  <div className="space-y-2 bg-slate-900/20 border border-slate-700/50 rounded-xl p-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <span className="text-slate-300 text-sm font-medium">Portfolio-Produkte</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500">{mainExchange.products?.length ?? 0} Einträge</span>
                        {hasPortfolioFeatures(mainExchange.name) && (
                          <button
                            type="button"
                            onClick={(e) => handleOpenDepotModal(mainExchange, e)}
                            className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-200 transition-colors hover:bg-emerald-500/20"
                          >
                            + Produkt
                          </button>
                        )}
                      </div>
                    </div>
                    {mainExchange.products && mainExchange.products.length > 0 ? (
                      renderProducts(mainExchange)
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => handleOpenDepotModal(mainExchange, e)}
                        className="w-full rounded-xl border border-dashed border-emerald-500/25 bg-emerald-500/5 px-3 py-3 text-sm font-medium text-emerald-200 transition hover:bg-emerald-500/10"
                      >
                        Erstes Finanzprodukt hinzufügen
                      </button>
                    )}
                  </div>
                </div>
              )}

                {renderAccountChildren(mainExchange)}
              </div>
            );
          })}

          {exchanges.length === 0 && !isAccountModalOpen && (
            <div className="text-center py-6 text-slate-400 text-sm border border-dashed border-slate-600/30 rounded-lg">
              Noch keine Börsen oder Konten angelegt.
            </div>
          )}
        </div>

        <button onClick={openCreateAccountModal} className="mt-4 w-full py-3.5 border-2 border-dashed border-slate-600/50 rounded-xl text-slate-400 hover:text-white hover:border-slate-500 hover:bg-slate-700/20 transition-all font-medium flex items-center justify-center">
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Börse / Konto hinzufügen
        </button>

        {isAccountModalOpen && createPortal((
          <div className="fixed inset-0 z-50 flex min-h-dvh items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
            <div className="w-full max-w-lg overflow-hidden rounded-3xl border border-white/10 bg-slate-900/95 shadow-2xl shadow-black/40">
              <form onSubmit={handleSave}>
                <div className="border-b border-white/10 bg-gradient-to-br from-blue-500/15 via-purple-500/10 to-cyan-500/10 p-5 sm:p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300/80">
                        {editingId ? 'Konto bearbeiten' : parentId ? 'Neues Unterkonto' : 'Neues Konto'}
                      </p>
                      <h3 className="text-2xl font-bold text-white">
                        {editingId ? name || 'Börse / Konto' : parentId ? 'Unterkonto anlegen' : 'Börse / Konto anlegen'}
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={resetForm}
                      className="rounded-full bg-white/10 p-2 text-slate-300 transition hover:bg-white/15 hover:text-white"
                      aria-label="Modal schließen"
                    >
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                </div>

                <div className="max-h-[70dvh] space-y-4 overflow-y-auto p-5 sm:p-6">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-300">Name</label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full rounded-2xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-white placeholder-slate-500 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-500/30"
                      placeholder="z.B. Trade Republic Depot"
                      required
                      autoFocus
                    />
                  </div>

                  {editingId && (
                    <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-sm font-semibold text-cyan-100">Unterkonto für dieses Konto anlegen</p>
                        </div>
                        <button
                          type="button"
                          onClick={openCreateSubaccountModal}
                          className="rounded-2xl bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-cyan-950/30 transition hover:bg-cyan-400"
                        >
                          + Unterkonto
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {editingHasChildren ? (
                      <div className="rounded-2xl border border-slate-700/70 bg-slate-950/50 p-4 sm:col-span-2">
                        <p className="text-sm font-medium text-slate-200">Guthaben wird aus Unterkonten berechnet</p>
                      </div>
                    ) : (
                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-slate-300">Guthaben</label>
                        <div className="relative">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">€</span>
                          <input
                            type="text"
                            value={balance}
                            onChange={handleBalanceChange}
                            className="w-full rounded-2xl border border-slate-700 bg-slate-950/70 py-3 pl-9 pr-4 text-white placeholder-slate-500 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-500/30"
                            placeholder="0,00"
                            inputMode="decimal"
                          />
                        </div>
                      </div>
                    )}

                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-slate-300">Kürzel</label>
                      <input
                        type="text"
                        value={shortcut}
                        onChange={(e) => setShortcut(e.target.value.toUpperCase().slice(0, 3))}
                        className="w-full rounded-2xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-white placeholder-slate-500 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-500/30"
                        placeholder="TR"
                        maxLength={3}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-300">Überkonto</label>
                    <select
                      value={parentId || ''}
                      onChange={(e) => setParentId(e.target.value || null)}
                      className="w-full appearance-none rounded-2xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-white outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-500/30"
                    >
                      <option value="">Kein Überkonto</option>
                      {parentOptions.map(ex => (
                        <option key={ex.id} value={ex.id}>{ex.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex flex-col gap-3 border-t border-white/10 bg-slate-950/60 p-5 sm:flex-row sm:justify-end sm:p-6">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="rounded-2xl border border-slate-700 bg-slate-800/70 px-5 py-3 font-medium text-slate-200 transition hover:bg-slate-700 hover:text-white"
                  >
                    Abbrechen
                  </button>
                  <button
                    type="submit"
                    className="rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-500 px-5 py-3 font-semibold text-white shadow-lg shadow-blue-950/30 transition hover:from-blue-500 hover:to-cyan-400"
                  >
                    {editingId ? 'Änderungen speichern' : 'Konto anlegen'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        ), document.body)}

        {/* Kreisdiagramm zur Visualisierung der Vermögensverteilung */}
        {pricesLoading ? (
          <div className="h-48 sm:h-64 w-full mt-8 mb-4 flex items-center justify-center">
            <div className="animate-pulse rounded-full bg-slate-700/30 h-40 w-40 sm:h-56 sm:w-56"></div>
          </div>
        ) : pieChartData.length > 0 && (
          <div className="h-48 sm:h-64 w-full mt-8 mb-4">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieChartData}
                  cx="50%"
                  cy="50%"
                  innerRadius="60%"
                  outerRadius="80%"
                  paddingAngle={2}
                  dataKey="value"
                  stroke="none"
                >
                  {pieChartData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {depotExchange && createPortal((
          <div className="fixed inset-0 z-50 flex min-h-dvh items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
            <div className="w-full max-w-2xl overflow-hidden rounded-3xl border border-emerald-400/20 bg-slate-900/95 shadow-2xl shadow-black/40">
              <form onSubmit={handleSaveDepot}>
                <div className="border-b border-emerald-400/10 bg-gradient-to-br from-emerald-500/15 via-cyan-500/10 to-slate-900 p-5 sm:p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300/80">Depot bearbeiten</p>
                      <h3 className="text-2xl font-bold text-white">{depotExchange.name}</h3>
                    </div>
                    <button
                      type="button"
                      onClick={closeDepotModal}
                      className="rounded-full bg-white/10 p-2 text-slate-300 transition hover:bg-white/15 hover:text-white"
                      aria-label="Depot-Modal schließen"
                    >
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                </div>

                <div className="max-h-[70dvh] space-y-5 overflow-y-auto p-5 sm:p-6">
                  <div className="rounded-2xl border border-emerald-400/10 bg-emerald-400/5 p-4">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-[8rem_minmax(0,1fr)_10rem_auto] sm:items-end">
                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-slate-300">Typ</label>
                        <select
                          value={newProductType}
                          onChange={(e) => {
                            const nextType = e.target.value as NonNullable<PortfolioProduct['type']>;
                            setNewProductType(nextType);
                            setNewProductIsin(nextType === 'btc' ? 'BTC' : '');
                          }}
                          className="w-full appearance-none rounded-2xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-white outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/30"
                        >
                          <option value="isin">ISIN</option>
                          <option value="btc">BTC</option>
                        </select>
                      </div>
                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-slate-300">{newProductType === 'btc' ? 'Produkt' : 'ISIN'}</label>
                        {newProductType === 'btc' ? (
                          <div className="w-full rounded-2xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-white">
                            Bitcoin (BTC)
                          </div>
                        ) : (
                          <input
                            type="text"
                            value={newProductIsin}
                            onChange={(e) => setNewProductIsin(e.target.value.toUpperCase())}
                            className="w-full rounded-2xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-white placeholder-slate-500 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/30"
                            placeholder="IE00BKM4GZ66"
                            autoFocus
                          />
                        )}
                      </div>
                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-slate-300">Anteile</label>
                        <input
                          type="text"
                          value={newProductShares}
                          onChange={(e) => setNewProductShares(e.target.value)}
                          className="w-full rounded-2xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-white placeholder-slate-500 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/30"
                          placeholder="0,00"
                          inputMode="decimal"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleAddProductDraft}
                        className="rounded-2xl bg-emerald-600 px-5 py-3 font-semibold text-white shadow-lg shadow-emerald-950/30 transition hover:bg-emerald-500"
                      >
                        Hinzufügen
                      </button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-slate-200">Produkte</p>
                      <span className="rounded-full bg-slate-800 px-2.5 py-1 text-xs text-slate-400">{products.length} Einträge</span>
                    </div>
                    {products.length > 0 ? (
                      products.map((product) => (
                        <div key={product.id} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-700/70 bg-slate-950/50 p-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-white">{getProductLabel(product)}</p>
                            <p className="mt-1 text-xs text-slate-400">Anteile: {product.shares}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeProductDraft(product.id)}
                            className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm font-medium text-red-300 transition hover:bg-red-500/20 hover:text-red-200"
                          >
                            Entfernen
                          </button>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-2xl border border-dashed border-slate-700 p-6 text-center">
                        <p className="text-sm font-medium text-slate-300">Noch keine Produkte im Depot.</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-3 border-t border-white/10 bg-slate-950/60 p-5 sm:flex-row sm:justify-end sm:p-6">
                  <button
                    type="button"
                    onClick={closeDepotModal}
                    className="rounded-2xl border border-slate-700 bg-slate-800/70 px-5 py-3 font-medium text-slate-200 transition hover:bg-slate-700 hover:text-white"
                  >
                    Abbrechen
                  </button>
                  <button
                    type="submit"
                    className="rounded-2xl bg-gradient-to-r from-emerald-600 to-cyan-500 px-5 py-3 font-semibold text-white shadow-lg shadow-emerald-950/30 transition hover:from-emerald-500 hover:to-cyan-400"
                  >
                    Depot speichern
                  </button>
                </div>
              </form>
            </div>
          </div>
        ), document.body)}
        </div>
      </div>
    </div>
  );
};