import { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Transaction } from '../types/Transaction';
import { getTransactionsForMonth, getAvailableMonths } from '../services/transactionService';

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
  const [isSearchLoading, setIsSearchLoading] = useState(false);
  const navigate = useNavigate();

  const isTankenTransaction = (description: string, type: string): boolean => {
    // Nur bei Ausgaben (expenses) prüfen
    if (type !== 'expense') return false;
    
    const lowerDescription = description.toLowerCase();
    // Prüfe auf "tanken" oder "sprit" aber nicht "sprite"
    const hasTanken = lowerDescription.includes('tanken');
    const hasSprit = lowerDescription.includes('sprit') && !lowerDescription.includes('sprite');
    
    return hasTanken || hasSprit;
  };

  const handleTankenClick = () => {
    navigate('/tanken');
  };

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
    setIsSearchLoading(true);
    
    try {
      // Lade Transaktionen für alle Monate, die noch nicht geladen sind
      const loadPromises = months
        .filter(month => !month.transactions && !month.isLoading)
        .map(async (month) => {
          const transactions = await getTransactionsForMonth(month.year, month.month);
          return { 
            year: month.year, 
            month: month.month, 
            transactions 
          };
        });

      const loadedData = await Promise.all(loadPromises);
      
      // Aktualisiere die Monate mit den geladenen Transaktionen
      setMonths(prev => prev.map(month => {
        const loadedMonth = loadedData.find(
          loaded => loaded.year === month.year && loaded.month === month.month
        );
        
        if (loadedMonth) {
          return {
            ...month,
            transactions: loadedMonth.transactions,
            isLoading: false
          };
        }
        
        return month;
      }));
    } catch (error) {
      console.error('Error loading all transactions for search:', error);
    } finally {
      setIsSearchLoading(false);
    }
  };

  const handleSearchChange = async (value: string) => {
    setSearchTerm(value);
    
    // Wenn eine Suche eingegeben wird und nicht alle Monate geladen sind, lade sie
    if (value.trim() && months.some(month => !month.transactions)) {
      await loadAllTransactionsForSearch();
    }
    
    // Erweitere alle Monate wenn gesucht wird, damit Ergebnisse sichtbar sind
    if (value.trim()) {
      setMonths(prev => prev.map(month => ({ ...month, isExpanded: true })));
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
    if (!searchTerm.trim()) {
      return transactions;
    }
    
    const searchLower = searchTerm.toLowerCase();
    return transactions.filter(transaction => {
      // Suche in Beschreibung und Ort
      const matchesDescription = transaction.description.toLowerCase().includes(searchLower);
      const matchesLocation = transaction.location.toLowerCase().includes(searchLower);
      
      // Suche nach Betrag (sowohl formatiert als auch roh)
      const matchesAmount = transaction.amount.toString().includes(searchTerm) ||
                           formatAmount(Math.abs(transaction.amount)).toLowerCase().includes(searchLower);
      
      // Suche nach Datum (verschiedene Formate)
      const transactionDate = new Date(transaction.date);
      const dateString = transactionDate.toLocaleDateString('de-DE');
      const monthYear = transactionDate.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
      const matchesDate = dateString.includes(searchTerm) || 
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
            {isSearchLoading ? (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-slate-400"></div>
            ) : (
              <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            )}
          </div>
          <input
            type="text"
            placeholder="Suchen nach Beschreibung, Ort, Betrag oder Datum..."
            value={searchTerm}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="block w-full pl-10 pr-10 py-2 border border-slate-600/30 rounded-lg bg-slate-800/50 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
          />
          {searchTerm && (
            <button
              onClick={() => handleSearchChange('')}
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
                      return searchTerm.trim() 
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
                {monthData.isLoading && (
                  <div className="text-center py-4">
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                      <span className="ml-3 text-slate-400">Lade Transaktionen...</span>
                    </div>
                  </div>
                )}
                
                {monthData.transactions && !monthData.isLoading && (
                  <>
                    {(() => {
                      const filteredTransactions = filterTransactions(monthData.transactions);
                      const sortedTransactions = sortTransactionsByAmount(filteredTransactions);
                      
                      if (filteredTransactions.length === 0 && searchTerm.trim()) {
                        return (
                          <div className="text-center py-4 text-slate-400">
                            Keine Transaktionen gefunden für "{searchTerm}".
                          </div>
                        );
                      }
                      
                      return sortedTransactions.map((transaction) => {
                        const isTanken = isTankenTransaction(transaction.description, transaction.type);
                        
                        return (
                          <div
                            key={transaction.id}
                            className={`group bg-slate-800/30 border border-slate-600/30 rounded-lg p-4 transition-all ${
                              isTanken 
                                ? 'hover:bg-blue-800/30 hover:border-blue-500/50 cursor-pointer' 
                                : 'hover:bg-slate-800/50'
                            }`}
                            onClick={isTanken ? handleTankenClick : undefined}
                            title={isTanken ? 'Klicken für Tanken-Übersicht' : undefined}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <div className="flex items-center space-x-4">
                                  <div className="flex-1">
                                    <div className="flex items-center">
                                      <h3 className="text-white font-medium text-sm md:text-base">
                                        {highlightSearchTerm(transaction.description, searchTerm)} • {highlightSearchTerm(transaction.location, searchTerm)}
                                      </h3>
                                    </div>
                                    <div className="text-xs text-slate-400 mt-1">
                                      {highlightSearchTerm(new Date(transaction.date).toLocaleDateString('de-DE'), searchTerm)}
                                    </div>
                                  </div>
                                  
                                  <div className="flex items-center space-x-3">
                                    {isTanken && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleTankenClick();
                                        }}
                                        className="relative overflow-hidden px-3 py-1.5 bg-gradient-to-r from-blue-500/20 to-cyan-500/20 
                                                 border border-blue-400/30 rounded-lg backdrop-blur-sm 
                                                 hover:from-blue-500/30 hover:to-cyan-500/30 hover:border-blue-400/60 
                                                 transform hover:scale-105 transition-all duration-200 ease-out
                                                 opacity-0 group-hover:opacity-100"
                                        title="Tanken-Übersicht öffnen"
                                      >
                                        <div className="flex items-center space-x-1.5">
                                          <span className="text-blue-300 text-sm">⛽</span>
                                          <span className="text-blue-200 text-xs font-medium">Übersicht</span>
                                        </div>
                                        <div className="absolute inset-0 bg-gradient-to-r from-blue-400/10 to-cyan-400/10 
                                                      opacity-0 hover:opacity-100 transition-opacity duration-200"></div>
                                      </button>
                                    )}
                                    
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