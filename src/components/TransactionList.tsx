import React, { useState } from 'react';
import type { Transaction } from '../types/Transaction';

interface TransactionListProps {
  transactions: Transaction[];
  onDeleteTransaction: (transactionId: string) => void;
}

export const TransactionList: React.FC<TransactionListProps> = ({ transactions, onDeleteTransaction }) => {
  const [collapsedMonths, setCollapsedMonths] = useState<Set<string>>(new Set());

  const formatAmount = (amount: number): string => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };

  const getMonthYear = (date: string): string => {
    return new Date(date).toLocaleDateString('de-DE', {
      month: 'long',
      year: 'numeric',
    });
  };

  const getCurrentMonthYear = (): string => {
    return new Date().toLocaleDateString('de-DE', {
      month: 'long',
      year: 'numeric',
    });
  };

  const toggleMonth = (monthYear: string) => {
    setCollapsedMonths(prev => {
      const newSet = new Set(prev);
      if (newSet.has(monthYear)) {
        newSet.delete(monthYear);
      } else {
        newSet.add(monthYear);
      }
      return newSet;
    });
  };

  const isMonthCollapsed = (monthYear: string): boolean => {
    const currentMonth = getCurrentMonthYear();
    // Aktueller Monat ist standardmäßig aufgeklappt, alle anderen eingeklappt
    if (monthYear === currentMonth) {
      return collapsedMonths.has(monthYear);
    } else {
      return !collapsedMonths.has(monthYear);
    }
  };

  const groupTransactionsByMonth = (transactions: Transaction[]) => {
    const grouped = transactions.reduce((acc, transaction) => {
      const monthYear = getMonthYear(transaction.date);
      if (!acc[monthYear]) {
        acc[monthYear] = [];
      }
      acc[monthYear].push(transaction);
      return acc;
    }, {} as Record<string, Transaction[]>);

    // Sortiere die Gruppen nach Datum (neueste Monate zuerst)
    const sortedGroups = Object.entries(grouped).sort(([a], [b]) => {
      const dateA = new Date(transactions.find(t => getMonthYear(t.date) === a)!.date);
      const dateB = new Date(transactions.find(t => getMonthYear(t.date) === b)!.date);
      return dateB.getTime() - dateA.getTime();
    });

    return sortedGroups;
  };

  if (transactions.length === 0) {
    return (
      <div className="bg-white/5 backdrop-blur-lg rounded-2xl border border-white/10 p-8 shadow-2xl mt-8">
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-white mb-4">Transaktionen</h2>
          <p className="text-slate-400">Noch keine Transaktionen vorhanden.</p>
        </div>
      </div>
    );
  }

  // Gruppiere Transaktionen nach Monaten
  const groupedTransactions = groupTransactionsByMonth(transactions);

  return (
    <div className="bg-white/5 backdrop-blur-lg rounded-2xl border border-white/10 p-8 shadow-2xl mt-8">
      <h2 className="text-2xl font-semibold text-white mb-6">Transaktionen</h2>
      
      <div className="space-y-8">
        {groupedTransactions.map(([monthYear, monthTransactions]) => {
          // Filtere Business-Transaktionen aus (diese werden nur in Business-Übersicht angezeigt)
          const nonBusinessTransactions = monthTransactions.filter(transaction => transaction.isBusiness !== true);
          
          // Separiere Ausgaben und Einnahmen
          const expenses = nonBusinessTransactions.filter(t => t.type === 'expense');
          const incomes = nonBusinessTransactions.filter(t => t.type === 'income');
          
          // Sortiere Ausgaben und Einnahmen jeweils nach Betrag (größte Beträge zuerst)
          const sortedExpenses = [...expenses].sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
          const sortedIncomes = [...incomes].sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
          
          return (
            <div key={monthYear}>
              {/* Monats-Header mit Klapp-Button */}
              <button
                onClick={() => toggleMonth(monthYear)}
                className="w-full text-left mb-4 border-b border-slate-600/30 pb-2 hover:border-slate-500/50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium text-slate-300">
                    {monthYear}
                  </h3>
                  <div className="text-slate-400">
                    <svg
                      className={`w-5 h-5 transform transition-transform ${
                        isMonthCollapsed(monthYear) ? 'rotate-180' : ''
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
              
              {/* Transaktionen des Monats - nur anzeigen wenn nicht eingeklappt */}
              {!isMonthCollapsed(monthYear) && (
                <div className="space-y-6">
                  {/* Ausgaben Sektion */}
                  {sortedExpenses.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-red-300 mb-3 border-b border-red-400/20 pb-2">
                        Ausgaben ({sortedExpenses.length})
                      </h4>
                      <div className="space-y-3">
                        {sortedExpenses.map((transaction) => (
                          <div
                            key={transaction.id}
                            className="bg-slate-800/30 border border-slate-600/30 rounded-lg p-4 hover:bg-slate-800/50 transition-all"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <div className="flex items-center space-x-4">
                                  <div className="flex-1">
                                    <h3 className="text-white font-medium text-sm md:text-base flex items-center gap-2">
                                      <span>{transaction.description} • {transaction.location}</span>
                                      {transaction.isBusiness && (
                                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-600/20 text-blue-300 border border-blue-500/30">
                                          B
                                        </span>
                                      )}
                                    </h3>
                                  </div>
                                  
                                  <div className="text-right">
                                    <div className="text-base md:text-lg font-semibold text-red-400">
                                      -{formatAmount(Math.abs(transaction.amount))}
                                    </div>
                                  </div>

                                  <button
                                    onClick={() => onDeleteTransaction(transaction.id)}
                                    className="ml-4 p-2 text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded-lg transition-all"
                                    title="Transaktion löschen"
                                  >
                                    <svg
                                      className="w-4 h-4"
                                      fill="none"
                                      stroke="currentColor"
                                      viewBox="0 0 24 24"
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                      />
                                    </svg>
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Einnahmen Sektion */}
                  {sortedIncomes.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-green-300 mb-3 border-b border-green-400/20 pb-2">
                        Einnahmen ({sortedIncomes.length})
                      </h4>
                      <div className="space-y-3">
                        {sortedIncomes.map((transaction) => (
                          <div
                            key={transaction.id}
                            className="bg-slate-800/30 border border-slate-600/30 rounded-lg p-4 hover:bg-slate-800/50 transition-all"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <div className="flex items-center space-x-4">
                                  <div className="flex-1">
                                    <h3 className="text-white font-medium text-sm md:text-base flex items-center gap-2">
                                      <span>{transaction.description} • {transaction.location}</span>
                                      {transaction.isBusiness && (
                                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-600/20 text-blue-300 border border-blue-500/30">
                                          B
                                        </span>
                                      )}
                                    </h3>
                                  </div>
                                  
                                  <div className="text-right">
                                    <div className="text-base md:text-lg font-semibold text-green-400">
                                      +{formatAmount(Math.abs(transaction.amount))}
                                    </div>
                                  </div>

                                  <button
                                    onClick={() => onDeleteTransaction(transaction.id)}
                                    className="ml-4 p-2 text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded-lg transition-all"
                                    title="Transaktion löschen"
                                  >
                                    <svg
                                      className="w-4 h-4"
                                      fill="none"
                                      stroke="currentColor"
                                      viewBox="0 0 24 24"
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                      />
                                    </svg>
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
