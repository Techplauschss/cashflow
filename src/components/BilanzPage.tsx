import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import type { Transaction } from '../types/Transaction';
import { getAvailableMonths, getTransactionsForMonth } from '../services/transactionService';

interface MonthBalance {
  year: number;
  month: number;
  monthYear: string;
  income: number;
  expenses: number;
  balance: number;
}

export const BilanzPage = () => {
  const [monthBalances, setMonthBalances] = useState<MonthBalance[]>([]);
  const [selectedYear, setSelectedYear] = useState<number | 'all'>(new Date().getFullYear());
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showOnlyBusiness, setShowOnlyBusiness] = useState(false);

  // Aktuelles Datum für Filter
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth() + 1; // getMonth() gibt 0-11 zurück, wir brauchen 1-12

  // Formatiert Beträge für die Anzeige
  const formatAmount = (amount: number): string => {
    return Math.abs(amount).toLocaleString('de-DE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  // Prüft ob eine Transaktion eine H+M-Transaktion ist
  const isHMTransaction = (description: string): boolean => {
    return description.startsWith('H+') || description.startsWith('M+');
  };

  // Berechnet die Bilanz für Transaktionen
  const calculateBalance = (transactions: Transaction[]) => {
    let income = 0;
    let expenses = 0;
    
    // Erst H+M Transaktionen herausfiltern
    let filteredTransactions = transactions.filter(transaction => 
      !isHMTransaction(transaction.description)
    );
    
    // Business-Filter anwenden
    if (showOnlyBusiness) {
      // Wenn Business-Toggle aktiviert ist, nur Business-Transaktionen zeigen
      filteredTransactions = filteredTransactions.filter(transaction => transaction.isBusiness === true);
    } else {
      // Standardmäßig Business-Transaktionen ausblenden (nur private Transaktionen)
      filteredTransactions = filteredTransactions.filter(transaction => transaction.isBusiness !== true);
    }
    
    filteredTransactions.forEach(transaction => {
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
      balance: income - expenses
    };
  };

  // Lädt alle Monate und berechnet Bilanzen
  const loadBalances = async () => {
    setIsLoading(true);
    try {
      const months = await getAvailableMonths();
      
      // Filtere den aktuellen Monat aus
      const filteredMonths = months.filter(month => {
        // Schließe den aktuellen Monat aus der Bilanz aus
        return !(month.year === currentYear && month.month === currentMonth);
      });
      
      const years = [...new Set(filteredMonths.map(m => m.year))].sort((a, b) => b - a);
      setAvailableYears(years);

      // Lade Transaktionen für alle Monate (außer dem aktuellen)
      const balances: MonthBalance[] = [];
      
      for (const month of filteredMonths) {
        try {
          const transactions = await getTransactionsForMonth(month.year, month.month);
          const balance = calculateBalance(transactions);
          
          balances.push({
            year: month.year,
            month: month.month,
            monthYear: month.monthYear,
            income: balance.income,
            expenses: balance.expenses,
            balance: balance.balance
          });
        } catch (error) {
          console.error(`Fehler beim Laden der Transaktionen für ${month.monthYear}:`, error);
        }
      }
      
      setMonthBalances(balances);
    } catch (error) {
      console.error('Fehler beim Laden der Monate:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadBalances();
  }, [showOnlyBusiness]); // Lade Daten neu, wenn sich der Business-Filter ändert

  // Filtert Bilanzen nach ausgewähltem Jahr
  const filteredBalances = selectedYear === 'all' 
    ? monthBalances 
    : monthBalances.filter(balance => balance.year === selectedYear);

  // Berechnet Jahresgesamtwerte
  const yearTotal = filteredBalances.reduce((acc, balance) => ({
    income: acc.income + balance.income,
    expenses: acc.expenses + balance.expenses,
    balance: acc.balance + balance.balance
  }), { income: 0, expenses: 0, balance: 0 });

  // Bereite Chart-Daten vor
  const chartData = filteredBalances
    .sort((a, b) => a.month - b.month) // Sortiere nach Monat für Charts
    .map(balance => ({
      month: new Date(balance.year, balance.month - 1).toLocaleDateString('de-DE', { month: 'short' }),
      Einnahmen: balance.income,
      Ausgaben: balance.expenses,
      Bilanz: balance.balance
    }));

  // Pie Chart Daten für Jahresübersicht
  const pieData = yearTotal.income > 0 || yearTotal.expenses > 0 ? [
    { name: 'Einnahmen', value: yearTotal.income, color: '#4ade80' },
    { name: 'Ausgaben', value: yearTotal.expenses, color: '#f87171' }
  ] : [];

  // Custom Tooltip für Charts
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-800 border border-slate-600 rounded-lg p-3 shadow-lg">
          <p className="text-white font-medium">{`${label}`}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color }} className="text-sm">
              {`${entry.dataKey}: ${formatAmount(Math.abs(entry.value))}€`}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center px-3 sm:px-4 pb-4 sm:pb-8">
        <div className="w-full max-w-4xl">
          <div className="bg-white/5 backdrop-blur-lg rounded-xl sm:rounded-2xl border border-white/10 p-4 sm:p-8 shadow-2xl">
            <div className="text-center">
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                <span className="ml-3 text-slate-400">Lade Bilanzen...</span>
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
        <div className="bg-white/5 backdrop-blur-lg rounded-xl sm:rounded-2xl border border-white/10 p-4 sm:p-8 shadow-2xl">
          {/* Header mit Jahresauswahl und Business-Filter */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <h2 className="text-xl sm:text-2xl font-semibold text-white">Bilanzen</h2>
              
              {/* Jahresauswahl */}
              {availableYears.length > 0 && (
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value === 'all' ? 'all' : parseInt(e.target.value))}
                  className="px-3 py-1 bg-slate-800 border border-slate-600 rounded text-white text-sm"
                >
                  <option value="all">Alle Transaktionen</option>
                  {availableYears.map(year => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              )}
              
              {/* Business Toggle Switch */}
              <div className="flex items-center space-x-2">
                <span className="text-sm text-slate-400 whitespace-nowrap">Business</span>
                <button
                  type="button"
                  onClick={() => setShowOnlyBusiness(!showOnlyBusiness)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-900 ${
                    showOnlyBusiness ? 'bg-blue-600' : 'bg-slate-600'
                  }`}
                  title={showOnlyBusiness ? "Alle Transaktionen anzeigen" : "Nur Geschäftstransaktionen anzeigen"}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ${
                      showOnlyBusiness ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>

          {/* Jahresübersicht */}
          {filteredBalances.length > 0 && (
            <div className="mb-6 sm:mb-8">
              <h3 className="text-base sm:text-lg font-medium text-white mb-3 sm:mb-4">
                {selectedYear === 'all' ? 'Gesamtübersicht aller Transaktionen' : `Jahresübersicht ${selectedYear}`}
              </h3>
              <div className="bg-slate-700/30 rounded-lg p-3 sm:p-4 md:p-6">
                <div className="grid grid-cols-3 gap-2 sm:gap-4 text-center">
                  <div>
                    <div className="text-lg sm:text-2xl md:text-3xl font-bold text-green-400">
                      +{formatAmount(yearTotal.income)}
                    </div>
                    <div className="text-slate-400 text-xs sm:text-sm mt-1">Einnahmen</div>
                  </div>
                  <div>
                    <div className="text-lg sm:text-2xl md:text-3xl font-bold text-red-400">
                      -{formatAmount(yearTotal.expenses)}
                    </div>
                    <div className="text-slate-400 text-xs sm:text-sm mt-1">Ausgaben</div>
                  </div>
                  <div>
                    <div className={`text-lg sm:text-2xl md:text-3xl font-bold ${yearTotal.balance >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {yearTotal.balance >= 0 ? '+' : ''}{formatAmount(yearTotal.balance)}
                    </div>
                    <div className="text-slate-400 text-xs sm:text-sm mt-1">Bilanz</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Charts */}
          {chartData.length > 0 && (
            <div className="mb-8 space-y-6 sm:space-y-8">
              {/* Balkendiagramm - Monatsverlauf */}
              <div className="bg-slate-700/30 rounded-lg p-3 sm:p-4 md:p-6">
                <h3 className="text-base sm:text-lg font-medium text-white mb-3 sm:mb-4">Monatsverlauf</h3>
                <div className="h-64 sm:h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis 
                        dataKey="month" 
                        tick={{ fill: '#9ca3af', fontSize: 10 }} 
                        className="text-xs sm:text-sm"
                      />
                      <YAxis 
                        tick={{ fill: '#9ca3af', fontSize: 10 }} 
                        className="text-xs sm:text-sm"
                        width={50}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="Einnahmen" fill="#4ade80" radius={[2, 2, 0, 0]} />
                      <Bar dataKey="Ausgaben" fill="#f87171" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Liniendiagramm - Bilanz-Trend */}
              <div className="bg-slate-700/30 rounded-lg p-3 sm:p-4 md:p-6">
                <h3 className="text-base sm:text-lg font-medium text-white mb-3 sm:mb-4">Bilanz-Trend</h3>
                <div className="h-48 sm:h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis 
                        dataKey="month" 
                        tick={{ fill: '#9ca3af', fontSize: 10 }} 
                        className="text-xs sm:text-sm"
                      />
                      <YAxis 
                        tick={{ fill: '#9ca3af', fontSize: 10 }} 
                        className="text-xs sm:text-sm"
                        width={50}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Line 
                        type="monotone" 
                        dataKey="Bilanz" 
                        stroke="#60a5fa" 
                        strokeWidth={2}
                        dot={{ fill: '#60a5fa', strokeWidth: 1, r: 3 }}
                        activeDot={{ r: 6, stroke: '#60a5fa', strokeWidth: 2 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Pie Chart - Jahresverteilung */}
              {pieData.length > 0 && (
                <div className="bg-slate-700/30 rounded-lg p-3 sm:p-4 md:p-6">
                  <h3 className="text-base sm:text-lg font-medium text-white mb-3 sm:mb-4">
                    {selectedYear === 'all' ? 'Gesamtverteilung' : `Jahresverteilung ${selectedYear}`}
                  </h3>
                  <div className="flex flex-col items-center space-y-4 sm:space-y-0 sm:flex-row sm:items-center">
                    <div className="h-48 w-48 sm:h-64 sm:w-full sm:max-w-sm">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={pieData}
                            cx="50%"
                            cy="50%"
                            innerRadius={40}
                            outerRadius={80}
                            paddingAngle={3}
                            dataKey="value"
                          >
                            {pieData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip 
                            formatter={(value: number) => [`${formatAmount(value)}€`, '']}
                            labelStyle={{ color: '#ffffff' }}
                            contentStyle={{ 
                              backgroundColor: '#1e293b', 
                              border: '1px solid #475569',
                              borderRadius: '8px',
                              fontSize: '12px'
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="w-full sm:w-1/2 sm:pl-4 md:pl-6">
                      <div className="space-y-2 sm:space-y-3">
                        {pieData.map((entry, index) => (
                          <div key={index} className="flex items-center justify-between">
                            <div className="flex items-center">
                              <div 
                                className="w-3 h-3 sm:w-4 sm:h-4 rounded-full mr-2 sm:mr-3"
                                style={{ backgroundColor: entry.color }}
                              ></div>
                              <span className="text-white text-xs sm:text-sm">{entry.name}</span>
                            </div>
                            <span className="text-slate-300 text-xs sm:text-sm font-medium">
                              {formatAmount(entry.value)}€
                            </span>
                          </div>
                        ))}
                        <div className="pt-2 sm:pt-3 border-t border-slate-600">
                          <div className="flex items-center justify-between">
                            <span className="text-white font-medium text-xs sm:text-sm">Bilanz</span>
                            <span className={`font-bold text-xs sm:text-sm ${yearTotal.balance >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                              {yearTotal.balance >= 0 ? '+' : ''}{formatAmount(yearTotal.balance)}€
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Monatsübersicht */}
          {filteredBalances.length > 0 ? (
            <div>
              <h3 className="text-base sm:text-lg font-medium text-white mb-3 sm:mb-4">Monatsübersicht</h3>
              <div className="space-y-2 sm:space-y-3">
                {filteredBalances
                  .sort((a, b) => b.month - a.month) // Neueste Monate zuerst
                  .map((balance) => (
                    <div key={`${balance.year}-${balance.month}`} className="bg-slate-800/30 border border-slate-600/30 rounded-lg p-3 sm:p-4">
                      <div className="flex items-center justify-between mb-2 sm:mb-3">
                        <h4 className="text-white font-medium text-sm sm:text-base">
                          {new Date(balance.year, balance.month - 1).toLocaleDateString('de-DE', { 
                            month: 'long', 
                            year: 'numeric' 
                          })}
                        </h4>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-2 sm:gap-4 text-xs sm:text-sm text-center">
                        <div>
                          <div className="text-green-400 font-semibold">
                            +{formatAmount(balance.income)}
                          </div>
                          <div className="text-slate-400 text-xs mt-1">Einnahmen</div>
                        </div>
                        <div>
                          <div className="text-red-400 font-semibold">
                            -{formatAmount(balance.expenses)}
                          </div>
                          <div className="text-slate-400 text-xs mt-1">Ausgaben</div>
                        </div>
                        <div>
                          <div className={`font-semibold ${balance.balance >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {balance.balance >= 0 ? '+' : ''}{formatAmount(balance.balance)}
                          </div>
                          <div className="text-slate-400 text-xs mt-1">Bilanz</div>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-6 sm:py-8">
              <p className="text-slate-400 text-sm sm:text-base">
                {selectedYear === 'all' ? 'Keine Transaktionen verfügbar.' : `Keine Daten für ${selectedYear} verfügbar.`}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
