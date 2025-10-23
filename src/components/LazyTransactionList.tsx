import { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Link } from 'react-router-dom';
import type { Transaction } from '../types/Transaction';
import { getTransactionsForMonth, getAvailableMonths } from '../services/transactionService';
import { DropdownMenu } from './DropdownMenu';

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

interface LazyTransactionListProps {
  onDeleteTransaction?: (transactionId: string) => void;
  onEditTransaction?: (transaction: any) => void;
}

export const LazyTransactionList = forwardRef<LazyTransactionListRef, LazyTransactionListProps>(({ onDeleteTransaction, onEditTransaction }, ref) => {
  const [months, setMonths] = useState<MonthData[]>([]);
  const [allMonths, setAllMonths] = useState<MonthData[]>([]);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeSearchTerm, setActiveSearchTerm] = useState('');
  const [searchLoadingMonths, setSearchLoadingMonths] = useState<Set<string>>(new Set());
  const [showOnlyBusiness, setShowOnlyBusiness] = useState(false);

  // Aktuelles Datum für Filter
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth() + 1; // getMonth() gibt 0-11 zurück, wir brauchen 1-12

  // Monatsname extrahieren (ohne Jahr)
  const getMonthName = (monthData: MonthData): string => {
    const date = new Date(monthData.year, monthData.month - 1);
    return date.toLocaleDateString('de-DE', { month: 'long' });
  };

  // Prüft ob es sich um den aktuellen Monat handelt
  const isCurrentMonth = (year: number, month: number): boolean => {
    return year === currentYear && month === currentMonth;
  };

  // Berechnet die Bilanz für einen Monat (bereits gefilterte Transaktionen)
  const calculateMonthBalance = (transactions: Transaction[]) => {
    let income = 0;
    let expenses = 0;
    
    // Transaktionen sind bereits gefiltert durch filterTransactions()
    transactions.forEach(transaction => {
      const absoluteAmount = Math.abs(transaction.amount);
      if (transaction.type === 'income') {
        income += absoluteAmount;
      } else {
        expenses += absoluteAmount;
      }
    });
    
    const balance = income - expenses;
    
    return {
      income,
      expenses,
      balance
    };
  };

  // Text kürzen wenn länger als 30 Zeichen
  const truncateText = (text: string, maxLength: number = 30): string => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
  };

  // Prüft ob eine Transaktion eine Tanken-Transaktion ist (nur für Anzeige)
  const isTankenTransaction = (description: string, type: string): boolean => {
    if (type !== 'expense') return false;
    
    const lowerDescription = description.toLowerCase();
    const hasTanken = lowerDescription.includes('tanken');
    const hasTanke = lowerDescription.includes('tanke');
    const hasSprit = lowerDescription.includes('sprit') && !lowerDescription.includes('sprite');
    
    return hasTanken || hasTanke || hasSprit;
  };

  // Prüft ob eine Transaktion eine H+M-Transaktion ist
  const isHMTransaction = (description: string): boolean => {
    return description.startsWith('H+') || description.startsWith('M+');
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

      // Alle Monate speichern
      setAllMonths(monthsWithState);
      
      // Verfügbare Jahre extrahieren
      const years = [...new Set(monthsWithState.map(m => m.year))].sort((a, b) => b - a);
      setAvailableYears(years);
      
      // Monate für das aktuelle Jahr filtern
      filterMonthsByYear(monthsWithState, selectedYear);
      
      setIsInitialLoading(false);
      
      // Lade Transaktionen für den aktuellen Monat automatisch (falls im ausgewählten Jahr)
      const currentMonth = monthsWithState.find(month => 
        month.monthYear === currentMonthYear && month.year === selectedYear
      );
      if (currentMonth) {
        await loadTransactionsForMonth(currentMonth.year, currentMonth.month);
      }
    } catch (error) {
      console.error('Error loading months:', error);
      setIsInitialLoading(false);
    }
  };

  // Filtere Monate nach Jahr
  const filterMonthsByYear = (monthsData: MonthData[], year: number) => {
    const filteredMonths = monthsData.filter(m => m.year === year);
    setMonths(filteredMonths);
  };

  // Jahr-Handler
  const handleYearChange = (year: number) => {
    setSelectedYear(year);
    filterMonthsByYear(allMonths, year);
    setSearchTerm('');
    setActiveSearchTerm('');
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

  // Separiert und sortiert Transaktionen nach Typ (Ausgaben oben, Einnahmen unten)
  const sortAndSeparateTransactions = (transactions: Transaction[]): { expenses: Transaction[], incomes: Transaction[] } => {
    const expenses = transactions.filter(t => t.type === 'expense');
    const incomes = transactions.filter(t => t.type === 'income');
    
    // Sortiere beide Gruppen nach Betragshöhe (größte zuerst)
    const sortedExpenses = [...expenses].sort((a, b) => {
      const amountA = Math.abs(Number(a.amount));
      const amountB = Math.abs(Number(b.amount));
      return amountB - amountA;
    });
    
    const sortedIncomes = [...incomes].sort((a, b) => {
      const amountA = Math.abs(Number(a.amount));
      const amountB = Math.abs(Number(b.amount));
      return amountB - amountA;
    });
    
    return { expenses: sortedExpenses, incomes: sortedIncomes };
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
    // Erst H+M Transaktionen herausfiltern
    let filtered = transactions.filter(transaction => 
      !isHMTransaction(transaction.description)
    );
    
    // Business-Filter anwenden - standardmäßig Business-Transaktionen ausblenden
    if (showOnlyBusiness) {
      // Wenn Business-Toggle aktiviert ist, nur Business-Transaktionen zeigen
      filtered = filtered.filter(transaction => transaction.isBusiness === true);
    } else {
      // Standardmäßig Business-Transaktionen ausblenden (nur in normaler Ansicht)
      filtered = filtered.filter(transaction => transaction.isBusiness !== true);
    }
    
    if (!activeSearchTerm.trim() || searchTerm !== activeSearchTerm) {
      return filtered;
    }
    
    const searchLower = activeSearchTerm.toLowerCase();
    return filtered.filter(transaction => {
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

  // Jahr-Wechsel Effect
  useEffect(() => {
    if (allMonths.length > 0) {
      filterMonthsByYear(allMonths, selectedYear);
    }
  }, [selectedYear, allMonths]);

  // Loading-Zustand
  if (isInitialLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-white/5 backdrop-blur-lg rounded-2xl border border-white/10 p-8 shadow-2xl mt-8">
          <div className="text-center">
            <h2 className="text-2xl font-semibold text-white mb-4">Transaktionen</h2>
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
              <span className="ml-3 text-slate-400">Lade Monate...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Leerer Zustand
  if (months.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-white/5 backdrop-blur-lg rounded-2xl border border-white/10 p-8 shadow-2xl mt-8">
          <div className="text-center">
            <h2 className="text-2xl font-semibold text-white mb-4">Transaktionen</h2>
            <p className="text-slate-400">Noch keine Transaktionen vorhanden.</p>
          </div>
        </div>
      </div>
    );
  }

  // Haupt-Render
  return (
    <div className="max-w-4xl mx-auto px-4">
      <div className="bg-white/5 backdrop-blur-lg rounded-xl sm:rounded-2xl border border-white/10 p-3 sm:p-4 shadow-2xl mt-4 sm:mt-8">
      <div className="flex flex-col space-y-3 sm:space-y-0 sm:flex-row sm:items-center sm:justify-between mb-3 sm:mb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-3">
          {/* Title and Year Selection - direkt nebeneinander */}
          <div className="flex items-center space-x-2">
            <h2 className="text-xl sm:text-2xl font-semibold text-white">Transaktionen</h2>
            
            {/* Jahresauswahl als Dropdown - direkt neben dem Titel */}
            {availableYears.length > 1 && (
              <select
                value={selectedYear}
                onChange={(e) => handleYearChange(parseInt(e.target.value))}
                className="px-3 py-1 bg-slate-800 border border-slate-600 rounded text-white text-sm"
              >
                {availableYears.map(year => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
        
        {/* Suchfeld mit integriertem Business-Toggle */}
        <div className="relative w-full sm:w-64">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            placeholder="Suchen... (Enter zum Suchen)"
            value={searchTerm}
            onChange={(e) => handleSearchChange(e.target.value)}
            onKeyPress={handleKeyPress}
            className="block w-full pl-10 pr-20 py-2 sm:py-2 border border-slate-600/30 rounded-lg bg-slate-800/50 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
          />
          
          {/* Business Toggle Switch und X-Button im Suchfeld */}
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center space-x-2">
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
                  // Nur Monate des ausgewählten Jahres berücksichtigen
                  setMonths(prev => prev.map(month => ({
                    ...month,
                    isExpanded: month.monthYear === currentMonthYear && month.year === selectedYear
                  })));
                }}
                className="text-slate-400 hover:text-white transition-colors"
                title="Suche löschen"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowOnlyBusiness(!showOnlyBusiness)}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200 focus:outline-none ${
                showOnlyBusiness ? 'bg-blue-600' : 'bg-slate-600'
              }`}
              title={showOnlyBusiness ? "Alle Transaktionen anzeigen" : "Nur Geschäftstransaktionen anzeigen"}
            >
              <span
                className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform duration-200 ${
                  showOnlyBusiness ? 'translate-x-5' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>
      </div>
      
      <div className="space-y-4">
        {months.map((monthData) => (
          <div key={`${monthData.year}-${monthData.month}`}>
            {/* Monats-Header */}
            <button
              onClick={() => toggleMonth(monthData.year, monthData.month)}
              className="w-full text-left mb-2 border-b border-slate-600/30 pb-1 hover:border-slate-500/50 transition-colors"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-slate-300">
                  {getMonthName(monthData)}
                  <span className="ml-2 text-sm text-slate-500">
                    ({(() => {
                      if (!monthData.transactions) {
                        return showOnlyBusiness ? '...' : monthData.count;
                      }
                      
                      const filteredCount = filterTransactions(monthData.transactions).length;
                      
                      // Berechne die Gesamtzahl basierend auf Business-Filter
                      let totalCount = monthData.count;
                      if (showOnlyBusiness) {
                        // Zähle nur Business-Transaktionen (ohne H+M Filter)
                        totalCount = monthData.transactions.filter(t => 
                          !isHMTransaction(t.description) && t.isBusiness === true
                        ).length;
                      } else {
                        // Zähle alle Transaktionen ohne H+M
                        totalCount = monthData.transactions.filter(t => 
                          !isHMTransaction(t.description)
                        ).length;
                      }
                      
                      return (activeSearchTerm.trim() && searchTerm === activeSearchTerm)
                        ? `${filteredCount} von ${totalCount}` 
                        : totalCount;
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
              <div className="space-y-2">
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
                      const { expenses, incomes } = sortAndSeparateTransactions(filteredTransactions);
                      
                      if (filteredTransactions.length === 0) {
                        if (activeSearchTerm.trim() && searchTerm === activeSearchTerm) {
                          return (
                            <div className="text-center py-4 text-slate-400">
                              Keine {showOnlyBusiness ? 'Geschäfts-' : ''}Transaktionen gefunden für "{activeSearchTerm}".
                            </div>
                          );
                        } else if (showOnlyBusiness) {
                          return (
                            <div className="text-center py-4 text-slate-400">
                              Keine Geschäftstransaktionen in diesem Monat.
                            </div>
                          );
                        }
                      }
                      
                      const renderTransaction = (transaction: Transaction) => {
                        const isTanken = isTankenTransaction(transaction.description, transaction.type);
                        
                        return (
                          <div
                            key={transaction.id}
                            className="group bg-slate-800/30 border border-slate-600/30 rounded-lg p-2 sm:p-3 hover:bg-slate-800/50 transition-all"
                          >
                            <div className="flex items-start sm:items-center">
                              <div className="flex-1 min-w-0">
                                <div>
                                  <h3 className="text-white font-medium text-sm md:text-base break-words flex items-center gap-1">
                                    {highlightSearchTerm(truncateText(`${transaction.description} • ${transaction.location}`), searchTerm === activeSearchTerm ? activeSearchTerm : '')}
                                    {/* Business-Indikator */}
                                    {transaction.isBusiness && (
                                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-600/20 text-blue-300 border border-blue-500/30">
                                        B
                                      </span>
                                    )}
                                    {/* Kilometerstand und Liter-Anzeige für Tanken-Transaktionen */}
                                    {isTanken && (transaction.kilometerstand || transaction.liter) && (
                                      <div className="flex items-center gap-1">
                                        {transaction.kilometerstand && (
                                          <span className="inline-flex items-center px-1 sm:px-1.5 py-0.5 rounded-md text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                            {transaction.kilometerstand.toLocaleString('de-DE')} km
                                          </span>
                                        )}
                                        {transaction.liter && (
                                          <span className="inline-flex items-center px-1 sm:px-1.5 py-0.5 rounded-md text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/20">
                                            {transaction.liter.toString().replace('.', ',')} L
                                          </span>
                                        )}
                                      </div>
                                    )}
                                  </h3>
                                  <span className="text-xs text-slate-500 mt-1 block">
                                    {highlightSearchTerm(new Date(transaction.date).toLocaleDateString('de-DE'), searchTerm === activeSearchTerm ? activeSearchTerm : '')}
                                  </span>
                                </div>
                              </div>
                              
                              <div className="text-right ml-1 sm:ml-2">
                                <div className={`text-sm sm:text-base md:text-lg font-semibold ${
                                  transaction.type === 'income' 
                                    ? 'text-green-400' 
                                    : 'text-red-400'
                                }`}>
                                  {transaction.type === 'income' ? '+' : '-'}{formatAmount(Math.abs(transaction.amount))}
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
                        );
                      };
                      
                      return (
                        <div className="space-y-6">
                          {/* Ausgaben Sektion */}
                          {expenses.length > 0 && (
                            <div>
                              <div className="space-y-2">
                                {expenses.map(renderTransaction)}
                              </div>
                            </div>
                          )}

                          {/* Einnahmen Sektion */}
                          {incomes.length > 0 && (
                            <div>
                              <h4 className="text-sm font-medium text-green-300 mb-3 border-b border-green-400/20 pb-2">
                              </h4>
                              <div className="space-y-2">
                                {incomes.map(renderTransaction)}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                    
                    {/* Monatsbilanz - nur anzeigen wenn Transaktionen vorhanden und NICHT der aktuelle Monat */}
                    {monthData.transactions && monthData.transactions.length > 0 && !activeSearchTerm.trim() && !isCurrentMonth(monthData.year, monthData.month) && (
                      (() => {
                        const filteredTransactionsForBalance = filterTransactions(monthData.transactions);
                        const balance = calculateMonthBalance(filteredTransactionsForBalance);
                        return (
                          <div className="mt-3 pt-3 border-t border-slate-600/30">
                            <div className="bg-slate-700/30 rounded-lg p-2 sm:p-3">
                              <h4 className="text-white font-medium text-sm mb-2">Monatsbilanz</h4>
                              <div className="grid grid-cols-3 gap-3 text-sm">
                                <div className="text-center">
                                  <div className="text-green-400 font-semibold">
                                    +{formatAmount(Math.abs(balance.income))}
                                  </div>
                                  <div className="text-slate-400 text-xs mt-1">Einnahmen</div>
                                </div>
                                <div className="text-center">
                                  <div className="text-red-400 font-semibold">
                                    -{formatAmount(Math.abs(balance.expenses))}
                                  </div>
                                  <div className="text-slate-400 text-xs mt-1">Ausgaben</div>
                                </div>
                                <div className="text-center">
                                  <div className={`font-semibold ${balance.balance >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                    {balance.balance >= 0 ? '+' : ''}{formatAmount(Math.abs(balance.balance))}
                                  </div>
                                  <div className="text-slate-400 text-xs mt-1">Bilanz</div>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })()
                    )}
                  </>
                )}
            
            {monthData.transactions && monthData.transactions.length === 0 && !monthData.isLoading && (
                  <div className="text-center py-4 text-slate-400">
                    Keine {showOnlyBusiness ? 'Geschäfts-' : ''}Transaktionen in diesem Monat gefunden.
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
      
      {/* Bilanzen, Geplante Ausgaben, Business und H+M Buttons am Ende */}
      <div className="mt-6 pt-4 border-t border-slate-600/30">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Link 
            to="/bilanzen"
            className="inline-flex items-center justify-center px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold rounded-lg transition-all duration-200 transform hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-slate-900"
          >
            <svg 
              className="w-5 h-5 mr-2" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" 
              />
            </svg>
            Bilanzen
          </Link>
          
          <Link 
            to="/geplant"
            className="inline-flex items-center justify-center px-6 py-3 bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700 text-white font-semibold rounded-lg transition-all duration-200 transform hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 focus:ring-offset-slate-900"
          >
            <svg 
              className="w-5 h-5 mr-2" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M8 7V3a1 1 0 011-1h6a1 1 0 011 1v4h3a1 1 0 011 1v9a2 2 0 01-2 2H5a2 2 0 01-2-2V8a1 1 0 011-1h3z" 
              />
            </svg>
            Geplante Ausgaben
          </Link>
          
          <Link 
            to="/business"
            className="inline-flex items-center justify-center px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold rounded-lg transition-all duration-200 transform hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-900"
          >
            <svg 
              className="w-5 h-5 mr-2" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" 
              />
            </svg>
            🏢 Business
          </Link>
          
          <Link 
            to="/hm"
            className="inline-flex items-center justify-center px-6 py-3 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white font-semibold rounded-lg transition-all duration-200 transform hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 focus:ring-offset-slate-900"
          >
            <svg 
              className="w-5 h-5 mr-2" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M13 10V3L4 14h7v7l9-11h-7z" 
              />
            </svg>
            H+M
          </Link>
        </div>
      </div>
    </div>
    </div>
  );
});

LazyTransactionList.displayName = 'LazyTransactionList';
