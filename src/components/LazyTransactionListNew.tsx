import { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import type { Transaction } from '../types/Transaction';
import { getTransactionsForMonth, getAvailableMonths, updateKilometerstand, updateLiter } from '../services/transactionService';

interface MonthData {
  year: number;
  month: number;
  monthYear: string;
  count: number;
  transactions?: Transaction[];
  isExpanded: boolean;
  isLoading: boolean;
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
  
  // Tanken-spezifische States
  const [kmInputs, setKmInputs] = useState<Record<string, string>>({});
  const [literInputs, setLiterInputs] = useState<Record<string, string>>({});
  const [savingStates, setSavingStates] = useState<Record<string, boolean>>({});

  // Prüft ob eine Transaktion eine Tanken-Transaktion ist
  const isTankenTransaction = (description: string, type: string): boolean => {
    if (type !== 'expense') return false;
    
    const lowerDescription = description.toLowerCase();
    const hasTanken = lowerDescription.includes('tanken');
    const hasTanke = lowerDescription.includes('tanke');
    const hasSprit = lowerDescription.includes('sprit') && !lowerDescription.includes('sprite');
    
    return hasTanken || hasTanke || hasSprit;
  };

  // Input-Handler für Kilometer
  const handleKilometerInput = (transactionId: string, value: string) => {
    setKmInputs(prev => ({ ...prev, [transactionId]: value }));
  };

  // Input-Handler für Liter
  const handleLiterInput = (transactionId: string, value: string) => {
    setLiterInputs(prev => ({ ...prev, [transactionId]: value }));
  };

  // Display-Werte für Kilometer
  const getKilometerDisplayValue = (transaction: Transaction): string => {
    const inputValue = kmInputs[transaction.id];
    if (inputValue !== undefined) return inputValue;
    
    if (transaction.kilometerstand) {
      return transaction.kilometerstand.toLocaleString('de-DE');
    }
    return '';
  };

  // Display-Werte für Liter
  const getLiterDisplayValue = (transaction: Transaction): string => {
    const inputValue = literInputs[transaction.id];
    if (inputValue !== undefined) return inputValue;
    
    if (transaction.liter !== undefined && transaction.liter !== null) {
      return transaction.liter.toString().replace('.', ',');
    }
    return '';
  };

  // Speicher-Funktion für Tanken-Daten
  const handleSaveTankenData = async (transactionId: string) => {
    setSavingStates(prev => ({ ...prev, [transactionId]: true }));
    
    try {
      const kmInput = kmInputs[transactionId];
      const literInput = literInputs[transactionId];
      
      console.log('Speichere Tanken-Daten für Transaction:', transactionId);
      console.log('Kilometer:', kmInput, 'Liter:', literInput);
      
      // Speichere Kilometerstand wenn vorhanden
      if (kmInput && kmInput.trim() !== '') {
        const kmValue = kmInput.replace(',', '.');
        const kmNumber = parseFloat(kmValue);
        if (!isNaN(kmNumber) && kmNumber >= 0) {
          console.log('Speichere Kilometerstand:', kmNumber);
          await updateKilometerstand(transactionId, kmNumber);
        }
      }
      
      // Speichere Liter wenn vorhanden
      if (literInput && literInput.trim() !== '') {
        const literValue = literInput.replace(',', '.');
        const literNumber = parseFloat(literValue);
        if (!isNaN(literNumber) && literNumber >= 0) {
          console.log('Speichere Liter:', literNumber);
          await updateLiter(transactionId, literNumber);
        }
      }
      
      // Erfolgreich - lösche Input-Werte
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
      
      console.log('Tanken-Daten erfolgreich gespeichert');
      
      // Lade die Transaktionen des Monats neu
      const transaction = months.flatMap(m => m.transactions || []).find(t => t.id === transactionId);
      if (transaction) {
        const transactionDate = new Date(transaction.date);
        await loadTransactionsForMonth(transactionDate.getFullYear(), transactionDate.getMonth() + 1);
      }
      
    } catch (error) {
      console.error('Fehler beim Speichern der Tanken-Daten:', error);
      alert('Fehler beim Speichern der Daten. Bitte versuchen Sie es erneut.');
    } finally {
      setSavingStates(prev => ({ ...prev, [transactionId]: false }));
    }
  };

  // Such-Handler
  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      setActiveSearchTerm(searchTerm);
      if (searchTerm.trim()) {
        searchInMonths();
      }
    }
  };

  // Lade verfügbare Monate
  const loadAvailableMonths = async () => {
    try {
      const availableMonths = await getAvailableMonths();
      const currentDate = new Date();
      const currentMonthYear = currentDate.toLocaleDateString('de-DE', {
        month: 'long',
        year: 'numeric',
      });

      const monthsWithState = availableMonths.map(month => ({
        ...month,
        isExpanded: month.monthYear === currentMonthYear,
        transactions: undefined,
        isLoading: false,
      }));

      setMonths(monthsWithState);
      setIsInitialLoading(false);
    } catch (error) {
      console.error('Error loading months:', error);
      setIsInitialLoading(false);
    }
  };

  // Lade Transaktionen für einen Monat
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
      console.error('Error loading transactions:', error);
      setMonths(prev => prev.map(m =>
        m.year === year && m.month === month
          ? { ...m, isLoading: false }
          : m
      ));
    }
  };

  // Such-Funktionalität
  const searchInMonths = async () => {
    const monthsToLoad = months
      .filter(month => !month.transactions && !month.isLoading)
      .sort((a, b) => {
        if (a.year !== b.year) return b.year - a.year;
        return b.month - a.month;
      });

    if (monthsToLoad.length === 0) return;

    for (const month of monthsToLoad) {
      const monthKey = `${month.year}-${month.month}`;
      setSearchLoadingMonths(prev => new Set([...prev, monthKey]));

      try {
        const transactions = await getTransactionsForMonth(month.year, month.month);
        setMonths(prev => prev.map(m =>
          m.year === month.year && m.month === month.month
            ? { ...m, transactions, isLoading: false }
            : m
        ));
      } catch (error) {
        console.error('Error loading transactions for search:', error);
      } finally {
        setSearchLoadingMonths(prev => {
          const newSet = new Set(prev);
          newSet.delete(monthKey);
          return newSet;
        });
      }
    }
  };

  // Monat ein-/ausklappen
  const toggleMonth = async (year: number, month: number) => {
    const monthData = months.find(m => m.year === year && m.month === month);
    if (!monthData) return;

    const newExpandedState = !monthData.isExpanded;
    setMonths(prev => prev.map(m => 
      m.year === year && m.month === month 
        ? { ...m, isExpanded: newExpandedState }
        : m
    ));

    if (newExpandedState && !monthData.transactions && !monthData.isLoading) {
      await loadTransactionsForMonth(year, month);
    }
  };

  // Transaktionen sortieren
  const sortTransactionsByAmount = (transactions: Transaction[]): Transaction[] => {
    return [...transactions].sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === 'expense' ? -1 : 1;
      }
      
      const amountA = Number(a.amount);
      const amountB = Number(b.amount);
      
      if (a.type === 'expense') {
        return amountA - amountB;
      } else {
        return amountB - amountA;
      }
    });
  };

  // Suchbegriff hervorheben
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

  // Transaktionen filtern
  const filterTransactions = (transactions: Transaction[]): Transaction[] => {
    if (!activeSearchTerm.trim() || searchTerm !== activeSearchTerm) {
      return transactions;
    }
    
    const searchLower = activeSearchTerm.toLowerCase();
    return transactions.filter(transaction => {
      const matchesDescription = transaction.description.toLowerCase().includes(searchLower);
      const matchesLocation = transaction.location.toLowerCase().includes(searchLower);
      const matchesAmount = transaction.amount.toString().includes(activeSearchTerm) ||
                           formatAmount(Math.abs(transaction.amount)).toLowerCase().includes(searchLower);
      
      const transactionDate = new Date(transaction.date);
      const dateString = transactionDate.toLocaleDateString('de-DE');
      const monthYear = transactionDate.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
      const matchesDate = dateString.includes(activeSearchTerm) || 
                         monthYear.toLowerCase().includes(searchLower);
      
      return matchesDescription || matchesLocation || matchesAmount || matchesDate;
    });
  };

  // Betrag formatieren
  const formatAmount = (amount: number): string => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };

  // Ref-Handler
  useImperativeHandle(ref, () => ({
    refreshData: loadAvailableMonths
  }));

  // Initial laden
  useEffect(() => {
    loadAvailableMonths();
  }, []);

  // Loading-Zustand
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

  // Leerer Zustand
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

  // Haupt-Render
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
            {/* Monats-Header */}
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
            
            {/* Transaktionen des Monats */}
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
                                              placeholder="km"
                                              value={getKilometerDisplayValue(transaction)}
                                              onChange={(e) => handleKilometerInput(transaction.id, e.target.value)}
                                              onClick={(e) => e.stopPropagation()}
                                              className="w-24 px-2 py-1 text-xs bg-slate-700/50 border border-slate-600/30 rounded text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-transparent text-right"
                                            />
                                            <span className="text-xs text-slate-400">km</span>
                                            <input
                                              type="text"
                                              placeholder="Liter"
                                              value={getLiterDisplayValue(transaction)}
                                              onChange={(e) => handleLiterInput(transaction.id, e.target.value)}
                                              onClick={(e) => e.stopPropagation()}
                                              className="w-24 px-2 py-1 text-xs bg-slate-700/50 border border-slate-600/30 rounded text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-transparent text-right"
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
