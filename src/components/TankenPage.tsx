import { useState, useEffect } from 'react';
import type { Transaction } from '../types/Transaction';
import { getTransactionsForMonth, getAvailableMonths } from '../services/transactionService';

export const TankenPage = () => {
  const [tankenTransactions, setTankenTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Text kürzen wenn länger als 30 Zeichen
  const truncateText = (text: string, maxLength: number = 30): string => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
  };

  useEffect(() => {
    loadAllTankenTransactions();
  }, []);

  const loadAllTankenTransactions = async () => {
    try {
      setIsLoading(true);
      
      // Lade alle verfügbaren Monate
      const availableMonths = await getAvailableMonths();
      
      // Lade Transaktionen für alle Monate parallel
      const allTransactionsPromises = availableMonths.map(month =>
        getTransactionsForMonth(month.year, month.month)
      );
      
      const allTransactionsArrays = await Promise.all(allTransactionsPromises);
      const allTransactions = allTransactionsArrays.flat();
      
      // Filtere nur Tanken-, Tanke- und Sprit-Transaktionen (nur Ausgaben)
      const tankenOnly = allTransactions.filter(transaction => {
        const isExpense = transaction.type === 'expense';
        const description = transaction.description.toLowerCase();
        const hasTanken = description.includes('tanken');
        const hasTanke = description.includes('tanke');
        const hasSprit = description.includes('sprit') && !description.includes('sprite');
        const isTankenOrSprit = hasTanken || hasTanke || hasSprit;
        return isExpense && isTankenOrSprit;
      });
      
      // Sortiere nach Datum (neueste zuerst)
      tankenOnly.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      
      setTankenTransactions(tankenOnly);
    } catch (error) {
      console.error('Error loading tanken transactions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatAmount = (amount: number): string => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };

  const calculateTotalAndAverage = () => {
    if (tankenTransactions.length === 0) return { total: 0, average: 0 };
    
    const total = tankenTransactions.reduce((sum, transaction) => sum + Math.abs(transaction.amount), 0);
    const average = total / tankenTransactions.length;
    
    return { total, average };
  };

  const { total, average } = calculateTotalAndAverage();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center px-4 pb-8">
        <div className="w-full max-w-4xl">
          <div className="bg-white/5 backdrop-blur-lg rounded-2xl border border-white/10 p-8 shadow-2xl">
            <div className="text-center">
              <h2 className="text-3xl font-bold text-white mb-4">Tanken & Sprit Übersicht</h2>
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                <span className="ml-3 text-slate-400">Lade Tanken & Sprit-Daten...</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center px-3 sm:px-4 pb-4 sm:pb-8">
      <div className="w-full max-w-4xl">
        {/* Hauptcontainer - Mobile optimiert */}
        <div className="bg-white/5 backdrop-blur-lg rounded-xl sm:rounded-2xl border border-white/10 p-4 sm:p-8 shadow-2xl">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 sm:mb-6">
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4 sm:mb-0">
              ⛽ Tanken & Sprit
            </h2>
            <div className="text-center sm:text-right">
              <div className="text-xs sm:text-sm text-slate-400">Gesamt ausgegeben</div>
              <div className="text-xl sm:text-2xl font-bold text-red-400">
                {formatAmount(total)}
              </div>
            </div>
          </div>

          {/* Statistiken - Mobile optimiert */}
          {tankenTransactions.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-6 sm:mb-8">
              <div className="bg-slate-800/30 border border-slate-600/30 rounded-lg p-3 sm:p-4">
                <div className="text-slate-400 text-xs sm:text-sm">Anzahl Tanken/Sprit-Käufe</div>
                <div className="text-xl sm:text-2xl font-semibold text-white">
                  {tankenTransactions.length}
                </div>
              </div>
              <div className="bg-slate-800/30 border border-slate-600/30 rounded-lg p-3 sm:p-4">
                <div className="text-slate-400 text-xs sm:text-sm">Durchschnitt pro Kauf</div>
                <div className="text-xl sm:text-2xl font-semibold text-orange-400">
                  {formatAmount(average)}
                </div>
              </div>
              <div className="bg-slate-800/30 border border-slate-600/30 rounded-lg p-3 sm:p-4">
                <div className="text-slate-400 text-xs sm:text-sm">Letzter Kauf</div>
                <div className="text-base sm:text-lg font-semibold text-blue-400">
                  {tankenTransactions.length > 0 
                    ? new Date(tankenTransactions[0].date).toLocaleDateString('de-DE')
                    : 'Keine Daten'
                  }
                </div>
              </div>
            </div>
          )}

          {/* Transaktionsliste */}
          <div className="space-y-2 sm:space-y-3">
            <h2 className="text-lg sm:text-xl font-semibold text-white mb-3 sm:mb-4">
              Alle Tanken & Sprit-Transaktionen ({tankenTransactions.length})
            </h2>
            
            {tankenTransactions.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                Keine Tanken- oder Sprit-Transaktionen gefunden.
              </div>
            ) : (
              tankenTransactions.map((transaction) => (
                <div
                  key={transaction.id}
                  className="group bg-slate-800/30 border border-slate-600/30 rounded-lg p-3 sm:p-4 hover:bg-slate-800/50 transition-all"
                >
                  <div className="flex items-start sm:items-center">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start sm:items-center flex-wrap gap-1 sm:gap-2">
                        <h3 className="text-white font-medium text-sm md:text-base break-words">
                          {truncateText(`${transaction.description} • ${transaction.location}`)}
                        </h3>
                        {/* Kilometerstand und Liter modern anzeigen */}
                        {(transaction.kilometerstand || transaction.liter) && (
                          <div className="flex items-center gap-1 sm:gap-2 mt-1 sm:mt-0">
                            {transaction.kilometerstand && (
                              <span className="inline-flex items-center px-1.5 sm:px-2 py-0.5 rounded-md text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                {transaction.kilometerstand.toLocaleString('de-DE')} km
                              </span>
                            )}
                            {transaction.liter && (
                              <span className="inline-flex items-center px-1.5 sm:px-2 py-0.5 rounded-md text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/20">
                                {transaction.liter.toString().replace('.', ',')} L
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      <span className="text-xs text-slate-500 mt-1 block">
                        {new Date(transaction.date).toLocaleDateString('de-DE')}
                      </span>
                    </div>
                    
                    <div className="text-right ml-2 sm:ml-0">
                      <div className="text-sm sm:text-base md:text-lg font-semibold text-red-400">
                        -{formatAmount(Math.abs(transaction.amount))}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
