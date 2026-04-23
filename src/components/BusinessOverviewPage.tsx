import { useState, useEffect } from 'react';
import type { Transaction } from '../types/Transaction';
import { getTransactionsForMonth, getAvailableMonths, getOneTimeInvestmentsForYear } from '../services/transactionService';
import { DropdownMenu } from './DropdownMenu';
import { InlineTransactionForm } from './InlineTransactionForm';

interface MonthData {
  year: number;
  month: number;
  monthYear: string;
  count: number;
  businessCount: number;
  transactions?: Transaction[];
  businessTransactions?: Transaction[];
  isLoading: boolean;
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
  const [selectedYear, setSelectedYear] = useState<number | 'all'>(new Date().getFullYear());
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  
  const [oneTimeInvestments, setOneTimeInvestments] = useState<Transaction[]>([]);
  const [isOneTimeExpanded, setIsOneTimeExpanded] = useState(true);
  const [isLoadingOneTime, setIsLoadingOneTime] = useState(false);
  const [visibleInvestmentDates, setVisibleInvestmentDates] = useState<Set<string>>(new Set());



  // Betrag formatieren
  const formatAmount = (amount: number): string => {
    return new Intl.NumberFormat('de-DE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  const toggleInvestmentDateVisibility = (transactionId: string) => {
    setVisibleInvestmentDates(prev => {
      const newSet = new Set(prev);
      if (newSet.has(transactionId)) {
        newSet.delete(transactionId);
      } else {
        newSet.add(transactionId);
      }
      return newSet;
    });
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
      
      // Extrahiere verfügbare Jahre
      const years = [...new Set(availableMonths.map(month => month.year))].sort((a, b) => b - a);
      setAvailableYears(years);

      // Lade alle Monate parallel
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

  // Listener für Änderungen an Transaktionen (z.B. aus Modal in App.tsx)
  useEffect(() => {
    const handleTransactionChanged = () => {
      loadAvailableMonths();
      if (isOneTimeExpanded) {
        loadOneTimeInvestments(selectedYear);
      }
    };
    window.addEventListener('transaction-changed', handleTransactionChanged);
    return () => window.removeEventListener('transaction-changed', handleTransactionChanged);
  }, [selectedYear, isOneTimeExpanded]);

  // Lade Einzelinvestitionen für die Business-Ansicht
  const loadOneTimeInvestments = async (year: number | 'all') => {
    setIsLoadingOneTime(true);
    try {
      let investments: Transaction[] = [];
      if (year === 'all') {
        const promises = availableYears.map(y => getOneTimeInvestmentsForYear(y));
        const results = await Promise.all(promises);
        investments = results.flat();
      } else {
        investments = await getOneTimeInvestmentsForYear(year);
      }
      const businessInvestments = investments.filter(t => t.isBusiness === true && !isHMTransaction(t.description));
      setOneTimeInvestments(sortTransactionsByAmount(businessInvestments));
    } catch (error) {
      console.error('Error loading one-time investments:', error);
    } finally {
      setIsLoadingOneTime(false);
    }
  };

  const toggleOneTime = async () => {
    const newExpandedState = !isOneTimeExpanded;
    setIsOneTimeExpanded(newExpandedState);
    if (newExpandedState && oneTimeInvestments.length === 0) {
      await loadOneTimeInvestments(selectedYear);
    }
  };

  useEffect(() => {
    setIsOneTimeExpanded(true);
    if (selectedYear !== 'all' || availableYears.length > 0) {
      loadOneTimeInvestments(selectedYear);
    }
  }, [selectedYear, availableYears]);

  // Filtere Monate nach ausgewähltem Jahr
  const filteredMonths = selectedYear === 'all' 
    ? months.filter(month => month.businessCount > 0) // Nur Monate mit Business-Transaktionen
    : months.filter(month => month.year === selectedYear && month.businessCount > 0);



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
          <div className="flex flex-col space-y-6 mb-6">
            <div className="flex items-center space-x-4">
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

            {/* Transaction Form - Full Width */}
            {onAddTransaction && (
              <div className="w-full">
                <InlineTransactionForm
                  prefilledData={{ isBusiness: true }}
                  onSaved={() => loadAvailableMonths()}
                />
              </div>
            )}
          </div>



          {/* Monatsweise Aufschlüsselung */}
          <div className="space-y-6">
            {filteredMonths.map((monthData) => (
              <div key={`${monthData.year}-${monthData.month}`}>
                {/* Monats-Header */}
                <div className="mb-4 border-b border-slate-600/30 pb-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium text-slate-300">
                      {monthData.monthYear}
                      <span className="ml-2 text-sm text-slate-500">
                        ({monthData.businessCount} Geschäftstransaktionen)
                      </span>
                    </h3>
                    <div className="text-right">
                      <div className={`text-lg font-semibold ${monthData.balance >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {monthData.balance >= 0 ? '+' : ''}{formatAmount(monthData.balance)}€
                      </div>
                      <div className="text-xs text-slate-400">
                        +{formatAmount(monthData.income)}€ | -{formatAmount(monthData.expenses)}€
                      </div>
                    </div>
                  </div>
                </div>

                {/* Transaktionen */}
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
              </div>
            ))}
          </div>

          {/* Einzelinvestitionen Section */}
          {(selectedYear !== 'all' || availableYears.length > 0) && (
            <div className="mt-6 border-t border-slate-600/30 pt-6">
              <button
                onClick={toggleOneTime}
                className="w-full text-left mb-2 pb-1 transition-colors group flex items-center justify-between"
              >
                <h3 className="text-lg font-medium text-purple-300 group-hover:text-purple-200">
                  Einzelinvestitionen {selectedYear === 'all' ? 'Alle Jahre' : selectedYear}
                  {oneTimeInvestments && oneTimeInvestments.length > 0 && (
                    <span className="ml-2 text-sm text-purple-400/70">
                      ({oneTimeInvestments.length} Transaktionen)
                    </span>
                  )}
                </h3>
                <div className="text-purple-400/70 flex items-center">
                  {isLoadingOneTime && (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-400 mr-2"></div>
                  )}
                  <svg
                    className={`w-5 h-5 transform transition-transform ${
                      isOneTimeExpanded ? 'rotate-180' : ''
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </button>
              
              {isOneTimeExpanded && (
                <div className="space-y-3 mt-4">
                  {isLoadingOneTime ? (
                    <div className="text-center py-4">
                      <div className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-400"></div>
                        <span className="ml-3 text-slate-400">Lade Investitionen...</span>
                      </div>
                    </div>
                  ) : (
                    <>
                      {oneTimeInvestments.length === 0 ? (
                        <div className="text-center py-4 text-slate-400">
                          Keine geschäftlichen Einzelinvestitionen gefunden.
                        </div>
                      ) : (
                        <>
                          {oneTimeInvestments.map((transaction) => (
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
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-purple-600/20 text-purple-300 border border-purple-500/30">
                                      I
                                    </span>
                                  </div>
                                  <div className="text-xs text-slate-400 mt-1 flex items-center gap-2">
                                    <button
                                      onClick={() => toggleInvestmentDateVisibility(transaction.id)}
                                      className="text-slate-500 hover:text-slate-300 transition-colors"
                                      title="Datum anzeigen/verbergen"
                                    >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                        {visibleInvestmentDates.has(transaction.id) ? (
                                          <>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.01 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.01-9.963-7.178z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                          </>
                                        ) : (
                                          <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                                        )}
                                      </svg>
                                    </button>
                                    {visibleInvestmentDates.has(transaction.id) && (
                                      <span>{new Date(transaction.date).toLocaleDateString('de-DE')}</span>
                                    )}
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
                        </>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};