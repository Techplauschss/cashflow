import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Transaction } from '../types/Transaction';
import { getTransactionsForMonth, getAvailableMonths } from '../services/transactionService';

export const TankenPage = () => {
  const [tankenTransactions, setTankenTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

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
      
      // Filtere nur Tanken-Transaktionen
      const tankenOnly = allTransactions.filter(transaction =>
        transaction.description.toLowerCase().includes('tanken')
      );
      
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
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-4">
        <div className="container mx-auto max-w-4xl">
          <div className="bg-white/5 backdrop-blur-lg rounded-2xl border border-white/10 p-8 shadow-2xl">
            <div className="text-center">
              <h1 className="text-3xl font-bold text-white mb-4">Tanken Übersicht</h1>
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                <span className="ml-3 text-slate-400">Lade Tanken-Daten...</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-4">
      <div className="container mx-auto max-w-4xl">
        {/* Header mit Zurück-Button */}
        <div className="mb-6">
          <button
            onClick={() => navigate('/')}
            className="flex items-center text-slate-300 hover:text-white transition-colors mb-4"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Zurück zur Übersicht
          </button>
        </div>

        {/* Hauptcontainer */}
        <div className="bg-white/5 backdrop-blur-lg rounded-2xl border border-white/10 p-8 shadow-2xl">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
            <h1 className="text-3xl font-bold text-white mb-4 sm:mb-0">
              ⛽ Tanken Übersicht
            </h1>
            <div className="text-right">
              <div className="text-sm text-slate-400">Gesamt ausgegeben</div>
              <div className="text-2xl font-bold text-red-400">
                {formatAmount(total)}
              </div>
            </div>
          </div>

          {/* Statistiken */}
          {tankenTransactions.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <div className="bg-slate-800/30 border border-slate-600/30 rounded-lg p-4">
                <div className="text-slate-400 text-sm">Anzahl Tankstellen-Besuche</div>
                <div className="text-2xl font-semibold text-white">
                  {tankenTransactions.length}
                </div>
              </div>
              <div className="bg-slate-800/30 border border-slate-600/30 rounded-lg p-4">
                <div className="text-slate-400 text-sm">Durchschnitt pro Tankfüllung</div>
                <div className="text-2xl font-semibold text-orange-400">
                  {formatAmount(average)}
                </div>
              </div>
              <div className="bg-slate-800/30 border border-slate-600/30 rounded-lg p-4">
                <div className="text-slate-400 text-sm">Letzter Tankbesuch</div>
                <div className="text-lg font-semibold text-blue-400">
                  {tankenTransactions.length > 0 
                    ? new Date(tankenTransactions[0].date).toLocaleDateString('de-DE')
                    : 'Keine Daten'
                  }
                </div>
              </div>
            </div>
          )}

          {/* Transaktionsliste */}
          <div className="space-y-3">
            <h2 className="text-xl font-semibold text-white mb-4">
              Alle Tanken-Transaktionen ({tankenTransactions.length})
            </h2>
            
            {tankenTransactions.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                Keine Tanken-Transaktionen gefunden.
              </div>
            ) : (
              tankenTransactions.map((transaction) => (
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
                            {new Date(transaction.date).toLocaleDateString('de-DE', {
                              weekday: 'long',
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric'
                            })}
                          </div>
                        </div>
                        
                        <div className="text-right">
                          <div className="text-base md:text-lg font-semibold text-red-400">
                            -{formatAmount(Math.abs(transaction.amount))}
                          </div>
                        </div>
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
