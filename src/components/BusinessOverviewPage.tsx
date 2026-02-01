import { useState, useEffect } from 'react';
import type { Transaction } from '../types/Transaction';
import { getTransactionsForMonth, getAvailableMonths } from '../services/transactionService';
import { DropdownMenu } from './DropdownMenu';

interface MonthData {
  year: number;
  month: number;
  monthYear: string;
  count: number;
  businessCount: number;
  transactions?: Transaction[];
  businessTransactions?: Transaction[];
  isLoading: boolean;
  isExpanded?: boolean;
  income: number;
  expenses: number;
  balance: number;
}

interface BusinessOverviewPageProps {
  onDeleteTransaction?: (transactionId: string) => void;
  onEditTransaction?: (transaction: any) => void;
  onAddTransaction?: (transaction: Partial<Transaction>) => void;
}

export const BusinessOverviewPage = ({ onDeleteTransaction, onEditTransaction, onAddTransaction }: BusinessOverviewPageProps) => {
  const [months, setMonths] = useState<MonthData[]>([]);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [availableYears, setAvailableYears] = useState<number[]>([]);



  // Betrag formatieren
  const formatAmount = (amount: number): string => {
    return new Intl.NumberFormat('de-DE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  // Prüft ob eine Transaktion eine H+M-Transaktion ist
  const isHMTransaction = (description: string): boolean => {
    return description.startsWith('H+') || description.startsWith('M+');
  };

  // Business-Transaktionen filtern (ohne H+M-Transaktionen)
  const getBusinessTransactions = (transactions: Transaction[]): Transaction[] => {
    return transactions.filter(transaction => 
      transaction.isBusiness === true && !isHMTransaction(transaction.description)
    );
  };

  // Berechnet Bilanz für Business-Transaktionen
  const calculateBusinessBalance = (transactions: Transaction[]) => {
    const businessTransactions = getBusinessTransactions(transactions);
    let income = 0;
    let expenses = 0;
    
    businessTransactions.forEach(transaction => {
      const absoluteAmount = Math.abs(transaction.amount);
      if (transaction.type === 'income') {
        income += absoluteAmount;
      } else {
        expenses += absoluteAmount;
      }
    });
    
    return {
      income,
      expenses,
      balance: income - expenses,
      count: businessTransactions.length
    };
  };

  // Transaktionen nach Betrag sortieren
  const sortTransactionsByAmount = (transactions: Transaction[]): Transaction[] => {
    return [...transactions].sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
  };

  // Lade verfügbare Monate
  const loadAvailableMonths = async () => {
    try {
      const availableMonths = await getAvailableMonths();
      
      // Extrahiere verfügbare Jahre und setze Standard auf das neueste Jahr
      const years = [...new Set(availableMonths.map(month => month.year))].sort((a, b) => b - a);
      setAvailableYears(years);
      setSelectedYear(years[0] ?? new Date().getFullYear());

      // Lade alle Monate parallel
      const currentMonthYear = new Date().toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });

      const monthsWithData = await Promise.all(
        availableMonths.map(async (month) => {
          try {
            const transactions = await getTransactionsForMonth(month.year, month.month);
            const businessBalance = calculateBusinessBalance(transactions);
            const businessTransactions = getBusinessTransactions(transactions);
            
            return {
              ...month,
              transactions,
              businessTransactions,
              businessCount: businessBalance.count,
              isExpanded: month.monthYear === currentMonthYear,
              income: businessBalance.income,
              expenses: businessBalance.expenses,
              balance: businessBalance.balance,
              isLoading: false,
            };
          } catch (error) {
            console.error(`Fehler beim Laden der Transaktionen für ${month.monthYear}:`, error);
            return {
              ...month,
              transactions: [],
              businessTransactions: [],
              businessCount: 0,
              isExpanded: month.monthYear === currentMonthYear,
              income: 0,
              expenses: 0,
              balance: 0,
              isLoading: false,
            };
          }
        })
      );

      setMonths(monthsWithData);
      setIsInitialLoading(false);
    } catch (error) {
      console.error('Error loading months:', error);
      setIsInitialLoading(false);
    }
  };

  useEffect(() => {
    loadAvailableMonths();
  }, []);

  // Filtere Monate nach ausgewähltem Jahr (keine 'Alle Jahre' mehr)
  const selectedYearValue = selectedYear ?? new Date().getFullYear();
  const filteredMonths = months.filter(month => month.year === selectedYearValue && month.businessCount > 0);

  const toggleMonth = (monthYear: string) => {
    setMonths(prev => prev.map(m => m.monthYear === monthYear ? { ...m, isExpanded: !m.isExpanded } : m));
  };



  if (isInitialLoading) {
    return (
      <div className="flex items-center justify-center px-3 sm:px-4 pb-4 sm:pb-8">
        <div className="w-full max-w-4xl">
          <div className="bg-white/5 backdrop-blur-lg rounded-xl sm:rounded-2xl border border-white/10 p-8 shadow-2xl">
            <div className="text-center">
              <h2 className="text-2xl font-semibold text-white mb-4">Geschäftsübersicht</h2>
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                <span className="ml-3 text-slate-400">Lade Geschäftstransaktionen...</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (filteredMonths.length === 0) {
    return (
      <div className="flex items-center justify-center px-3 sm:px-4 pb-4 sm:pb-8">
        <div className="w-full max-w-4xl">
          <div className="bg-white/5 backdrop-blur-lg rounded-xl sm:rounded-2xl border border-white/10 p-8 shadow-2xl">
            <div className="text-center">
              <h2 className="text-2xl font-semibold text-white mb-4">Geschäftsübersicht</h2>
              <p className="text-slate-400">
                {selectedYear === 'all' 
                  ? 'Keine Geschäftstransaktionen gefunden.' 
                  : `Keine Geschäftstransaktionen für ${selectedYear} gefunden.`}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center px-3 sm:px-4 pb-4 sm:pb-8">
      <div className="w-full max-w-4xl">
        <div className="bg-white/5 backdrop-blur-lg rounded-xl sm:rounded-2xl border border-white/10 p-8 shadow-2xl">
          {/* Header */}
          <div className="flex flex-col space-y-4 mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center space-x-4 mb-4 sm:mb-0">
                <h2 className="text-2xl font-semibold text-white">🏢 Geschäftsübersicht</h2>
                
                {/* Jahresauswahl */}
                {availableYears.length > 0 && (
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(e.target.value === 'all' ? 'all' : parseInt(e.target.value))}
                    className="px-3 py-1 bg-slate-800 border border-slate-600 rounded text-white text-sm"
                  >
                    <option value="all">Alle Jahre</option>
                    {availableYears.map(year => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              {onAddTransaction && (
                <button
                  onClick={() => onAddTransaction({ isBusiness: true })}
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-all"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span>Hinzufügen</span>
                </button>
              )}
            </div>
          </div>



          {/* Monatsweise Aufschlüsselung */}
          <div className="space-y-6">
            {filteredMonths.map((monthData) => (
              <div key={`${monthData.year}-${monthData.month}`}>
                {/* Monats-Header (klickbar zum Ein-/Ausklappen) */}
                <button
                  onClick={() => toggleMonth(monthData.monthYear)}
                  className="w-full text-left mb-4 border-b border-slate-600/30 pb-2 hover:border-slate-500/50 transition-colors flex items-center justify-between"
                >
                  <div className="flex items-center space-x-3">
                    <h3 className="text-lg font-medium text-slate-300">
                      {monthData.monthYear}
                      <span className="ml-2 text-sm text-slate-500">
                        ({monthData.businessCount} Geschäftstransaktionen)
                      </span>
                    </h3>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className={`text-lg font-semibold ${monthData.balance >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {monthData.balance >= 0 ? '+' : ''}{formatAmount(monthData.balance)}€
                      </div>
                      <div className="text-xs text-slate-400">
                        +{formatAmount(monthData.income)}€ | -{formatAmount(monthData.expenses)}€
                      </div>
                    </div>
                    <svg
                      className={`w-5 h-5 transform transition-transform text-slate-400 ${monthData.isExpanded ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>

                {/* Transaktionen (einklappbar) */}
                {monthData.isExpanded && (
                  <div className="space-y-3">
                    {monthData.businessTransactions && sortTransactionsByAmount(monthData.businessTransactions).map((transaction) => (
                      <div
                        key={transaction.id}
                        className="group bg-slate-800/30 border border-slate-600/30 rounded-lg p-4 hover:bg-slate-800/50 transition-all"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-3">
                              <h4 className="text-white font-medium text-sm">
                                {transaction.description} • {transaction.location}
                              </h4>
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-600/20 text-blue-300 border border-blue-500/30">
                                B
                              </span>
                            </div>
                            <div className="text-xs text-slate-400 mt-1">
                              {new Date(transaction.date).toLocaleDateString('de-DE')}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className={`text-lg font-semibold ${
                              transaction.type === 'income' ? 'text-green-400' : 'text-red-400'
                            }`}>
                              {transaction.type === 'income' ? '+' : '-'}{formatAmount(Math.abs(transaction.amount))}€
                            </div>
                          </div>

                          {(onEditTransaction || onDeleteTransaction) && (
                            <div className="ml-3 opacity-60 group-hover:opacity-100 transition-opacity">
                              <DropdownMenu
                                trigger={
                                  <button
                                    className="p-2 text-slate-400 hover:text-slate-300 hover:bg-slate-700/50 rounded-lg transition-all"
                                    title="Aktionen"
                                  >
                                    <svg
                                      className="w-4 h-4"
                                      fill="currentColor"
                                      viewBox="0 0 24 24"
                                    >
                                      <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
                                    </svg>
                                  </button>
                                }
                                items={[
                                  ...(onEditTransaction ? [{
                                    label: 'Bearbeiten',
                                    icon: (
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                      </svg>
                                    ),
                                    onClick: () => onEditTransaction(transaction),
                                    variant: 'default' as const
                                  }] : []),
                                  ...(onDeleteTransaction ? [{
                                    label: 'Löschen',
                                    icon: (
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                      </svg>
                                    ),
                                    onClick: () => onDeleteTransaction(transaction.id),
                                    variant: 'destructive' as const
                                  }] : [])
                                ]}
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};