import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import type { Transaction } from '../types/Transaction';
import { getAvailableMonths, getTransactionsForMonth, getOneTimeInvestmentsForYear } from '../services/transactionService';

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
  const [oneTimeInvestments, setOneTimeInvestments] = useState<Transaction[]>([]);
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [selectedYear, setSelectedYear] = useState<number | 'all'>(new Date().getFullYear());
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showOnlyBusiness, setShowOnlyBusiness] = useState(false);
  const [visibleInvestmentDates, setVisibleInvestmentDates] = useState<Set<string>>(new Set());

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
  const loadBalances = async (isSilent = false) => {
    if (!isSilent) setIsLoading(true);
    try {
      const months = await getAvailableMonths();
      
      // Filtere Monate heraus, die in der Zukunft liegen
      const validMonths = months.filter(m => 
        m.year < currentYear || (m.year === currentYear && m.month <= currentMonth)
      );

      const yearsSet = new Set(validMonths.map(m => m.year));
      yearsSet.add(currentYear); // Immer das aktuelle Jahr hinzufügen, um Einzelinvestitionen des laufenden Jahres zu berücksichtigen
      const years = [...yearsSet].sort((a, b) => b - a);
      setAvailableYears(years);

      // Lade Transaktionen für alle Monate
      const balances: MonthBalance[] = [];
      const allFetchedTransactions: Transaction[] = [];
      
      for (const month of validMonths) {
        try {
          const transactions = await getTransactionsForMonth(month.year, month.month);
          allFetchedTransactions.push(...transactions);
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

      // Lade Einmal-Investitionen für alle Jahre
      const investments: Transaction[] = [];
      for (const year of years) {
        try {
          const yearlyInvestments = await getOneTimeInvestmentsForYear(year);
          investments.push(...yearlyInvestments);
          allFetchedTransactions.push(...yearlyInvestments);
        } catch (error) {
          console.error(`Fehler beim Laden der Einmal-Investitionen für ${year}:`, error);
        }
      }
      setOneTimeInvestments(investments);
      setAllTransactions(allFetchedTransactions);
    } catch (error) {
      console.error('Fehler beim Laden der Monate:', error);
    } finally {
      if (!isSilent) setIsLoading(false);
    }
  };

  useEffect(() => {
    loadBalances();
    const handleSilentRefresh = () => loadBalances(true);
    window.addEventListener('transaction-changed', handleSilentRefresh);
    return () => window.removeEventListener('transaction-changed', handleSilentRefresh);
  }, [showOnlyBusiness]); // Lade Daten neu, wenn sich der Business-Filter ändert

  // Filtert Bilanzen nach ausgewähltem Jahr
  const filteredBalances = selectedYear === 'all' 
    ? monthBalances 
    : monthBalances.filter(balance => balance.year === selectedYear);

  // Filtert Einmal-Investitionen nach ausgewähltem Jahr und Business-Toggle
  const filteredInvestments = (selectedYear === 'all' 
    ? oneTimeInvestments 
    : oneTimeInvestments.filter(t => new Date(t.date).getFullYear() === selectedYear))
    .filter(t => !isHMTransaction(t.description))
    .filter(t => showOnlyBusiness ? t.isBusiness === true : t.isBusiness !== true)
    .filter(t => {
      const tDate = new Date(t.date);
      return tDate.getFullYear() < currentYear || (tDate.getFullYear() === currentYear && (tDate.getMonth() + 1) <= currentMonth);
    });

  const investmentsTotals = filteredInvestments.reduce((acc, t) => {
    const amount = Math.abs(t.amount);
    if (t.type === 'income') {
      acc.income += amount;
      acc.balance += amount;
    } else {
      acc.expenses += amount;
      acc.balance -= amount;
    }
    return acc;
  }, { income: 0, expenses: 0, balance: 0 });

  // Berechnet Jahresgesamtwerte
  const yearTotal = filteredBalances.reduce((acc, balance) => ({
    income: acc.income + balance.income,
    expenses: acc.expenses + balance.expenses,
    balance: acc.balance + balance.balance
  }), { income: 0, expenses: 0, balance: 0 });

  // Gesamtergebnis (Operativ + Investitionen)
  const grandTotal = {
    income: yearTotal.income + investmentsTotals.income,
    expenses: yearTotal.expenses + investmentsTotals.expenses,
    balance: yearTotal.balance + investmentsTotals.balance
  };

  // Erstellt und lädt die CSV-Datei herunter
  const exportToCsv = () => {
    const filtered = allTransactions.filter(t => 
      !isHMTransaction(t.description) && 
      (showOnlyBusiness ? t.isBusiness === true : t.isBusiness !== true) &&
      (selectedYear === 'all' || new Date(t.date).getFullYear() === selectedYear)
    ).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const csvContent = [
      ['Datum', 'Typ', 'Beschreibung', 'Ort', 'Betrag', 'Kategorie'].join(';'),
      ...filtered.map(t => [
        new Date(t.date).toLocaleDateString('de-DE'),
        t.type === 'income' ? 'Einnahme' : 'Ausgabe',
        `"${t.description.replace(/"/g, '""')}"`,
        `"${(t.location || '').replace(/"/g, '""')}"`,
        t.amount.toString().replace('.', ','), // Komma als Dezimaltrennzeichen
        t.isBusiness ? 'Business' : 'Privat'
      ].join(';'))
    ].join('\n');

    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([`\ufeff${csvContent}`], { type: 'text/csv;charset=utf-8;' })); // BOM für Excel UTF-8 Erkennung
    link.download = `Transaktionen_${showOnlyBusiness ? 'Business' : 'Privat'}_${selectedYear}.csv`;
    link.click();
  };

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
  const pieData = grandTotal.income > 0 || grandTotal.expenses > 0 ? [
    { name: 'Einnahmen', value: grandTotal.income, color: '#4ade80' },
    { name: 'Ausgaben', value: grandTotal.expenses, color: '#f87171' }
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
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div className="flex flex-wrap items-center gap-3">
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

            <button
              onClick={exportToCsv}
              className="inline-flex items-center justify-center px-4 py-2 bg-slate-700/50 hover:bg-slate-600/50 border border-slate-600/50 text-white text-sm font-medium rounded-lg transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-500"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              CSV Export
            </button>
          </div>

          {/* Jahresübersicht */}
          {filteredBalances.length > 0 && (
            <div className="mb-6 sm:mb-8">
              <h3 className="text-base sm:text-lg font-medium text-white mb-3 sm:mb-4">
                {selectedYear === 'all' ? 'Gesamtübersicht aller Transaktionen' : `Jahresübersicht ${selectedYear}`}
              </h3>
              <div className="bg-slate-700/30 rounded-lg p-3 sm:p-4 md:p-6 space-y-4">
                {/* Operatives Geschäft */}
                <div>
                  {filteredInvestments.length > 0 && (
                    <h4 className="text-sm font-medium text-slate-400 mb-2 sm:mb-3 text-center">Operatives Geschäft</h4>
                  )}
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
                        {yearTotal.balance >= 0 ? '+' : '-'}{formatAmount(yearTotal.balance)}
                      </div>
                      <div className="text-slate-400 text-xs sm:text-sm mt-1">Bilanz</div>
                    </div>
                  </div>
                </div>

                {/* Einzelinvestitionen */}
                {filteredInvestments.length > 0 && (
                  <>
                    <div className="border-t border-slate-600/50 pt-4">
                      <h4 className="text-sm font-medium text-slate-400 mb-2 sm:mb-3 text-center">Einzelinvestitionen</h4>
                      <div className="grid grid-cols-3 gap-2 sm:gap-4 text-center">
                        <div>
                          <div className="text-base sm:text-xl font-semibold text-green-400">
                            +{formatAmount(investmentsTotals.income)}
                          </div>
                        </div>
                        <div>
                          <div className="text-base sm:text-xl font-semibold text-red-400">
                            -{formatAmount(investmentsTotals.expenses)}
                          </div>
                        </div>
                        <div>
                          <div className={`text-base sm:text-xl font-semibold ${investmentsTotals.balance >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {investmentsTotals.balance >= 0 ? '+' : '-'}{formatAmount(investmentsTotals.balance)}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Gesamtergebnis */}
                    <div className="border-t border-slate-600/50 pt-4">
                      <h4 className="text-sm sm:text-base font-medium text-white mb-2 sm:mb-3 text-center">Wahrer Cashflow (Inkl. Investitionen)</h4>
                      <div className="grid grid-cols-3 gap-2 sm:gap-4 text-center">
                        <div>
                          <div className="text-lg sm:text-2xl md:text-3xl font-bold text-green-400">
                            +{formatAmount(grandTotal.income)}
                          </div>
                        </div>
                        <div>
                          <div className="text-lg sm:text-2xl md:text-3xl font-bold text-red-400">
                            -{formatAmount(grandTotal.expenses)}
                          </div>
                        </div>
                        <div>
                          <div className={`text-lg sm:text-2xl md:text-3xl font-bold ${grandTotal.balance >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {grandTotal.balance >= 0 ? '+' : '-'}{formatAmount(grandTotal.balance)}
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                )}
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
                            <span className={`font-bold text-xs sm:text-sm ${grandTotal.balance >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                              {grandTotal.balance >= 0 ? '+' : '-'}{formatAmount(grandTotal.balance)}€
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
                            {balance.balance >= 0 ? '+' : '-'}{formatAmount(balance.balance)}
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

          {/* Einmal-Investitionen */}
          {filteredInvestments.length > 0 && (
            <div className="mt-6 sm:mt-8">
              <h3 className="text-base sm:text-lg font-medium text-white mb-3 sm:mb-4">
                Einmal-Investitionen {selectedYear !== 'all' && selectedYear}
              </h3>
              <div className="bg-slate-800/30 border border-slate-600/30 rounded-lg p-3 sm:p-4">
                <div className="space-y-3">
                  {filteredInvestments.map(investment => (
                    <div key={investment.id} className="flex items-center justify-between py-2 border-b border-slate-700/50 last:border-0 last:pb-0">
                      <div>
                        <div className="text-white text-sm font-medium">{investment.description}</div>
                        <div className="text-slate-400 text-xs mt-0.5 flex items-center gap-2">
                          <button
                            onClick={() => toggleInvestmentDateVisibility(investment.id)}
                            className="text-slate-500 hover:text-slate-300 transition-colors"
                            title="Datum anzeigen/verbergen"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                              {visibleInvestmentDates.has(investment.id) ? (
                                <>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.01 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.01-9.963-7.178z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                </>
                              ) : (
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                              )}
                            </svg>
                          </button>
                          {visibleInvestmentDates.has(investment.id) && (
                            <span>{new Date(investment.date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
                          )}
                          {investment.location && <span>• {investment.location}</span>}
                        </div>
                      </div>
                      <div className={`font-semibold text-sm whitespace-nowrap ml-4 ${investment.type === 'income' ? 'text-green-400' : 'text-red-400'}`}>
                        {investment.type === 'income' ? '+' : '-'}{formatAmount(investment.amount)}€
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 pt-3 border-t border-slate-600 flex items-center justify-between">
                  <span className="text-white font-medium text-sm">Gesamt Investitionen</span>
                  <span className={`font-bold text-sm ${investmentsTotals.balance >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {investmentsTotals.balance >= 0 ? '+' : '-'}{formatAmount(investmentsTotals.balance)}€
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
