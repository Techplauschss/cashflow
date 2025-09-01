import { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import type { Transaction } from '../types/Transaction';
import { getTransactionsForMonth, getAvailableMonths, updateKilometerstand, updateLiter } from '../services/transactionService';

interface MonthData {
  year: number;
  month: number;
  monthYear: string;
  count: number;
  transactions?: Transaction[];
  isLoading?: boolean;
  isExpanded?: boolean;
}

export interface LazyTransactionListRef {
  refreshData: () => void;
}

export const LazyTransactionList = forwardRef<LazyTransactionListRef>((_, ref) => {
  const [months, setMonths] = useState<MonthData[]>([]);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeSearchTerm, setActiveSearchTerm] = useState('');
  const [searchLoadingMonths, setSearchLoadingMonths] = useState<Set<string>>(new Set());
  const [literInputs, setLiterInputs] = useState<Record<string, string>>({});
  const [kmInputs, setKmInputs] = useState<Record<string, string>>({});
  const [savingStates, setSavingStates] = useState<Record<string, boolean>>({});

  const isTankenTransaction = (description: string, type: string): boolean => {
    // Nur bei Ausgaben (expenses) prüfen
    if (type !== 'expense') return false;
    
    const lowerDescription = description.toLowerCase();
    // Prüfe auf "tanken", "tanke" oder "sprit" aber nicht "sprite"
    const hasTanken = lowerDescription.includes('tanken');
    const hasTanke = lowerDescription.includes('tanke');
    const hasSprit = lowerDescription.includes('sprit') && !lowerDescription.includes('sprite');
    
    return hasTanken || hasTanke || hasSprit;
  };

  // Einfache Eingabe-Handler - speichern nur lokal
  const handleKilometerInput = (transactionId: string, value: string) => {
    setKmInputs(prev => ({ ...prev, [transactionId]: value }));
  };

  const handleLiterInput = (transactionId: string, value: string) => {
    setLiterInputs(prev => ({ ...prev, [transactionId]: value }));
  };

  // Werte für die Anzeige - verwende Input-Werte oder gespeicherte Werte
  const getKilometerDisplayValue = (transaction: Transaction): string => {
    const inputValue = kmInputs[transaction.id];
    if (inputValue !== undefined) return inputValue;
    
    if (transaction.kilometerstand) {
      return transaction.kilometerstand.toLocaleString('de-DE');
    }
    return '';
  };

  const getLiterDisplayValue = (transaction: Transaction): string => {
    const inputValue = literInputs[transaction.id];
    if (inputValue !== undefined) return inputValue;
    
    if (transaction.liter !== undefined && transaction.liter !== null) {
      return transaction.liter.toString().replace('.', ',');
    }
    return '';
  };

  // Speicher-Funktion
  const handleSaveTankenData = async (transactionId: string) => {
    setSavingStates(prev => ({ ...prev, [transactionId]: true }));
    
    try {
      const kmInput = kmInputs[transactionId];
      const literInput = literInputs[transactionId];
      
      console.log('Starte Speicherung für Transaction:', transactionId);
      console.log('Kilometer Input:', kmInput);
      console.log('Liter Input:', literInput);
      
      // Speichere Kilometerstand
      if (kmInput !== undefined && kmInput.trim() !== '') {
        const kmValue = kmInput.replace(',', '.');
        const kmNumber = parseFloat(kmValue);
        if (!isNaN(kmNumber) && kmNumber >= 0) {
          console.log('Speichere Kilometerstand:', kmNumber);
          await updateKilometerstand(transactionId, kmNumber);
        }
      }
      
      // Speichere Liter
      if (literInput !== undefined && literInput.trim() !== '') {
        const literValue = literInput.replace(',', '.');
        const literNumber = parseFloat(literValue);
        if (!isNaN(literNumber) && literNumber >= 0) {
          console.log('Speichere Liter:', literNumber);
          await updateLiter(transactionId, literNumber);
        }
      }
      
      // Erfolgreich - lösche die Input-Werte
      setKmInputs(prev => {
        const newInputs = { ...prev };
        delete newInputs[transactionId];
        return newInputs;
      });
      
      setLiterInputs(prev => {
        const newInputs = { ...prev };
        delete newInputs[transactionId];
        return newInputs;
      });
      
      console.log('Speicherung erfolgreich abgeschlossen');
      
      // Daten neu laden um aktuelle Werte anzuzeigen
      const currentTransaction = months.flatMap(m => m.transactions || []).find(t => t.id === transactionId);
      if (currentTransaction) {
        const monthData = months.find(m => m.transactions?.some(t => t.id === transactionId));
        if (monthData) {
          await loadTransactionsForMonth(monthData.year, monthData.month);
        }
      }
      
    } catch (error) {
      console.error('Fehler beim Speichern:', error);
      alert('Fehler beim Speichern der Daten. Bitte versuchen Sie es erneut.');
    } finally {
      setSavingStates(prev => ({ ...prev, [transactionId]: false }));
    }
  };

  const handleKilometerstandChange = (transactionId: string, value: string) => {
    // Sofort im State für sofortige DOM-Aktualisierung
    setKmInputs(prev => ({
      ...prev,
  useImperativeHandle(ref, () => ({
    refreshData: loadAvailableMonths
  }));

  useEffect(() => {
    loadAvailableMonths();
  }, []);

  const loadAvailableMonths = async () => {
    try {
      const availableMonths = await getAvailableMonths();
      const currentDate = new Date();
      const currentMonthYear = currentDate.toLocaleDateString('de-DE', {
        month: 'long',
        year: 'numeric',
      });

      // Setze den aktuellen Monat standardmäßig als erweitert
      const monthsWithState = availableMonths.map(month => ({
        ...month,
        isExpanded: month.monthYear === currentMonthYear,
        transactions: undefined,
        isLoading: false
      }));

      setMonths(monthsWithState);

      // Lade Transaktionen für den aktuellen Monat sofort
      const currentMonth = monthsWithState.find(m => m.monthYear === currentMonthYear);
      if (currentMonth) {
        await loadTransactionsForMonth(currentMonth.year, currentMonth.month);
      }
    } catch (error) {
      console.error('Error loading available months:', error);
    } finally {
      setIsInitialLoading(false);
    }
  };

  const loadTransactionsForMonth = async (year: number, month: number) => {
    setMonths(prev => prev.map(m => 
      m.year === year && m.month === month 
        ? { ...m, isLoading: true }
        : m
    ));

    try {
      const transactions = await getTransactionsForMonth(year, month);
      
      setMonths(prev => prev.map(m => 
        m.year === year && m.month === month 
          ? { ...m, transactions, isLoading: false }
          : m
      ));
    } catch (error) {
      console.error('Error loading transactions for month:', error);
      setMonths(prev => prev.map(m => 
        m.year === year && m.month === month 
          ? { ...m, isLoading: false }
          : m
      ));
    }
  };

  const loadAllTransactionsForSearch = async () => {
    const monthsToLoad = months
      .filter(month => !month.transactions && !month.isLoading)
      .sort((a, b) => {
        // Sortiere nach Jahr und Monat, neueste zuerst
        if (a.year !== b.year) return b.year - a.year;
        return b.month - a.month;
      });
    
    if (monthsToLoad.length === 0) return;
    
    // Lade Monate sequenziell, beginnend mit dem neuesten
    for (const month of monthsToLoad) {
      const monthKey = `${month.year}-${month.month}`;
      
      // Setze Loading-State für den aktuellen Monat
      setSearchLoadingMonths(prev => new Set([...prev, monthKey]));
      
      try {
        const transactions = await getTransactionsForMonth(month.year, month.month);
        
        // Aktualisiere den Monat mit den geladenen Transaktionen
        setMonths(prev => prev.map(m => 
          m.year === month.year && m.month === month.month 
            ? { ...m, transactions, isLoading: false }
            : m
        ));
      } catch (error) {
        console.error(`Error loading transactions for ${monthKey}:`, error);
      } finally {
        // Entferne Loading-State für diesen Monat
        setSearchLoadingMonths(prev => {
          const newSet = new Set(prev);
          newSet.delete(monthKey);
          return newSet;
        });
      }
    }
  };

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    
    // Wenn der Suchterm geändert wird und es eine aktive Suche gab, klappe alles wieder ein
    if (activeSearchTerm.trim() && value !== activeSearchTerm) {
      const currentDate = new Date();
      const currentMonthYear = currentDate.toLocaleDateString('de-DE', {
        month: 'long',
        year: 'numeric',
      });
      setMonths(prev => prev.map(month => ({
        ...month,
        isExpanded: month.monthYear === currentMonthYear
      })));
    }
  };

  const hasSearchResults = (transactions: Transaction[], searchTerm: string): boolean => {
    if (!searchTerm.trim()) return false;
    
    const searchLower = searchTerm.toLowerCase();
    return transactions.some(transaction => {
      const matchesDescription = transaction.description.toLowerCase().includes(searchLower);
      const matchesLocation = transaction.location.toLowerCase().includes(searchLower);
      const matchesAmount = transaction.amount.toString().includes(searchTerm) ||
                           formatAmount(Math.abs(transaction.amount)).toLowerCase().includes(searchLower);
      const transactionDate = new Date(transaction.date);
      const dateString = transactionDate.toLocaleDateString('de-DE');
      const monthYear = transactionDate.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
      const matchesDate = dateString.includes(searchTerm) || 
                         monthYear.toLowerCase().includes(searchLower);
      return matchesDescription || matchesLocation || matchesAmount || matchesDate;
    });
  };

  const handleSearchSubmit = async () => {
    setActiveSearchTerm(searchTerm);
    
    // Wenn eine Suche eingegeben wird und nicht alle Monate geladen sind, lade sie
    if (searchTerm.trim() && months.some(month => !month.transactions)) {
      // Erweitere zuerst alle Monate für Loading-Spinner
      setMonths(prev => prev.map(month => ({ ...month, isExpanded: true })));
      await loadAllTransactionsForSearch();
    }
    
    // Nach dem Laden (oder wenn bereits geladen): Erweitere nur Monate mit Suchergebnissen
    if (searchTerm.trim()) {
      setMonths(prev => prev.map(month => {
        if (!month.transactions) {
          return { ...month, isExpanded: false };
        }
        
        const hasResults = hasSearchResults(month.transactions, searchTerm);
        return { ...month, isExpanded: hasResults };
      }));
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearchSubmit();
    }
  };

  const toggleMonth = async (year: number, month: number) => {
    const monthData = months.find(m => m.year === year && m.month === month);
    if (!monthData) return;

    const newExpandedState = !monthData.isExpanded;

    setMonths(prev => prev.map(m => 
      m.year === year && m.month === month 
        ? { ...m, isExpanded: newExpandedState }
        : m
    ));

    // Lade Transaktionen nur wenn erweitert wird und noch nicht geladen
    if (newExpandedState && !monthData.transactions && !monthData.isLoading) {
      await loadTransactionsForMonth(year, month);
    }
  };

  const sortTransactionsByAmount = (transactions: Transaction[]): Transaction[] => {
    const sorted = [...transactions].sort((a, b) => {
      // Erst nach Typ sortieren (expenses zuerst)
      if (a.type !== b.type) {
        return a.type === 'expense' ? -1 : 1;
      }
      
      // Stelle sicher, dass die Beträge als Zahlen behandelt werden
      const amountA = Number(a.amount);
      const amountB = Number(b.amount);
      
      if (a.type === 'expense') {
        // Für Ausgaben: Sortiere aufsteigend (da negative Werte, bedeutet das größte Ausgaben zuerst)
        // -100, -50, -20 -> größte Ausgabe zuerst
        console.log(`Expense: ${amountA} vs ${amountB}, Ergebnis: ${amountA - amountB}`);
        return amountA - amountB;
      } else {
        // Für Einnahmen: Sortiere absteigend (da positive Werte, bedeutet das größte Einnahmen zuerst)
        // 100, 50, 20 -> größte Einnahme zuerst
        console.log(`Income: ${amountA} vs ${amountB}, Ergebnis: ${amountB - amountA}`);
        return amountB - amountA;
      }
    });
    
    console.log('Sortierte Transaktionen:', sorted.map(t => `${t.type}: ${t.amount}`));
    return sorted;
  };

  const highlightSearchTerm = (text: string, searchTerm: string): React.ReactElement => {
    if (!searchTerm.trim()) {
      return <>{text}</>;
    }
    
    const regex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    
    return (
      <>
        {parts.map((part, index) => 
          regex.test(part) ? (
            <mark key={index} className="bg-yellow-400/30 text-yellow-200 rounded px-1">
              {part}
            </mark>
          ) : (
            part
          )
        )}
      </>
    );
  };

  const filterTransactions = (transactions: Transaction[]): Transaction[] => {
    // Nur filtern wenn der eingegebene Suchterm mit dem aktiven Suchterm übereinstimmt
    if (!activeSearchTerm.trim() || searchTerm !== activeSearchTerm) {
      return transactions;
    }
    
    const searchLower = activeSearchTerm.toLowerCase();
    return transactions.filter(transaction => {
      // Suche in Beschreibung und Ort
      const matchesDescription = transaction.description.toLowerCase().includes(searchLower);
      const matchesLocation = transaction.location.toLowerCase().includes(searchLower);
      
      // Suche nach Betrag (sowohl formatiert als auch roh)
      const matchesAmount = transaction.amount.toString().includes(activeSearchTerm) ||
                           formatAmount(Math.abs(transaction.amount)).toLowerCase().includes(searchLower);
      
      // Suche nach Datum (verschiedene Formate)
      const transactionDate = new Date(transaction.date);
      const dateString = transactionDate.toLocaleDateString('de-DE');
      const monthYear = transactionDate.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
      const matchesDate = dateString.includes(activeSearchTerm) || 
                         monthYear.toLowerCase().includes(searchLower);
      
      return matchesDescription || matchesLocation || matchesAmount || matchesDate;
    });
  };

  const formatAmount = (amount: number): string => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };

  if (isInitialLoading) {
    return (
      <div className="bg-white/5 backdrop-blur-lg rounded-2xl border border-white/10 p-8 shadow-2xl mt-8">
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-white mb-4">Transaktionen</h2>
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
            <span className="ml-3 text-slate-400">Lade Monate...</span>
          </div>
        </div>
      </div>
    );
  }

  if (months.length === 0) {
    return (
      <div className="bg-white/5 backdrop-blur-lg rounded-2xl border border-white/10 p-8 shadow-2xl mt-8">
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-white mb-4">Transaktionen</h2>
          <p className="text-slate-400">Noch keine Transaktionen vorhanden.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white/5 backdrop-blur-lg rounded-2xl border border-white/10 p-8 shadow-2xl mt-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
        <h2 className="text-2xl font-semibold text-white mb-4 sm:mb-0">Transaktionen</h2>
        
        {/* Suchfeld */}
        <div className="relative w-full sm:w-80">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            placeholder="Suchen nach Beschreibung, Ort, Betrag oder Datum... (Enter zum Suchen)"
            value={searchTerm}
            onChange={(e) => handleSearchChange(e.target.value)}
            onKeyPress={handleKeyPress}
            className="block w-full pl-10 pr-10 py-2 border border-slate-600/30 rounded-lg bg-slate-800/50 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
          />
          {searchTerm && (
            <button
              onClick={() => {
                handleSearchChange('');
                setActiveSearchTerm('');
                // Setze alle Monate auf den ursprünglichen Zustand zurück
                const currentDate = new Date();
                const currentMonthYear = currentDate.toLocaleDateString('de-DE', {
                  month: 'long',
                  year: 'numeric',
                });
                setMonths(prev => prev.map(month => ({
                  ...month,
                  isExpanded: month.monthYear === currentMonthYear
                })));
              }}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-white transition-colors"
              title="Suche löschen"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>
      
      <div className="space-y-8">
        {months.map((monthData) => (
          <div key={`${monthData.year}-${monthData.month}`}>
            {/* Monats-Header mit Klapp-Button */}
            <button
              onClick={() => toggleMonth(monthData.year, monthData.month)}
              className="w-full text-left mb-4 border-b border-slate-600/30 pb-2 hover:border-slate-500/50 transition-colors"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-slate-300">
                  {monthData.monthYear}
                  <span className="ml-2 text-sm text-slate-500">
                    ({(() => {
                      if (!monthData.transactions) return monthData.count;
                      const filteredCount = filterTransactions(monthData.transactions).length;
                      return (activeSearchTerm.trim() && searchTerm === activeSearchTerm)
                        ? `${filteredCount} von ${monthData.count}` 
                        : monthData.count;
                    })()} Transaktionen)
                  </span>
                </h3>
                <div className="text-slate-400 flex items-center">
                  {monthData.isLoading && (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  )}
                  <svg
                    className={`w-5 h-5 transform transition-transform ${
                      monthData.isExpanded ? 'rotate-180' : ''
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </div>
              </div>
            </button>
            
            {/* Transaktionen des Monats - nur anzeigen wenn erweitert */}
            {monthData.isExpanded && (
              <div className="space-y-3">
                {(monthData.isLoading || (activeSearchTerm.trim() && searchTerm === activeSearchTerm && !monthData.transactions && searchLoadingMonths.has(`${monthData.year}-${monthData.month}`))) && (
                  <div className="text-center py-8">
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                      <span className="ml-3 text-slate-400">
                        {(activeSearchTerm.trim() && searchTerm === activeSearchTerm) ? 'Lade Transaktionen für Suche...' : 'Lade Transaktionen...'}
                      </span>
                    </div>
                  </div>
                )}
                
                {monthData.transactions && !monthData.isLoading && !(activeSearchTerm.trim() && searchTerm === activeSearchTerm && searchLoadingMonths.has(`${monthData.year}-${monthData.month}`)) && (
                  <>
                    {(() => {
                      const filteredTransactions = filterTransactions(monthData.transactions);
                      const sortedTransactions = sortTransactionsByAmount(filteredTransactions);
                      
                      if (filteredTransactions.length === 0 && activeSearchTerm.trim() && searchTerm === activeSearchTerm) {
                        return (
                          <div className="text-center py-4 text-slate-400">
                            Keine Transaktionen gefunden für "{activeSearchTerm}".
                          </div>
                        );
                      }
                      
                      return sortedTransactions.map((transaction) => {
                        const isTanken = isTankenTransaction(transaction.description, transaction.type);
                        
                        return (
                          <div
                            key={transaction.id}
                            className="group bg-slate-800/30 border border-slate-600/30 rounded-lg p-4 hover:bg-slate-800/50 transition-all"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <div className="flex items-center space-x-4">
                                  <div className="flex-1">
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center space-x-3">
                                        <h3 className="text-white font-medium text-sm md:text-base">
                                          {highlightSearchTerm(transaction.description, searchTerm === activeSearchTerm ? activeSearchTerm : '')} • {highlightSearchTerm(transaction.location, searchTerm === activeSearchTerm ? activeSearchTerm : '')}
                                        </h3>
                                        {isTanken && (
                                          <div className="flex items-center space-x-2">
                                            <input
                                              type="text"
                                              value={getKilometerDisplayValue(transaction)}
                                              onChange={(e) => handleKilometerInput(transaction.id, e.target.value)}
                                              onBlur={() => {
                                                // Optional: Entferne lokale Eingabe wenn gewünscht
                                              }}
                                              onClick={(e) => e.stopPropagation()}
                                              className="w-24 px-2 py-1 text-xs bg-slate-700/50 border border-slate-600/30 rounded text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-transparent text-right"
                                            />
                                            <span className="text-xs text-slate-400">km</span>
                                            <input
                                              type="text"
                                              value={getLiterDisplayValue(transaction)}
                                              onChange={(e) => handleLiterInput(transaction.id, e.target.value)}
                                              onBlur={() => {
                                                // Optional: Entferne lokale Eingabe wenn gewünscht
                                              }}
                                              onClick={(e) => e.stopPropagation()}
                                              className="w-24 px-2 py-1 text-xs bg-slate-700/50 border border-slate-600/30 rounded text-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-transparent text-right"
                                            />
                                            <span className="text-xs text-slate-400">Liter</span>
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleSaveTankenData(transaction.id);
                                              }}
                                              disabled={savingStates[transaction.id]}
                                              className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 text-white rounded transition-colors focus:outline-none focus:ring-1 focus:ring-blue-500"
                                            >
                                              {savingStates[transaction.id] ? 'Speichert...' : 'Speichern'}
                                            </button>
                                          </div>
                                        )}
                                      </div>
                                      <div className="text-xs text-slate-400 ml-4">
                                        {highlightSearchTerm(new Date(transaction.date).toLocaleDateString('de-DE'), searchTerm === activeSearchTerm ? activeSearchTerm : '')}
                                      </div>
                                    </div>
                                  </div>
                                  
                                  <div className="flex items-center space-x-3">
                                    <div className="text-right">
                                      <div className={`text-base md:text-lg font-semibold ${
                                        transaction.type === 'income' 
                                          ? 'text-green-400' 
                                          : 'text-red-400'
                                      }`}>
                                        {transaction.type === 'income' ? '+' : '-'}{formatAmount(Math.abs(transaction.amount))}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </>
                )}
                
                {monthData.transactions && monthData.transactions.length === 0 && !monthData.isLoading && (
                  <div className="text-center py-4 text-slate-400">
                    Keine Transaktionen in diesem Monat gefunden.
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
});

LazyTransactionList.displayName = 'LazyTransactionList';