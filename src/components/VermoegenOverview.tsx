import React, { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { addExchange, updateExchange, deleteExchange, subscribeToExchanges, type Exchange, type PortfolioProduct } from '../services/transactionService';
import { useLivePrices } from '../services/useLivePrices';

export const VermoegenOverview: React.FC = () => {
  const [exchanges, setExchanges] = useState<Exchange[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [balance, setBalance] = useState('');
  const [shortcut, setShortcut] = useState('');
  const [parentId, setParentId] = useState<string | null>(null);
  const [products, setProducts] = useState<PortfolioProduct[]>([]);
  const [newProductIsin, setNewProductIsin] = useState('');
  const [newProductShares, setNewProductShares] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [showTotalWealth, setShowTotalWealth] = useState(true);
  const [isAddProductModalOpen, setIsAddProductModalOpen] = useState(false);
  const [targetExchange, setTargetExchange] = useState<Exchange | null>(null);
  const [modalIsin, setModalIsin] = useState('');
  const [modalShares, setModalShares] = useState('');

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

  const { prices, loading: pricesLoading, error: pricesError, failedIsins, refetchPrices } = useLivePrices(allProducts);

  const getProductValue = (product: PortfolioProduct) => {
    const price = prices[product.isin.toUpperCase()];
    return price ? price * product.shares : 0;
  };

  const getExchangeProductValue = (ex: Exchange) => {
    return (ex.products || []).reduce((sum, p) => sum + getProductValue(p), 0);
  };

  const totalWealth = exchanges.reduce((sum, ex) => sum + (ex.balance || 0) + getExchangeProductValue(ex), 0);

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

  const isPortfolioAccount = hasPortfolioFeatures(name);

  const getChildren = (id: string) => exchanges.filter((ex) => ex.parentId === id);
  const hasChildren = (id: string | null) => !!id && exchanges.some((ex) => ex.parentId === id);
  const editingHasChildren = editingId ? hasChildren(editingId) : false;

  const topLevelExchanges = exchanges
    .filter((ex) => !ex.parentId)
    .map((mainExchange) => {
      const children = getChildren(mainExchange.id);
      const childrenProductValue = children.reduce((s, c) => s + getExchangeProductValue(c), 0);
      const mainProductValue = getExchangeProductValue(mainExchange);
      const combinedBalance = mainExchange.balance + mainProductValue + children.reduce((s, c) => s + (c.balance || 0), 0) + childrenProductValue;
      return { ...mainExchange, children, combinedBalance };
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

    const productPayload = isPortfolioAccount ? products : undefined;

    if (editingId) {
      await updateExchange(editingId, {
        name: name.trim(),
        balance: numericBalance,
        parentId,
        shortcut: shortcut.trim() === '' ? null : shortcut.trim(), // Set to null if empty to explicitly delete the field in Firebase
        ...(productPayload ? { products: productPayload } : {})
      });
    } else {
      await addExchange(name.trim(), numericBalance, parentId, shortcut.trim() || undefined, productPayload);
    }
    resetForm();
  };

  const handleEdit = (exchange: Exchange) => {
    setEditingId(exchange.id);
    setName(exchange.name);
    setBalance(exchange.balance.toString().replace('.', ','));
    setShortcut(exchange.shortcut || '');
    setParentId(exchange.parentId || null);
    setProducts(exchange.products?.map((product) => ({
      id: product.id,
      isin: product.isin,
      shares: Number(product.shares) || 0,
    })) || []);
    setNewProductIsin('');
    setNewProductShares('');
    setIsAdding(true);
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
    setIsAdding(false);
    setEditingId(null);
    setName('');
    setBalance('');
    setShortcut('');
    setParentId(null);
    setProducts([]);
    setNewProductIsin('');
    setNewProductShares('');
  };

  const handleOpenAddProduct = (e: React.MouseEvent, exchange: Exchange) => {
    e.stopPropagation();
    setTargetExchange(exchange);
    setModalIsin('');
    setModalShares('');
    setIsAddProductModalOpen(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetExchange) return;

    const isin = modalIsin.trim().toUpperCase();
    const shares = parseFloat(modalShares.replace(',', '.'));
    
    if (!isin || Number.isNaN(shares) || shares <= 0) {
      alert('Bitte gültige ISIN und Stückzahl eingeben.');
      return;
    }

    const currentProducts = targetExchange.products || [];
    const newProduct: PortfolioProduct = {
      id: `${Date.now()}-${isin}`,
      isin,
      shares
    };

    try {
      await updateExchange(targetExchange.id, {
        products: [...currentProducts, newProduct]
      });
      setIsAddProductModalOpen(false);
      setTargetExchange(null);
    } catch (error) {
      console.error('Fehler beim Hinzufügen des Produkts:', error);
      alert('Fehler beim Speichern des Produkts.');
    }
  };

  const handleDeleteProduct = async (exchangeId: string, productId: string) => {
    if (window.confirm('Produkt wirklich löschen?')) {
      const exchange = exchanges.find((ex) => ex.id === exchangeId);
      if (exchange) {
        const updatedProducts = (exchange.products || []).filter((p) => p.id !== productId);
        try {
          await updateExchange(exchangeId, { products: updatedProducts });
        } catch (error) {
          console.error('Fehler beim Löschen des Produkts:', error);
          alert('Fehler beim Löschen des Produkts.');
        }
      }
    }
  };

   // Funktion zum Rendern der Portfolio-Produkte (inkl. Ladezustände & Live-Kurse)
  const renderProducts = (exchange: Exchange) => (
    <div className="space-y-2">
      {(exchange.products || []).map((product) => {
        const normalizedIsin = product.isin.toUpperCase();
        const livePrice = prices[normalizedIsin];
        const isFailed = failedIsins.has(normalizedIsin);
        const totalValue = livePrice ? livePrice * product.shares : 0;
        
        return (
          <div key={product.id} className="group flex items-center justify-between gap-3 rounded-lg bg-slate-800/50 hover:bg-slate-800/70 transition-colors px-3 py-2 text-slate-200 text-sm">
            <div className="flex flex-col">
              <span className="font-medium">{normalizedIsin}</span>
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
                ) : livePrice ? (
                  <>
                    <span className="font-semibold text-green-400">{formatAmount(totalValue)}</span>
                    <span className="text-xs text-slate-400">{formatAmount(livePrice)} / Stück</span>
                  </>
                ) : (
                  <span className="text-slate-500 text-xs">Warte auf Kurs...</span>
                )}
              </div>
              <div className="flex opacity-0 group-hover:opacity-100 transition-opacity pl-2 border-l border-slate-700/50">
                <button onClick={() => handleDeleteProduct(exchange.id, product.id)} className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-slate-700/50 rounded-md transition-all" title="Produkt löschen">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
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
                        onClick={(e) => handleOpenAddProduct(e, mainExchange)}
                        className="text-slate-400 hover:text-green-400 transition-colors bg-slate-700/50 hover:bg-slate-600 rounded-full w-5 h-5 flex items-center justify-center text-sm pb-0.5"
                        title="ISIN hinzufügen"
                      >
                        +
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
                    <div className="flex space-x-2 opacity-60 group-hover:opacity-100 transition-opacity">
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
              {hasPortfolioFeatures(mainExchange.name) && (
                <div className="pl-6 sm:pl-8 pb-2 mt-2 border-l-2 border-transparent ml-3 sm:ml-4">
                  <div className="space-y-2 bg-slate-900/20 border border-slate-700/50 rounded-xl p-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-slate-300 text-sm font-medium">Portfolio-Produkte</span>
                      <span className="text-xs text-slate-500">{mainExchange.products?.length ?? 0} Einträge</span>
                    </div>
                    {mainExchange.products && mainExchange.products.length > 0 ? (
                      renderProducts(mainExchange)
                    ) : (
                      <p className="text-slate-500 text-sm">Keine Finanzprodukte hinterlegt. Bearbeiten, um ISIN und Anteile hinzuzufügen.</p>
                    )}
                  </div>
                </div>
              )}

                {/* Sub Accounts */}
                {mainExchange.children.length > 0 && (
                  <div className="pl-3 sm:pl-4 space-y-2 border-l-2 border-slate-700/50 ml-3 sm:ml-4">
                    {mainExchange.children.map(child => {
                      const childProductValue = getExchangeProductValue(child);
                      const childTotal = child.balance + childProductValue;
                      return (
                      <React.Fragment key={child.id}>
                        <div className="flex justify-between items-center p-2 sm:p-3 bg-slate-800/20 border border-slate-700/50 rounded-lg hover:bg-slate-800/40 transition-colors group">
                          <span className="text-slate-300 font-medium text-sm flex items-center gap-2">
                            <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                            {child.name}
                            {hasPortfolioFeatures(child.name) && (
                              <button
                                onClick={(e) => handleOpenAddProduct(e, child)}
                                className="text-slate-400 hover:text-green-400 transition-colors bg-slate-700/50 hover:bg-slate-600 rounded-full w-5 h-5 flex items-center justify-center text-sm pb-0.5"
                                title="ISIN hinzufügen"
                              >
                                +
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
                            <div className="flex space-x-2 opacity-60 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => handleEdit(child)} className="p-1 text-slate-400 hover:text-blue-400 hover:bg-slate-700/50 rounded-md transition-all" title="Bearbeiten">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                              </button>
                              <button onClick={() => handleDelete(child.id)} className="p-1 text-slate-400 hover:text-red-400 hover:bg-slate-700/50 rounded-md transition-all" title="Löschen">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                              </button>
                            </div>
                          </div>
                        </div>
                        {hasPortfolioFeatures(child.name) && (
                          <div className="pl-6 sm:pl-8 pb-2">
                            <div className="space-y-2 bg-slate-900/20 border border-slate-700/50 rounded-xl p-3">
                              <div className="flex items-center justify-between gap-3">
                                <span className="text-slate-300 text-sm font-medium">Portfolio-Produkte</span>
                                <span className="text-xs text-slate-500">{child.products?.length ?? 0} Einträge</span>
                              </div>
                              {child.products && child.products.length > 0 ? (
                              renderProducts(child)
                              ) : (
                                <p className="text-slate-500 text-sm">Keine Finanzprodukte hinterlegt. Bearbeiten, um ISIN und Anteile hinzuzufügen.</p>
                              )}
                            </div>
                          </div>
                        )}
                      </React.Fragment>
                    )})}
                  </div>
                )}
              </div>
            );
          })}

          {exchanges.length === 0 && !isAdding && (
            <div className="text-center py-6 text-slate-400 text-sm border border-dashed border-slate-600/30 rounded-lg">
              Noch keine Börsen oder Konten angelegt.
            </div>
          )}
        </div>

        {isAdding ? (
          <form onSubmit={handleSave} className="mt-4 p-4 sm:p-5 bg-slate-700/30 rounded-xl border border-slate-600/30 shadow-inner">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Name (Börse/Konto)</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full px-3 py-2.5 bg-slate-800/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="z.B. Trade Republic" required autoFocus />
              </div>
              {editingHasChildren ? (
                <div className="sm:col-span-2 p-3 rounded-lg bg-slate-800/40 border border-slate-600/50">
                  <p className="text-sm text-slate-300 font-medium mb-1.5">Guthaben (€) (Optional)</p>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Guthaben (€) (Optional)</label>
                  <input
                    type="text"
                    value={balance}
                    onChange={handleBalanceChange}
                    className="w-full px-3 py-2.5 bg-slate-800/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0,00"
                  />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Kürzel (Optional)</label>
                <input
                  type="text"
                  value={shortcut}
                  onChange={(e) => setShortcut(e.target.value.toUpperCase().slice(0, 3))}
                  className="w-full px-3 py-2.5 bg-slate-800/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="z.B. TR"
                  maxLength={3}
                />
                <p className="mt-1 text-xs text-slate-400">Max. 3 Zeichen, wird automatisch großgeschrieben</p>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Überkonto / Hauptkonto (Optional)</label>
                <select
                  value={parentId || ''}
                  onChange={(e) => setParentId(e.target.value || null)}
                  className="w-full px-3 py-2.5 bg-slate-800/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none"
                >
                  <option value="">-- Kein Überkonto (Ist ein Hauptkonto) --</option>
                  {topLevelExchanges.filter(ex => ex.id !== editingId).map(ex => (
                    <option key={ex.id} value={ex.id}>{ex.name}</option>
                  ))}
                </select>
              </div>

              {isPortfolioAccount && (
                <div className="sm:col-span-2 bg-slate-800/40 p-4 rounded-xl border border-slate-600/40">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                    <div className="sm:col-span-2">
                      <label className="block text-sm font-medium text-slate-300 mb-1.5">ISIN</label>
                      <input
                        type="text"
                        value={newProductIsin}
                        onChange={(e) => setNewProductIsin(e.target.value.toUpperCase())}
                        className="w-full px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="z.B. DE000A1YB8A1"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1.5">Anteile</label>
                      <input
                        type="text"
                        value={newProductShares}
                        onChange={(e) => setNewProductShares(e.target.value)}
                        className="w-full px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="0,00"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const isin = newProductIsin.trim();
                        const shares = parseFloat(newProductShares.replace(',', '.'));
                        if (!isin || !newProductShares || Number.isNaN(shares) || shares <= 0) {
                          alert('Bitte gültige ISIN und Stückzahl eingeben.');
                          return;
                        }
                        setProducts((current) => [
                          ...current,
                          { id: `${Date.now()}-${isin}`, isin, shares },
                        ]);
                        setNewProductIsin('');
                        setNewProductShares('');
                      }}
                      className="w-full px-3 py-2.5 rounded-lg bg-green-600 text-white font-medium hover:bg-green-500 transition-colors"
                    >
                      Produkt hinzufügen
                    </button>
                  </div>

                  <div className="mt-4 space-y-2">
                    {products.length > 0 ? (
                      products.map((product) => (
                        <div key={product.id} className="flex items-center justify-between gap-3 rounded-lg bg-slate-900/70 p-3 border border-slate-700">
                          <div>
                            <p className="text-slate-100 text-sm font-medium">{product.isin}</p>
                            <p className="text-slate-400 text-xs">Anteile: {product.shares}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setProducts((current) => current.filter((item) => item.id !== product.id))}
                            className="text-red-400 hover:text-red-300 text-sm"
                          >
                            Entfernen
                          </button>
                        </div>
                      ))
                    ) : (
                      <p className="text-slate-500 text-sm">Hier können Sie direkt ISINs und Anteilsmengen für Ihr Portfolio eintragen.</p>
                    )}
                  </div>
                </div>
              )}
            </div>
            <div className="flex justify-end space-x-3 pt-2">
              <button type="button" onClick={resetForm} className="px-4 py-2 text-sm text-slate-300 hover:text-white bg-slate-800/50 hover:bg-slate-700/50 rounded-lg transition-colors border border-transparent hover:border-slate-600/50">Abbrechen</button>
              <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors shadow-lg shadow-blue-500/20">{editingId ? 'Aktualisieren' : 'Hinzufügen'}</button>
            </div>
          </form>
        ) : (
          <button onClick={() => setIsAdding(true)} className="mt-4 w-full py-3.5 border-2 border-dashed border-slate-600/50 rounded-xl text-slate-400 hover:text-white hover:border-slate-500 hover:bg-slate-700/20 transition-all font-medium flex items-center justify-center">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Börse / Konto hinzufügen
          </button>
        )}

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

        {/* Add Product Modal */}
        {isAddProductModalOpen && targetExchange && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 rounded-2xl border border-slate-600/30 p-6 w-full max-w-sm shadow-2xl">
              <h3 className="text-lg font-semibold text-white mb-4">ISIN zu {targetExchange.name} hinzufügen</h3>
              <form onSubmit={handleSaveProduct} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">ISIN</label>
                  <input
                    type="text"
                    value={modalIsin}
                    onChange={(e) => setModalIsin(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="z.B. DE000A1YB8A1"
                    required
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Anteile</label>
                  <input
                    type="text"
                    value={modalShares}
                    onChange={(e) => setModalShares(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0,00"
                    required
                  />
                </div>
                <div className="flex justify-end space-x-3 pt-4 border-t border-slate-700/50 mt-2">
                  <button
                    type="button"
                    onClick={() => { setIsAddProductModalOpen(false); setTargetExchange(null); }}
                    className="px-4 py-2 text-sm text-slate-300 hover:text-white bg-slate-700/50 hover:bg-slate-600/50 rounded-lg transition-colors border border-transparent"
                  >
                    Abbrechen
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-500 rounded-lg transition-colors shadow-lg shadow-green-500/20"
                  >
                    Hinzufügen
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  );
};