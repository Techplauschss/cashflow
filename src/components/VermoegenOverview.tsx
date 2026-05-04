import React, { useState, useEffect } from 'react';
import { addExchange, updateExchange, deleteExchange, subscribeToExchanges, type Exchange, type PortfolioProduct } from '../services/transactionService';

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

  useEffect(() => {
    const unsubscribe = subscribeToExchanges((data) => {
      setExchanges(data);
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const totalWealth = exchanges.reduce((sum, ex) => sum + (ex.balance || 0), 0);

  const formatAmount = (amount: number): string => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };

  const handleBalanceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value;

    // 1. Entferne alle Zeichen, die keine Ziffern, Komma, Punkt oder Minus sind
    value = value.replace(/[^\d,\.-]/g, '');

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

  const isPortfolioAccount = name.trim().toLowerCase().includes('portfolio');

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
    const hasChildren = exchanges.some(ex => ex.parentId === id);
    if (hasChildren) {
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

  if (isLoading) return null;

  const getChildren = (id: string) => exchanges.filter(ex => ex.parentId === id);
  const hasChildren = (id: string | null) => !!id && exchanges.some(ex => ex.parentId === id);
  const editingHasChildren = editingId ? hasChildren(editingId) : false;

  const topLevelExchanges = exchanges
    .filter(ex => !ex.parentId)
    .sort((a, b) => {
      const balanceA = a.balance + getChildren(a.id).reduce((s, c) => s + (c.balance || 0), 0);
      const balanceB = b.balance + getChildren(b.id).reduce((s, c) => s + (c.balance || 0), 0);
      return balanceB - balanceA;
    });

  return (
    <div className="flex items-center justify-center px-3 sm:px-4 pb-4 sm:pb-8">
      <div className="w-full max-w-4xl">
        <div className="bg-white/5 backdrop-blur-lg rounded-xl sm:rounded-2xl border border-white/10 p-4 sm:p-6 shadow-2xl mt-4 sm:mt-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl sm:text-2xl font-semibold text-white">Vermögen</h2>
          <div className="text-right">
            <p className="text-sm text-slate-400">Gesamtvermögen</p>
            <p className="text-xl font-bold text-green-400">{formatAmount(totalWealth)}</p>
          </div>
        </div>

        <div className="space-y-4">
          {topLevelExchanges.map((mainExchange) => {
            const children = getChildren(mainExchange.id);
            const combinedBalance = mainExchange.balance + children.reduce((s, c) => s + (c.balance || 0), 0);

            return (
              <div key={mainExchange.id} className="space-y-2">
                {/* Main Account */}
                <div className="flex justify-between items-center p-3 sm:p-4 bg-slate-800/40 border border-slate-600/40 rounded-lg hover:bg-slate-800/60 transition-colors group shadow-sm">
                  <span className="text-white font-medium">{mainExchange.name}</span>
                  <div className="flex items-center space-x-4">
                    <span className="text-white font-bold">{formatAmount(combinedBalance)}</span>
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

                {/* Sub Accounts */}
                {children.length > 0 && (
                  <div className="pl-3 sm:pl-4 space-y-2 border-l-2 border-slate-700/50 ml-3 sm:ml-4">
                    {children.map(child => (
                      <React.Fragment key={child.id}>
                        <div className="flex justify-between items-center p-2 sm:p-3 bg-slate-800/20 border border-slate-700/50 rounded-lg hover:bg-slate-800/40 transition-colors group">
                          <span className="text-slate-300 font-medium text-sm flex items-center gap-2">
                            <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                            {child.name}
                          </span>
                          <div className="flex items-center space-x-4">
                            <span className="text-slate-300 font-semibold text-sm">{formatAmount(child.balance)}</span>
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
                        {child.name.trim().toLowerCase().includes('portfolio') && (
                          <div className="pl-6 sm:pl-8 pb-2">
                            <div className="space-y-2 bg-slate-900/20 border border-slate-700/50 rounded-xl p-3">
                              <div className="flex items-center justify-between gap-3">
                                <span className="text-slate-300 text-sm font-medium">Portfolio-Produkte</span>
                                <span className="text-xs text-slate-500">{child.products?.length ?? 0} Einträge</span>
                              </div>
                              {child.products && child.products.length > 0 ? (
                                <div className="space-y-2">
                                  {child.products.map((product) => (
                                    <div key={product.id} className="flex items-center justify-between gap-3 rounded-lg bg-slate-800/50 px-3 py-2 text-slate-200 text-sm">
                                      <div className="flex flex-col">
                                        <span className="font-medium">{product.isin.toUpperCase()}</span>
                                        <span className="text-slate-400">Anteile: {product.shares}</span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-slate-500 text-sm">Keine Finanzprodukte hinterlegt. Bearbeiten, um ISIN und Anteile hinzuzufügen.</p>
                              )}
                            </div>
                          </div>
                        )}
                      </React.Fragment>
                    ))}
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
        </div>
      </div>
    </div>
  );
};