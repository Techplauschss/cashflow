import { useState, useEffect } from 'react';
import type { Transaction } from '../types/Transaction';
import { getTransactionsForMonth, getAvailableMonths, addTransaction } from '../services/transactionService';
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
  isExpanded: boolean;
  income: number;
  expenses: number;
  balance: number;
}

interface BusinessOverviewPageProps {
  onDeleteTransaction?: (transactionId: string) => void;
  onEditTransaction?: (transaction: any) => void;
}

export const BusinessOverviewPage = ({ onDeleteTransaction, onEditTransaction }: BusinessOverviewPageProps) => {
  const [months, setMonths] = useState<MonthData[]>([]);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState<number | 'all'>(new Date().getFullYear());
  const [availableYears, setAvailableYears] = useState<number[]>([]);

  // Form state variables
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [location, setLocation] = useState('');
  const [type, setType] = useState<'E' | 'A'>('A'); // E = Einnahme, A = Ausgabe
  const [isBusiness, setIsBusiness] = useState(true); // Standardmäßig Business-Transaktion

  // Delete loading state
  const [deletingTransactions, setDeletingTransactions] = useState<Set<string>>(new Set());



  // Betrag formatieren (für Anzeige)
  const formatAmountDisplay = (amount: number): string => {
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

  // Wrapper für Lösch-Funktion mit Loading-State
  const handleDeleteTransaction = async (transactionId: string) => {
    if (!onDeleteTransaction) return;

    setDeletingTransactions(prev => new Set(prev).add(transactionId));
    try {
      // DELETE-Request senden, aber nicht auf Rückmeldung warten
      onDeleteTransaction(transactionId);
      
      // SOFORT die gesamte Seite neu laden
      window.location.reload();
    } finally {
      setDeletingTransactions(prev => {
        const newSet = new Set(prev);
        newSet.delete(transactionId);
        return newSet;
      });
    }
  };

  // Form Handler Functions
  const handleAmountKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Erlaubte Tasten: Zahlen (0-9), Komma, Punkt, Backspace, Delete, Tab, Enter, Pfeiltasten
    const allowedKeys = [
      'Backspace', 'Delete', 'Tab', 'Enter', 'ArrowLeft', 'ArrowRight', 
      'ArrowUp', 'ArrowDown', 'Home', 'End'
    ];
    
    const isNumber = /^[0-9]$/.test(e.key);
    const isCommaOrDot = e.key === ',' || e.key === '.';
    const isAllowedKey = allowedKeys.includes(e.key);
    const isCtrlA = e.ctrlKey && e.key === 'a';
    const isCtrlC = e.ctrlKey && e.key === 'c';
    const isCtrlV = e.ctrlKey && e.key === 'v';
    const isCtrlX = e.ctrlKey && e.key === 'x';
    
    if (!isNumber && !isCommaOrDot && !isAllowedKey && !isCtrlA && !isCtrlC && !isCtrlV && !isCtrlX) {
      e.preventDefault();
    }
  };

  const formatAmount = (value: string): string => {
    // Entferne alle Punkte (Tausendertrennzeichen) aber behalte Kommas (Dezimaltrennzeichen)
    const cleanValue = value.replace(/\./g, '');
    
    // Teile den Wert in Ganzzahl und Dezimalstellen
    const parts = cleanValue.split(',');
    const integerPart = parts[0];
    let decimalPart = parts[1];
    
    // Begrenze Dezimalstellen auf maximal 2 Zeichen
    if (decimalPart && decimalPart.length > 2) {
      decimalPart = decimalPart.substring(0, 2);
    }
    
    // Formatiere den Ganzzahlteil mit Tausendertrennzeichen
    const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    
    // Füge Dezimalstellen hinzu, falls vorhanden
    return decimalPart !== undefined ? `${formattedInteger},${decimalPart}` : formattedInteger;
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    const formattedValue = formatAmount(inputValue);
    setAmount(formattedValue);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validierung
    if (!description.trim() || !amount.trim()) {
      alert('Bitte füllen Sie alle Pflichtfelder aus.');
      return;
    }

    try {
      console.log('💾 [BusinessOverviewPage handleSubmit] Attempting to add business transaction...');
      // POST senden, aber nicht auf Rückmeldung warten
      addTransaction({
        type: type === 'E' ? 'income' : 'expense',
        amount: amount,
        description: description.trim(),
        location: location.trim() || 'Unbekannt',
        isBusiness: isBusiness,
      });

      // SOFORT die gesamte Seite neu laden (ohne auf Antwort zu warten)
      window.location.reload();
      
    } catch (error) {
      console.error('Error adding business transaction:', error);
      alert('Fehler beim Hinzufügen der Geschäftstransaktion. Bitte versuchen Sie es erneut.');
    }
  };

  // Lade verfügbare Monate (nur Metadaten, keine Transaktionen)
  const loadAvailableMonths = async () => {
    try {
      const availableMonths = await getAvailableMonths();
      
      // Extrahiere verfügbare Jahre
      const years = [...new Set(availableMonths.map(month => month.year))].sort((a, b) => b - a);
      setAvailableYears(years);

      // Erstelle Monats-Objekte ohne Transaktionen (lazy loading)
      const currentDate = new Date();
      const currentMonthYear = currentDate.toLocaleDateString('de-DE', {
        month: 'long',
        year: 'numeric',
      });

      const monthsWithState = availableMonths.map(month => ({
        ...month,
        transactions: undefined,
        businessTransactions: undefined,
        businessCount: 0, // Wird später berechnet
        income: 0,
        expenses: 0,
        balance: 0,
        isLoading: false,
        isExpanded: month.monthYear === currentMonthYear, // Aktueller Monat ist standardmäßig expanded
      }));

      setMonths(monthsWithState);
      
      // Lade Transaktionen für den aktuellen Monat automatisch
      const currentMonth = monthsWithState.find(m => m.monthYear === currentMonthYear);
      if (currentMonth) {
        await loadTransactionsForMonth(currentMonth.year, currentMonth.month);
      }
      
      setIsInitialLoading(false);
    } catch (error) {
      console.error('Error loading months:', error);
      setIsInitialLoading(false);
    }
  };

  // Lade Transaktionen für einen bestimmten Monat (lazy loading)
  const loadTransactionsForMonth = async (year: number, month: number) => {
    console.log(`📥 [loadTransactionsForMonth] Loading transactions for ${year}-${month}`);
    
    setMonths(prev => prev.map(m =>
      m.year === year && m.month === month
        ? { ...m, isLoading: true }
        : m
    ));

    try {
      const transactions = await getTransactionsForMonth(year, month);
      const businessBalance = calculateBusinessBalance(transactions);
      const businessTransactions = getBusinessTransactions(transactions);
      
      setMonths(prev => prev.map(m =>
        m.year === year && m.month === month
          ? { 
              ...m, 
              transactions, 
              businessTransactions,
              businessCount: businessBalance.count,
              income: businessBalance.income,
              expenses: businessBalance.expenses,
              balance: businessBalance.balance,
              isLoading: false 
            }
          : m
      ));
      console.log(`✅ [loadTransactionsForMonth] Updated month data for ${year}-${month}`);
    } catch (error) {
      console.error(`❌ [loadTransactionsForMonth] Error loading transactions for ${year}-${month}:`, error);
      setMonths(prev => prev.map(m =>
        m.year === year && m.month === month
          ? { ...m, isLoading: false }
          : m
      ));
    }
  };

  // Monat ein-/ausklappen (lazy loading trigger)
  const toggleMonth = async (year: number, month: number) => {
    const monthData = months.find(m => m.year === year && m.month === month);
    if (!monthData) return;

    const newExpandedState = !monthData.isExpanded;
    setMonths(prev => prev.map(m => 
      m.year === year && m.month === month 
        ? { ...m, isExpanded: newExpandedState }
        : m
    ));

    // Lade Transaktionen, wenn der Monat zum ersten Mal expandiert wird
    if (newExpandedState && !monthData.transactions && !monthData.isLoading) {
      await loadTransactionsForMonth(year, month);
    }
  };

  useEffect(() => {
    loadAvailableMonths();
  }, []);

  // Filtere Monate nach ausgewähltem Jahr (nur geladene Monate anzeigen)
  const filteredMonths = selectedYear === 'all' 
    ? months.filter(month => month.businessCount > 0 || month.transactions !== undefined) // Monate mit Business-Transaktionen oder bereits geladene
    : months.filter(month => month.year === selectedYear && (month.businessCount > 0 || month.transactions !== undefined));



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
            </div>
          </div>



          {/* Input Form - Mobile optimiert */}
          <div className="bg-slate-800/30 backdrop-blur-lg rounded-lg border border-slate-600/30 p-4 mb-8">
            <form className="space-y-3 sm:space-y-4" onSubmit={handleSubmit}>
              {/* Mobile Layout - Stacked - Kompakter */}
              <div className="block sm:hidden space-y-3">
                {/* Amount Input - Mobile */}
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-slate-400">€</span>
                  <input
                    type="text"
                    id="business-amount"
                    value={amount}
                    onChange={handleAmountChange}
                    onKeyDown={handleAmountKeyDown}
                    className="w-full pl-8 pr-4 py-2.5 bg-slate-800/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-base"
                    placeholder="0,00"
                  />
                </div>

                {/* Description Input - Mobile */}
                <input
                  type="text"
                  id="business-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-800/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-base"
                  placeholder="Titel"
                />

                {/* Location and Type Row - Mobile - Kompakter */}
                <div className="grid grid-cols-5 gap-2">
                  <div className="col-span-2">
                    <input
                      type="text"
                      id="business-location-mobile"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      className="w-full px-3 py-2.5 bg-slate-800/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-base"
                      placeholder="Ort"
                    />
                  </div>
                  <div className="col-span-1 flex items-center justify-center">
                    <button
                      type="button"
                      onClick={() => setIsBusiness(!isBusiness)}
                      className={`w-8 h-8 rounded-lg font-bold text-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        isBusiness ? 'bg-blue-600 text-white' : 'bg-slate-600 text-slate-300'
                      }`}
                      title={isBusiness ? "Geschäftstransaktion" : "Private Transaktion"}
                    >
                      B
                    </button>
                  </div>
                  <div className="col-span-2 flex items-center justify-center">
                    <button
                      type="button"
                      onClick={() => setType(type === 'E' ? 'A' : 'E')}
                      className={`relative inline-flex h-9 w-16 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        type === 'E' ? 'bg-green-600' : 'bg-red-600'
                      }`}
                    >
                      <span
                        className={`inline-block h-7 w-7 transform rounded-full bg-white transition-transform duration-200 ${
                          type === 'E' ? 'translate-x-1' : 'translate-x-8'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>

              {/* Desktop Layout - Grid */}
              <div className="hidden sm:block">
                <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
                  {/* Amount Input */}
                  <div className="md:col-span-1">
                    <div className="relative">
                      <span className="absolute left-3 top-3 text-slate-400">€</span>
                      <input
                        type="text"
                        id="business-amount-desktop"
                        value={amount}
                        onChange={handleAmountChange}
                        onKeyDown={handleAmountKeyDown}
                        className="w-full pl-8 pr-4 py-3 bg-slate-800/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                        placeholder="0,00"
                      />
                    </div>
                  </div>

                  {/* Description Input */}
                  <div className="md:col-span-3">
                    <input
                      type="text"
                      id="business-description-desktop"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-800/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      placeholder="Titel"
                    />
                  </div>

                  {/* Location Input */}
                  <div className="md:col-span-1">
                    <input
                      type="text"
                      id="business-location-desktop"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-800/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      placeholder="Ort"
                    />
                  </div>

                  {/* Business Button */}
                  <div className="md:col-span-1 flex items-center justify-center">
                    <button
                      type="button"
                      onClick={() => setIsBusiness(!isBusiness)}
                      className={`w-12 h-12 rounded-3xl font-bold text-lg transition-all duration-200 ${
                        isBusiness ? 'bg-blue-700 text-white shadow-xl' : 'bg-slate-800 text-white hover:bg-slate-200 hover:text-black'
                      }`}
                      title={isBusiness ? "Geschäftstransaktion" : "Private Transaktion"}
                    >
                      B
                    </button>
                  </div>

                  {/* Type Switch */}
                  <div className="md:col-span-1 flex items-center justify-center">
                    <div className="flex items-center justify-center space-x-3 h-14">
                      <span className={`text-lg font-medium ${type === 'E' ? 'text-green-600' : 'text-slate-400'}`}>
                        E
                      </span>
                      <button
                        type="button"
                        onClick={() => setType(type === 'E' ? 'A' : 'E')}
                        className={`relative inline-flex h-6 w-20 items-center rounded-full transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-900 ${
                          type === 'E' ? 'bg-green-600' : 'bg-red-600'
                        }`}
                      >
                        <span
                          className={`inline-block h-8 w-8 transform rounded-full bg-white transition-transform duration-200 ${
                            type === 'E' ? 'translate-x' : 'translate-x-12'
                          }`}
                        />
                      </button>
                      <span className={`text-lg font-medium ${type === 'A' ? 'text-red-400' : 'text-slate-400'}`}>
                        A
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Submit Button - Mobile optimiert */}
              <button
                type="submit"
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold py-2.5 sm:py-4 px-6 rounded-lg transition-all duration-200 transform hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-900 text-base sm:text-base"
              >
                Geschäftstransaktion hinzufügen
              </button>
            </form>
          </div>

          {/* Monatsweise Aufschlüsselung */}
          <div className="space-y-6">
            {filteredMonths.map((monthData) => (
              <div key={`${monthData.year}-${monthData.month}`}>
                {/* Monats-Header - Klickbar für Expand/Collapse */}
                <div 
                  className="mb-4 border-b border-slate-600/30 pb-2 cursor-pointer hover:bg-slate-800/20 rounded-lg p-2 transition-all"
                  onClick={() => toggleMonth(monthData.year, monthData.month)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <button
                        className={`transform transition-transform duration-200 ${monthData.isExpanded ? 'rotate-90' : ''}`}
                        title={monthData.isExpanded ? 'Einklappen' : 'Ausklappen'}
                      >
                        <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                      <h3 className="text-lg font-medium text-slate-300">
                        {monthData.monthYear}
                        <span className="ml-2 text-sm text-slate-500">
                          ({monthData.businessCount} Geschäftstransaktionen)
                        </span>
                      </h3>
                      {monthData.isLoading && (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-400"></div>
                      )}
                    </div>
                    <div className="text-right">
                      <div className={`text-lg font-semibold ${monthData.balance >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {monthData.balance >= 0 ? '+' : ''}{formatAmountDisplay(monthData.balance)}€
                      </div>
                      <div className="text-xs text-slate-400">
                        +{formatAmountDisplay(monthData.income)}€ | -{formatAmountDisplay(monthData.expenses)}€
                      </div>
                    </div>
                  </div>
                </div>

                {/* Transaktionen - nur anzeigen wenn expanded */}
                {monthData.isExpanded && (
                  <div className="space-y-3">
                    {monthData.businessTransactions && sortTransactionsByAmount(monthData.businessTransactions).map((transaction) => (
                    <div
                      key={transaction.id}
                      className={`group bg-slate-800/30 border border-slate-600/30 rounded-lg p-4 hover:bg-slate-800/50 transition-all relative ${
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
                            {transaction.type === 'income' ? '+' : '-'}{formatAmountDisplay(Math.abs(transaction.amount))}€
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
                                  label: deletingTransactions.has(transaction.id) ? 'Wird gelöscht...' : 'Löschen',
                                  icon: deletingTransactions.has(transaction.id) ? (
                                    <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                    </svg>
                                  ) : (
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                  ),
                                  onClick: () => handleDeleteTransaction(transaction.id),
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