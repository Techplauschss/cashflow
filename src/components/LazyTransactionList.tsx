import { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
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
      <h2 className="text-2xl font-semibold text-white mb-6">Transaktionen</h2>
      
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
                    ({monthData.count} Transaktionen)
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
                    {sortTransactionsByAmount(monthData.transactions)
                      .map((transaction) => (
                        <div
                          key={transaction.id}
                          className="bg-slate-800/30 border border-slate-600/30 rounded-lg p-4 hover:bg-slate-800/50 transition-all"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center space-x-4">
                                <div className="flex-1">
                                  <h3 className="text-white font-medium text-sm md:text-base">
                                    {transaction.description} • {transaction.location}
                                  </h3>
                                  <div className="text-xs text-slate-400 mt-1">
                                    {new Date(transaction.date).toLocaleDateString('de-DE')}
                                  </div>
                                </div>
                                
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
                      ))}
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