import { useState, useEffect, forwardRef, useImperativeHandle, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import type { Transaction } from '../types/Transaction';
import { getTransactionsForMonth, getAvailableMonths, isHMTransaction, getOneTimeInvestmentsForYear, updateKilometerstand, updateLiter } from '../services/transactionService';
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
  onEditTransaction?: (transaction: Transaction) => void;
}

export const LazyTransactionList = forwardRef<LazyTransactionListRef, LazyTransactionListProps>(({ onDeleteTransaction, onEditTransaction }, ref) => {
  const [months, setMonths] = useState<MonthData[]>([]);
  const [allMonths, setAllMonths] = useState<MonthData[]>([]);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [deletingTransactions, setDeletingTransactions] = useState<Set<string>>(new Set());
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeSearchTerm, setActiveSearchTerm] = useState('');
  const [searchLoadingMonths, setSearchLoadingMonths] = useState<Set<string>>(new Set());
  const [showOnlyBusiness] = useState(false);
  const [oneTimeInvestments, setOneTimeInvestments] = useState<Transaction[]>([]);
  const [isOneTimeExpanded, setIsOneTimeExpanded] = useState(false);
  const [isLoadingOneTime, setIsLoadingOneTime] = useState(false);
  const [visibleInvestmentDates, setVisibleInvestmentDates] = useState<Set<string>>(new Set());

  // NEU: Ref für den aktuellen State der Monate, um bei asynchronen Updates keine veralteten Closures zu haben
  const monthsRef = useRef<MonthData[]>(months);
  const selectedYearRef = useRef(selectedYear);
  const isOneTimeExpandedRef = useRef(isOneTimeExpanded);
  useEffect(() => {
    monthsRef.current = months;
  }, [months]);
  useEffect(() => {
    selectedYearRef.current = selectedYear;
  }, [selectedYear]);
  useEffect(() => {
    isOneTimeExpandedRef.current = isOneTimeExpanded;
  }, [isOneTimeExpanded]);

  // New sub-component for Kilometerstand input
  const KilometerstandInput = ({ transaction }: { transaction: Transaction }) => {
    const [km, setKm] = useState(transaction.kilometerstand ? transaction.kilometerstand.toLocaleString('de-DE') : '');
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
      setKm(transaction.kilometerstand ? transaction.kilometerstand.toLocaleString('de-DE') : '');
    }, [transaction.kilometerstand]);

    const handleKmUpdate = async () => {
      const kmValue = parseInt(km.replace(/\./g, ''), 10);
      
      if (isNaN(kmValue) || kmValue === transaction.kilometerstand) {
        if (isNaN(kmValue)) {
            setKm(transaction.kilometerstand ? transaction.kilometerstand.toLocaleString('de-DE') : '');
        }
        return;
      }

      setIsSaving(true);
      try {
        await updateKilometerstand(transaction.id, kmValue);
      } catch (error) {
        console.error("Failed to update kilometerstand", error);
        alert("Fehler beim Speichern des Kilometerstands.");
        setKm(transaction.kilometerstand ? transaction.kilometerstand.toLocaleString('de-DE') : '');
      } finally {
        setIsSaving(false);
      }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        handleKmUpdate();
        e.currentTarget.blur();
      }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setKm(e.target.value);
    };

    return (
      <div className="relative flex items-center group/km">
        <div className="relative flex items-center">
          <input 
            type="text"
            placeholder="km-Stand"
            value={km}
            onChange={handleChange}
            onBlur={handleKmUpdate}
            onKeyDown={handleKeyDown}
            className={`w-24 rounded-lg border border-slate-700 bg-slate-900/50 py-2 pl-2.5 pr-6 text-xs font-medium text-slate-300 placeholder-slate-600 transition-all hover:border-slate-500 hover:bg-slate-800/60 focus:border-blue-500 focus:bg-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500 ${isSaving ? 'opacity-50' : ''}`}
            disabled={isSaving}
          />
          <div className="absolute right-2 text-[10px] font-bold text-slate-500 pointer-events-none transition-colors group-focus-within/km:text-blue-400">
            km
          </div>
        </div>
        {isSaving && (
          <div className="absolute -right-5 top-1/2 -translate-y-1/2">
            <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-400"></div>
          </div>
        )}
      </div>
    );
  };

  // New sub-component for Liter input
  const LiterInput = ({ transaction }: { transaction: Transaction }) => {
    const [liter, setLiter] = useState(transaction.liter ? transaction.liter.toString().replace('.', ',') : '');
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
      setLiter(transaction.liter ? transaction.liter.toString().replace('.', ',') : '');
    }, [transaction.liter]);

    const handleLiterUpdate = async () => {
      const cleanValue = liter.replace(/[^\d.,]/g, '').replace(',', '.');
      const literValue = parseFloat(cleanValue);
      
      if (isNaN(literValue) || literValue === transaction.liter) {
        if (isNaN(literValue) && liter !== '') {
            setLiter(transaction.liter ? transaction.liter.toString().replace('.', ',') : '');
        }
        return;
      }

      setIsSaving(true);
      try {
        await updateLiter(transaction.id, literValue);
      } catch (error) {
        console.error("Failed to update liter", error);
        alert("Fehler beim Speichern der Liter.");
        setLiter(transaction.liter ? transaction.liter.toString().replace('.', ',') : '');
      } finally {
        setIsSaving(false);
      }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        handleLiterUpdate();
        e.currentTarget.blur();
      }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setLiter(e.target.value);
    };

    return (
      <div className="relative flex items-center group/liter">
        <div className="relative flex items-center">
          <input 
            type="text"
            placeholder="Liter"
            value={liter}
            onChange={handleChange}
            onBlur={handleLiterUpdate}
            onKeyDown={handleKeyDown}
            className={`w-20 rounded-lg border border-slate-700 bg-slate-900/50 py-2 pl-2.5 pr-6 text-xs font-medium text-slate-300 placeholder-slate-600 transition-all hover:border-slate-500 hover:bg-slate-800/60 focus:border-green-500 focus:bg-slate-900 focus:outline-none focus:ring-1 focus:ring-green-500 ${isSaving ? 'opacity-50' : ''}`}
            disabled={isSaving}
          />
          <div className="absolute right-2 text-[10px] font-bold text-slate-500 pointer-events-none transition-colors group-focus-within/liter:text-green-400">
            L
          </div>
        </div>
        {isSaving && (
          <div className="absolute -right-5 top-1/2 -translate-y-1/2">
            <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-green-400"></div>
          </div>
        )}
      </div>
    );
  };

  // Monatsname extrahieren (ohne Jahr)
  const getMonthName = (monthData: MonthData): string => {
    const date = new Date(monthData.year, monthData.month - 1);
    return date.toLocaleDateString('de-DE', { month: 'long' });
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

  // Berechnet die Sparquote
  const calculateSavingsRate = (income: number, expenses: number): number => {
    if (income === 0) return 0;
    return ((income - expenses) / income) * 100;
  };

  // Text kürzen wenn länger als 30 Zeichen
  const truncateText = (text: string, maxLength: number = 30): string => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  // Wrapper für Lösch-Funktion mit Loading-State
  const handleDeleteTransaction = async (transactionId: string) => {
    if (!onDeleteTransaction) return;

    setDeletingTransactions(prev => new Set(prev).add(transactionId));
    try {
      await onDeleteTransaction(transactionId);
      // Daten nach erfolgreichem Löschen neu laden
      await refreshData();
    } finally {
      setDeletingTransactions(prev => {
        const newSet = new Set(prev);
        newSet.delete(transactionId);
        return newSet;
      });
    }
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

      // Finde den aktuellen Monat in den verfügbaren Monaten
      const currentMonthData = availableMonths.find(m => m.monthYear === currentMonthYear);
      
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
      if (currentMonthData && currentMonthData.year === selectedYear) {
        await loadTransactionsForMonth(currentMonthData.year, currentMonthData.month);
      }
    } catch (error) {
      console.error('❌ [loadAvailableMonths] Error loading months:', error);
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

  // Lade Einmal-Investitionen für ein Jahr
  const loadOneTimeInvestmentsForYear = async (year: number) => {
    setIsLoadingOneTime(true);
    try {
      const investments = await getOneTimeInvestmentsForYear(year);
      setOneTimeInvestments(investments);
    } catch (error) {
      console.error('Error loading one-time investments:', error);
    } finally {
      setIsLoadingOneTime(false);
    }
  };

  // Einmal-Investitionen ein-/ausklappen
  const toggleOneTime = async () => {
    const newExpandedState = !isOneTimeExpanded;
    setIsOneTimeExpanded(newExpandedState);
    if (newExpandedState && oneTimeInvestments.length === 0) {
      await loadOneTimeInvestmentsForYear(selectedYear);
    }
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
      console.error(`❌ [loadTransactionsForMonth] Error loading transactions for ${year}-${month}:`, error);
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

  // Ref-Handler mit "Soft Refresh", um Scrollposition und geöffnete Monate zu behalten
  const refreshData = useCallback(async () => {
    try {
      // Lade die Metadaten (Anzahlen etc.) im Hintergrund neu
      const availableMonths = await getAvailableMonths();
      
      // Finde alle Monate, die aktuell aufgeklappt sind
      const expandedMonths = monthsRef.current.filter(m => m.isExpanded);
      
      // Lade die Transaktionen für diese offenen Monate parallel neu
      const fetchedTransactions = await Promise.all(
        expandedMonths.map(async (m) => {
          const txs = await getTransactionsForMonth(m.year, m.month);
          return { year: m.year, month: m.month, transactions: txs };
        })
      );

      // State aktualisieren, ohne den isExpanded-Zustand (Aufgeklappt) zu verlieren
      setMonths(prevMonths => prevMonths.map(month => {
        const newMeta = availableMonths.find(m => m.year === month.year && m.month === month.month);
        const fetched = fetchedTransactions.find(f => f.year === month.year && f.month === month.month);
        
        return {
          ...month,
          count: newMeta ? newMeta.count : month.count,
          transactions: fetched ? fetched.transactions : month.transactions
        };
      }));

      // Einmal-Investitionen neu laden, falls diese aufgeklappt sind
      if (isOneTimeExpandedRef.current) {
        const investments = await getOneTimeInvestmentsForYear(selectedYearRef.current);
        setOneTimeInvestments(investments);
      }
    } catch (error) {
      console.error('❌ [refreshData] Error during soft refresh:', error);
    }
  }, []);

  useImperativeHandle(ref, () => ({
    refreshData: refreshData
  }), [refreshData]);

  // Initial laden
  useEffect(() => {
    loadAvailableMonths();
    // Initial load must run once; later refreshes are handled by explicit events and year changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Listener für Änderungen an Transaktionen (z.B. aus Modal in App.tsx)
  useEffect(() => {
    window.addEventListener('transaction-changed', refreshData);
    return () => window.removeEventListener('transaction-changed', refreshData);
  }, [refreshData]);

  // Jahr-Wechsel Effect
  useEffect(() => {
    if (allMonths.length > 0) {
      filterMonthsByYear(allMonths, selectedYear);
      setIsOneTimeExpanded(false);
      setOneTimeInvestments([]);
    }
  }, [selectedYear, allMonths]);

  // Helper to render a single transaction
  const renderTransaction = (transaction: Transaction) => {
    const isTanken = isTankenTransaction(transaction.description, transaction.type);
    
    return (
      <article
        key={transaction.id}
        className={`group relative rounded-2xl border p-3 shadow-lg shadow-black/10 transition-all sm:p-3 ${
          isTanken
            ? 'border-blue-800/50 bg-blue-900/20 hover:bg-blue-900/60'
            : 'border-slate-600/30 bg-slate-800/40 hover:bg-slate-800/50'
        } ${
          deletingTransactions.has(transaction.id) ? 'opacity-60' : ''
        }`}
      >
        {/* Loading Overlay */}
        {deletingTransactions.has(transaction.id) && (
          <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm rounded-lg flex items-center justify-center z-10">
            <div className="flex flex-col items-center gap-2">
              <svg className="w-8 h-8 animate-spin text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span className="text-sm font-medium text-blue-300">Wird gelöscht...</span>
            </div>
          </div>
        )}
        
        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 sm:flex sm:items-center">
          <div className="flex-1 min-w-0">
            <div>
              <h3 className="flex min-w-0 flex-wrap items-center gap-1.5 text-sm font-medium leading-snug text-white md:text-base">
                <span className="min-w-0 break-words">
                  {highlightSearchTerm(truncateText(`${transaction.description} • ${transaction.location}`), searchTerm === activeSearchTerm ? activeSearchTerm : '')}
                </span>
                {/* Business-Indikator */}
                {transaction.isBusiness && (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-600/20 text-blue-300 border border-blue-500/30">
                    B
                  </span>
                )}
                {/* Einmal-Investition-Indikator */}
                {transaction.isOneTimeInvestment && (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-purple-600/20 text-purple-300 border border-purple-500/30">
                    I
                  </span>
                )}
                {/* Kilometerstand- und Liter-Eingabefelder für Tanken-Transaktionen */}
                {isTanken && (
                  <>
                    <span className="mt-2 flex w-full flex-wrap gap-2 sm:mt-0 sm:w-auto">
                      <KilometerstandInput transaction={transaction} />
                      <LiterInput transaction={transaction} />
                    </span>
                  </>
                )}
              </h3>
              {transaction.isOneTimeInvestment ? (
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
                  {visibleInvestmentDates.has(transaction.id) && <span>{highlightSearchTerm(new Date(transaction.date).toLocaleDateString('de-DE'), searchTerm === activeSearchTerm ? activeSearchTerm : '')}</span>}
                </div>
              ) : (
                <span className="text-xs text-slate-500 mt-1 block">
                  {highlightSearchTerm(new Date(transaction.date).toLocaleDateString('de-DE'), searchTerm === activeSearchTerm ? activeSearchTerm : '')}
                </span>
              )}
            </div>
          </div>
          
          <div className="min-w-[5.75rem] self-start text-right sm:ml-2 sm:self-auto">
            <div className={`whitespace-nowrap text-sm font-semibold sm:text-base md:text-lg ${
              transaction.type === 'income' 
                ? 'text-green-400' 
                : 'text-red-400'
            }`}>
              {transaction.type === 'income' ? '+' : '-'}{formatAmount(Math.abs(transaction.amount))}
            </div>
          </div>

          {(onEditTransaction || onDeleteTransaction) && (
            <div className="col-span-2 -mt-1 flex justify-end opacity-100 transition-opacity sm:col-span-1 sm:ml-3 sm:mt-0 sm:group-hover:opacity-100">
              <DropdownMenu
                trigger={
                  <button
                    className="rounded-xl p-2.5 text-slate-400 transition-all hover:bg-slate-700/50 hover:text-slate-300"
                    title="Aktionen"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
                    </svg>
                  </button>
                }
                items={[
                  ...(onEditTransaction ? [{
                    label: 'Bearbeiten',
                    icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>,
                    onClick: () => onEditTransaction(transaction),
                    variant: 'default' as const
                  }] : []),
                  ...(onDeleteTransaction ? [{
                    label: deletingTransactions.has(transaction.id) ? 'Wird gelöscht...' : 'Löschen',
                    icon: deletingTransactions.has(transaction.id) ? <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg> : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>,
                    onClick: () => handleDeleteTransaction(transaction.id),
                    variant: 'destructive' as const
                  }] : [])
                ]}
              />
            </div>
          )}
        </div>
      </article>
    );
  };

  // Loading-Zustand
  if (isInitialLoading) {
    return (
      <div className="mx-auto max-w-4xl">
        <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur-lg sm:mt-8 sm:p-8">
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
      <div className="mx-auto max-w-4xl">
        <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur-lg sm:mt-8 sm:p-8">
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
    <div className="mx-auto max-w-4xl">
      <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-3.5 shadow-2xl backdrop-blur-lg sm:mt-8 sm:p-4">
      <div className="flex flex-col space-y-3 sm:space-y-0 sm:flex-row sm:items-center sm:justify-between mb-3 sm:mb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-3">
          {/* Title and Year Selection - direkt nebeneinander */}
          <div className="flex items-center space-x-2">
            <h2 className="text-xl sm:text-2xl font-semibold text-white">Transaktionen</h2>
            
            {/* Jahresauswahl als Dropdown - direkt neben dem Titel */}
            {availableYears.length > 1 && (
              <div className="relative">
              <select
                value={selectedYear}
                onChange={(e) => handleYearChange(parseInt(e.target.value))}
                className="block appearance-none w-full px-6 py-1.5 bg-slate-800 rounded-2xl text-white text-sm"
              >
                {availableYears.map(year => (
                <option key={year} value={year}>
                  {year}
                </option>
                ))}
              </select>
              </div>
            )}
          </div>
        </div>
        
        {/* Suchfeld mit integriertem Business-Toggle */}
        <div className="relative w-full sm:w-64">
          <input
            type="text"
            placeholder="Suchen..."
            value={searchTerm}
            onChange={(e) => handleSearchChange(e.target.value)}
            onKeyPress={handleKeyPress}
            className="block w-full rounded-2xl border border-slate-700/60 bg-slate-900/55 px-4 py-3 text-base text-white placeholder-slate-500 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 sm:text-sm"
          />
        </div>
      </div>
      
      <div className="space-y-4">
        {months.map((monthData) => (
          <div key={`${monthData.year}-${monthData.month}`}>
            {/* Monats-Header */}
            <button
              onClick={() => toggleMonth(monthData.year, monthData.month)}
              className="mb-2 w-full rounded-xl border border-transparent px-1 py-2 text-left transition-colors hover:border-slate-500/30 hover:bg-white/5"
            >
              <div className="flex items-center justify-between gap-3 border-b border-slate-600/30 pb-2">
                <h3 className="min-w-0 text-base font-semibold text-slate-200 sm:text-lg">
                  {getMonthName(monthData)}
                  <span className="ml-2 text-xs text-slate-500 sm:text-sm">
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
                    
                    {/* Monatsbilanz - anzeigen wenn Transaktionen vorhanden */}
                    {monthData.transactions && monthData.transactions.length > 0 && !activeSearchTerm.trim() && (
                      (() => {
                        const filteredTransactionsForBalance = filterTransactions(monthData.transactions);
                        const balance = calculateMonthBalance(filteredTransactionsForBalance);
                        const savingsRate = calculateSavingsRate(balance.income, balance.expenses);
                        return (
                          <div className="mt-3 pt-3 border-t border-slate-600/30">
                            <div className="rounded-2xl bg-slate-700/30 p-3 sm:p-3">
                              <div className="mb-3 flex flex-col gap-2 sm:mb-2 sm:flex-row sm:items-center sm:justify-between">
                                <h4 className="text-white font-medium text-sm">Monatsbilanz</h4>
                                <div className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                                  savingsRate >= 20 ? 'bg-green-500/20 text-green-300' :
                                  savingsRate >= 10 ? 'bg-blue-500/20 text-blue-300' :
                                  savingsRate >= 0 ? 'bg-yellow-500/20 text-yellow-300' :
                                  'bg-red-500/20 text-red-300'
                                }`}>
                                  Sparquote: {savingsRate >= 0 ? '+' : ''}{savingsRate.toFixed(1)}%
                                </div>
                              </div>
                              <div className="grid grid-cols-1 gap-2 text-sm min-[420px]:grid-cols-3 min-[420px]:gap-3">
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
      
      {/* Einzelinvestitionen Section */}
      {allMonths.some(m => m.year === selectedYear) && (
        <div className="mt-4 border-t border-slate-600/30 pt-4">
          <button
            onClick={toggleOneTime}
            className="w-full text-left mb-2 pb-1 transition-colors group flex items-center justify-between"
          >
            <h3 className="text-lg font-medium text-purple-300 group-hover:text-purple-200">
              Einzelinvestitionen {selectedYear}
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
            <div className="space-y-2 mt-3">
              {isLoadingOneTime ? (
                <div className="text-center py-4">
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-400"></div>
                    <span className="ml-3 text-slate-400">Lade Investitionen...</span>
                  </div>
                </div>
              ) : (
                <>
                  {(() => {
                    const filtered = filterTransactions(oneTimeInvestments);
                    if (filtered.length === 0) {
                      return (
                        <div className="text-center py-4 text-slate-400">
                          Keine Einzelinvestitionen in diesem Jahr.
                        </div>
                      );
                    }
                    
                    const { expenses, incomes } = sortAndSeparateTransactions(filtered);
                    
                    return (
                      <div className="space-y-6">
                        {expenses.length > 0 && (
                          <div>
                            <div className="space-y-2">
                              {expenses.map(renderTransaction)}
                            </div>
                          </div>
                        )}

                        {incomes.length > 0 && (
                          <div>
                            <h4 className="text-sm font-medium text-green-300 mb-3 border-b border-green-400/20 pb-2"></h4>
                            <div className="space-y-2">
                              {incomes.map(renderTransaction)}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Bilanzen, Geplante Ausgaben, Business und H+M Buttons am Ende */}
      <div className="mt-6 pt-4 border-t border-slate-600/30">
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 md:grid-cols-5">
          <Link 
            to="/bilanzen"
            className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 px-3 py-3 text-sm font-semibold text-white transition-all duration-200 hover:from-purple-700 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-slate-900 sm:px-6 sm:text-base"
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
            to="/tanken"
            className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-green-600 to-teal-600 px-3 py-3 text-sm font-semibold text-white transition-all duration-200 hover:from-green-700 hover:to-teal-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 focus:ring-offset-slate-900 sm:px-6 sm:text-base"
          >
            <span className="text-lg mr-2">⛽</span>
            Tanken
          </Link>
          
          <Link 
            to="/vermoegen"
            className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-3 py-3 text-sm font-semibold text-white transition-all duration-200 hover:from-emerald-700 hover:to-teal-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-slate-900 sm:px-6 sm:text-base"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Vermögen
          </Link>
          
          <Link 
            to="/business"
            className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-3 py-3 text-sm font-semibold text-white transition-all duration-200 hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-900 sm:px-6 sm:text-base"
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
            Business
          </Link>
          
          <Link 
            to="/hm"
            className="col-span-2 inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-orange-600 to-red-600 px-3 py-3 text-sm font-semibold text-white transition-all duration-200 hover:from-orange-700 hover:to-red-700 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 focus:ring-offset-slate-900 sm:col-span-1 sm:px-6 sm:text-base"
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
