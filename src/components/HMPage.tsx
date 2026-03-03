import { useState, useEffect, useMemo } from 'react';
import jsPDF from 'jspdf';
import { HMModal } from './HMModal';
import { HMEditModal } from './HMEditModal';
import { DropdownMenu } from './DropdownMenu';
import { ConfirmModal } from './ConfirmModal';
import { addTransaction, subscribeToTransactions, updateTransaction, deleteTransaction } from '../services/transactionService';
import type { Transaction } from '../types/Transaction';

type FilterPeriod = 'today' | 'week' | 'month' | 'year' | 'all';

export const HMPage = () => {
  const [showModal, setShowModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [transactionToEdit, setTransactionToEdit] = useState<Transaction | null>(null);
  const [transactionToDelete, setTransactionToDelete] = useState<string | null>(null);
  const [allHMTransactions, setAllHMTransactions] = useState<Transaction[]>([]);
  
  // State for filtering functionality
  const [filterPeriod, setFilterPeriod] = useState<FilterPeriod>('all');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const unsubscribe = subscribeToTransactions((transactions) => {
      // Filtere H+M Transaktionen
      const hmTransactions = transactions.filter(transaction => 
        transaction.description.startsWith('H+') || transaction.description.startsWith('M+')
      );
      
      // Sortiere alle H+M Transaktionen nach Datum
      const sortedTransactions = hmTransactions.sort((a, b) => {
        const dateCompare = new Date(b.date).getTime() - new Date(a.date).getTime();
        if (dateCompare !== 0) return dateCompare;
        // Bei gleichem Datum: Neueste Erstellung zuerst (basierend auf Timestamp)
        return (b.timestamp || 0) - (a.timestamp || 0);
      });
      
      setAllHMTransactions(sortedTransactions);
    });

    return unsubscribe;
  }, []);
  // Computed values for filtered transactions
  const filteredTransactions = useMemo(() => {
    let filtered = allHMTransactions;

    // Filter by period
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    filtered = filtered.filter(transaction => {
      const transactionDate = new Date(transaction.date);
      
      switch (filterPeriod) {
        case 'today':
          return transactionDate >= today;
        case 'week':
          return transactionDate >= startOfWeek;
        case 'month':
          return transactionDate >= startOfMonth;
        case 'year':
          return transactionDate >= startOfYear;
        default:
          return true;
      }
    });

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(transaction =>
        transaction.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        transaction.location.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    return filtered;
  }, [allHMTransactions, filterPeriod, searchTerm]);

  // Calculate debt summary
  const debtSummary = useMemo(() => {
    let netDebt = 0; // > 0: Hanna owes Martin, < 0: Martin owes Hanna
    let hPaid = 0;
    let mPaid = 0;

    filteredTransactions.forEach(t => {
      const amount = Math.abs(t.amount);
      
      if (t.description.startsWith('H+')) {
        hPaid += amount;
        if (t.description.includes('M schuldet H')) {
          netDebt -= amount; // Martin owes Hanna full amount
        } else {
          netDebt -= amount / 2; // Martin owes Hanna half
        }
      } else if (t.description.startsWith('M+')) {
        mPaid += amount;
        if (t.description.includes('H schuldet M')) {
          netDebt += amount; // Hanna owes Martin full amount
        } else {
          netDebt += amount / 2; // Hanna owes Martin half
        }
      }
    });

    return { netDebt, hPaid, mPaid };
  }, [filteredTransactions]);

  const handleSave = async (data: {
    description: string;
    amount: number;
    location: string;
    type: 'H' | 'M';
    debtor: 'H' | 'M' | 'none';
  }) => {
    try {
      let prefixedDescription = '';
      if (data.debtor === 'none') {
        prefixedDescription = `${data.type}+ ${data.description}`;
      } else if (data.debtor === 'H') {
        // H schuldet M, also hat M bezahlt
        prefixedDescription = `M+ ${data.description} (H schuldet M)`;
      } else { // data.debtor === 'M'
        // M schuldet H, also hat H bezahlt
        prefixedDescription = `H+ ${data.description} (M schuldet H)`;
      }
      
      await addTransaction({
        type: 'expense',
        amount: data.amount.toFixed(2).replace('.', ','),
        description: prefixedDescription,
        location: data.location,
      });

      console.log('H+M Transaktion erfolgreich gespeichert');
    } catch (error) {
      console.error('Error saving H+M transaction:', error);
      throw error;
    }
  };

  const handleEditTransaction = (transaction: Transaction) => {
    setTransactionToEdit(transaction);
    setShowEditModal(true);
  };

  const saveEditTransaction = async (transactionId: string, updatedData: {
    description: string;
    amount: number;
    location: string;
    type: 'H' | 'M';
    debtor: 'H' | 'M' | 'none';
    date: string;
  }) => {
    try {
      let prefixedDescription = '';
      if (updatedData.debtor === 'none') {
        prefixedDescription = `${updatedData.type}+ ${updatedData.description}`;
      } else if (updatedData.debtor === 'H') {
        // H schuldet M, also hat M bezahlt
        prefixedDescription = `M+ ${updatedData.description} (H schuldet M)`;
      } else { // data.debtor === 'M'
        // M schuldet H, also hat H bezahlt
        prefixedDescription = `H+ ${updatedData.description} (M schuldet H)`;
      }
      
      await updateTransaction(transactionId, {
        description: prefixedDescription,
        amount: updatedData.amount,
        location: updatedData.location,
        type: 'expense',
        date: updatedData.date
      });

      setShowEditModal(false);
      setTransactionToEdit(null);
      console.log('H+M Transaktion erfolgreich bearbeitet');
    } catch (error) {
      console.error('Error updating H+M transaction:', error);
      throw error;
    }
  };

  const cancelEditTransaction = () => {
    setShowEditModal(false);
    setTransactionToEdit(null);
  };

  const handleDeleteTransaction = (transactionId: string) => {
    setTransactionToDelete(transactionId);
    setShowDeleteModal(true);
  };

  const confirmDeleteTransaction = async () => {
    if (transactionToDelete) {
      try {
        await deleteTransaction(transactionToDelete);
        console.log('H+M Transaktion erfolgreich gelöscht');
      } catch (error) {
        console.error('Error deleting H+M transaction:', error);
      }
    }
    setShowDeleteModal(false);
    setTransactionToDelete(null);
  };

  const cancelDeleteTransaction = () => {
    setShowDeleteModal(false);
    setTransactionToDelete(null);
  };

  const handleAddToMain = async (transaction: Transaction) => {
    try {
      // Remove H+ or M+ prefix from description
      const cleanDescription = transaction.description.replace(/^[HM]\+ /, '');
      
      // Check if it's a debt transaction (contains "schuldet")
      const isDebtTransaction = transaction.description.toLowerCase().includes('schuldet');
      
      // For 50/50 transactions, only add half the amount
      const amount = isDebtTransaction ? Math.abs(transaction.amount) : Math.abs(transaction.amount) / 2;
      
      // Format amount as German decimal string
      const formattedAmount = amount.toFixed(2).replace('.', ',');
      
      await addTransaction({
        type: transaction.type,
        amount: formattedAmount,
        description: cleanDescription,
        location: transaction.location,
        date: transaction.date,
        isBusiness: false, // Add as personal transaction
      });
      
      // Mark this H+M transaction as added to main
      await updateTransaction(transaction.id, {
        addedToMain: true
      });
      
      console.log('Transaktion erfolgreich zur Main-Liste hinzugefügt');
    } catch (error) {
      console.error('Error adding transaction to main:', error);
    }
  };

  const formatAmount = (amount: number): string => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
    }).format(Math.abs(amount));
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const handleExportPDF = () => {
    const doc = new jsPDF();
    
    // Title
    doc.setFontSize(20);
    doc.text('H+M Abrechnung', 14, 22);
    
    // Info
    doc.setFontSize(11);
    doc.text(`Erstellt am: ${new Date().toLocaleDateString('de-DE')}`, 14, 30);
    
    const debtText = debtSummary.netDebt === 0 
      ? 'Alles ausgeglichen'
      : debtSummary.netDebt > 0 
        ? `Hanna schuldet Martin ${formatAmount(debtSummary.netDebt).replace('€', 'EUR')}`
        : `Martin schuldet Hanna ${formatAmount(Math.abs(debtSummary.netDebt)).replace('€', 'EUR')}`;
        
    doc.text(`Status: ${debtText}`, 14, 38);
    doc.text(`Gesamt Hanna: ${formatAmount(debtSummary.hPaid).replace('€', 'EUR')} | Gesamt Martin: ${formatAmount(debtSummary.mPaid).replace('€', 'EUR')}`, 14, 46);

    // Simple list generation (fallback without autoTable)
    let yPos = 60;
    doc.setFontSize(10);
    
    // Header
    doc.setFillColor(234, 88, 12); // Orange background
    doc.rect(14, yPos - 5, 182, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.text("Datum       Beschreibung                         Ort                Betrag      Wer", 16, yPos);
    
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'normal');
    yPos += 10;

    filteredTransactions.forEach(t => {
      if (yPos > 280) {
        doc.addPage();
        yPos = 20;
      }

      const isH = t.description.startsWith('H+');
      const cleanDesc = t.description
        .replace(/^[HM]\+ /, '')
        .replace(/\(H schuldet M\)/, '')
        .replace(/\(M schuldet H\)/, '')
        .substring(0, 35); // Truncate description
      
      const dateStr = new Date(t.date).toLocaleDateString('de-DE');
      const amountStr = formatAmount(t.amount).replace('€', 'EUR');
      const whoStr = isH ? 'Hanna' : 'Martin';
      const locStr = t.location.substring(0, 15);

      // Manual column alignment
      doc.text(dateStr, 16, yPos);
      doc.text(cleanDesc, 40, yPos);
      doc.text(locStr, 110, yPos);
      doc.text(amountStr, 150, yPos);
      doc.text(whoStr, 180, yPos);
      
      yPos += 7;
    });

    doc.save(`hm-abrechnung-${new Date().toISOString().split('T')[0]}.pdf`);
  };

  // Transaction card component - mobile optimized
  const TransactionCard = ({ transaction }: { transaction: Transaction }) => {
    const isH = transaction.description.startsWith('H+');
    const isDebt = transaction.description.includes('schuldet');
    
    let debtLabel = '';
    if (transaction.description.includes('H schuldet M')) {
      debtLabel = 'Hanna schuldet Martin';
    } else if (transaction.description.includes('M schuldet H')) {
      debtLabel = 'Martin schuldet Hanna';
    }

    const cleanDescription = transaction.description
      .replace(/^[HM]\+ /, '')
      .replace(/\(H schuldet M\)/, '')
      .replace(/\(M schuldet H\)/, '')
      .trim();
    
    // Determine split type for icon
    let splitIcon;
    let splitTooltip;
    if (isDebt) {
      splitIcon = (
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v3.586L7.707 9.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 10.586V7z" clipRule="evenodd" />
        </svg>
      );
      splitTooltip = "Schulden - eine Person zahlt alleine";
    } else {
      splitIcon = (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
        </svg>
      );
      splitTooltip = "50/50 - gemeinsame Ausgabe";
    }

    return (
      <div className="group bg-slate-800/30 border border-slate-600/20 rounded-lg sm:rounded-xl p-3 sm:p-4 hover:bg-slate-800/50 hover:border-slate-500/30 transition-all duration-200">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0 pr-2">
            {/* Mobile: Stack layout, Desktop: Same line */}
            <div className="flex flex-col space-y-1 sm:flex-row sm:items-center sm:space-y-0 sm:space-x-2 mb-2">
              <div className="flex items-center space-x-2">
                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold w-fit ${
                  isH 
                    ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-200' 
                    : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200'
                }`}>
                  {isH ? 'H' : 'M'}
                </span>
                <span 
                  className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs ${
                    isDebt 
                      ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' 
                      : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  }`}
                  title={splitTooltip}
                >
                  {splitIcon}
                </span>
              </div>
              <span className="text-slate-400 text-xs">{formatDate(transaction.date)}</span>
            </div>
            
            <h3 className="text-white font-medium text-sm sm:text-base mb-1 break-words leading-relaxed">
              {isDebt && <span className="text-blue-400 font-semibold text-xs block mb-0.5">{debtLabel || 'Schulden'}</span>}
              {cleanDescription}
            </h3>
            
            <div className="flex items-center space-x-1 sm:space-x-2 text-xs text-slate-400">
              <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="truncate">{transaction.location || 'Unbekannter Ort'}</span>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row items-end sm:items-center space-y-2 sm:space-y-0 sm:space-x-3">
            <div className={`font-bold text-sm sm:text-lg ${
              isH ? 'text-orange-400' : 'text-red-400'
            }`}>
              -{formatAmount(transaction.amount)}
            </div>
            
            {/* Three Dots Menu */}
            <div className="opacity-0 group-hover:opacity-100 transition-all duration-200">
              <DropdownMenu
                trigger={
                  <button className="p-1.5 sm:p-2 rounded-lg hover:bg-slate-700/50 transition-all duration-200 text-slate-400 hover:text-white">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                    </svg>
                  </button>
                }
                items={[
                  {
                    label: 'Bearbeiten',
                    icon: (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    ),
                    onClick: () => handleEditTransaction(transaction)
                  },
                  {
                    label: 'Zu Main hinzufügen',
                    icon: (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    ),
                    onClick: () => handleAddToMain(transaction),
                    disabled: transaction.addedToMain === true
                  },
                  {
                    label: 'Löschen',
                    icon: (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    ),
                    onClick: () => handleDeleteTransaction(transaction.id),
                    variant: 'destructive' as const
                  }
                ]}
              />
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Filter controls - mobile optimized
  const FilterControls = () => (
    <div className="space-y-3 sm:space-y-0 sm:flex sm:flex-row sm:gap-4 sm:items-center sm:justify-between">
      {/* Search */}
      <div className="relative w-full sm:flex-1 sm:max-w-md">
        <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          placeholder="Suche..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-3 sm:py-2.5 bg-slate-800/50 border border-slate-600/30 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm"
        />
      </div>

      {/* Period Filter - schmaler */}
      <div className="w-full sm:w-48">
        <select
          value={filterPeriod}
          onChange={(e) => setFilterPeriod(e.target.value as FilterPeriod)}
          className="w-full px-3 py-3 sm:py-2 bg-slate-800/50 border border-slate-600/30 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
        >
          <option value="today">Heute</option>
          <option value="week">Diese Woche</option>
          <option value="month">Dieser Monat</option>
          <option value="year">Dieses Jahr</option>
          <option value="all">Alle Zeit</option>
        </select>
      </div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-4 pt-2 sm:pt-4 pb-4 sm:pb-8">
      {/* Header */}
      <div className="bg-gradient-to-br from-slate-800/40 to-slate-900/60 backdrop-blur-lg rounded-xl sm:rounded-2xl border border-white/10 p-4 sm:p-6 shadow-2xl mb-4 sm:mb-8">
        <div className="text-center">
          <div className="flex items-center justify-center mb-3 sm:mb-4">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold bg-gradient-to-r from-orange-400 via-red-500 to-orange-400 bg-clip-text text-transparent">
              H+M
            </h1>
          </div>
          
          <div className="w-16 sm:w-20 h-1 bg-gradient-to-r from-orange-400 to-red-400 mx-auto mb-4 sm:mb-8 opacity-60 rounded-full"></div>
          
          {/* Debt Summary */}
          <div className="mb-6 sm:mb-8 p-4 bg-slate-800/50 rounded-xl border border-white/5">
            <div className="text-slate-400 text-sm mb-1">Aktueller Stand</div>
            <div className={`text-xl sm:text-2xl font-bold ${
              Math.abs(debtSummary.netDebt) < 0.01 
                ? 'text-slate-200' 
                : debtSummary.netDebt > 0 
                  ? 'text-emerald-400' 
                  : 'text-red-400'
            }`}>
              {Math.abs(debtSummary.netDebt) < 0.01 
                ? 'Alles ausgeglichen' 
                : debtSummary.netDebt > 0 
                  ? `Hanna schuldet Martin ${formatAmount(debtSummary.netDebt)}`
                  : `Martin schuldet Hanna ${formatAmount(debtSummary.netDebt)}`
              }
            </div>
            <div className="flex justify-center gap-8 mt-4 text-xs sm:text-sm text-slate-400">
              <div>
                <span className="block text-orange-400 font-semibold">{formatAmount(debtSummary.hPaid)}</span>
                <span>Hanna bezahlt</span>
              </div>
              <div>
                <span className="block text-red-400 font-semibold">{formatAmount(debtSummary.mPaid)}</span>
                <span>Martin bezahlt</span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => setShowModal(true)}
              className="w-full sm:w-auto inline-flex items-center justify-center px-6 sm:px-8 py-3 sm:py-4 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white font-semibold rounded-lg transition-all duration-200 transform hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 focus:ring-offset-slate-900 shadow-lg text-sm sm:text-base"
            >
              <svg 
                className="w-4 h-4 sm:w-5 sm:h-5 mr-2" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M12 4v16m8-8H4" 
                />
              </svg>
              Neue Ausgabe
            </button>

            <button
              onClick={handleExportPDF}
              className="w-full sm:w-auto inline-flex items-center justify-center px-6 sm:px-8 py-3 sm:py-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-all duration-200 transform hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-900 shadow-lg text-sm sm:text-base"
            >
              <svg className="w-4 h-4 sm:w-5 sm:h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              PDF Export
            </button>
          </div>
        </div>
      </div>

      {/* Filter Controls */}
      <div className="bg-slate-800/30 backdrop-blur-sm border border-slate-600/20 rounded-lg sm:rounded-xl p-3 sm:p-4 mb-4 sm:mb-6">
        <FilterControls />
      </div>

      {/* Transaction List with Settlement Groups */}
      <div className="space-y-6">
        {filteredTransactions.length === 0 ? (
          <div className="bg-slate-800/30 backdrop-blur-sm border border-slate-600/20 rounded-lg sm:rounded-xl p-3 sm:p-6 shadow-xl">
            <div className="text-center py-12 text-slate-400">
              <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-lg font-medium mb-2">Keine Transaktionen gefunden</p>
              <p className="text-sm">Versuchen Sie, Ihre Filter anzupassen oder eine neue Ausgabe hinzuzufügen</p>
            </div>
          </div>
        ) : (
          <div className="bg-slate-800/30 backdrop-blur-sm border border-slate-600/20 rounded-lg sm:rounded-xl p-3 sm:p-6 shadow-xl">
            <div className="space-y-2 sm:space-y-3">
              {filteredTransactions.map(transaction => (
                <TransactionCard key={transaction.id} transaction={transaction} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <HMModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSave={handleSave}
      />

      <HMEditModal
        isOpen={showEditModal}
        transaction={transactionToEdit}
        onSave={saveEditTransaction}
        onCancel={cancelEditTransaction}
      />

      <ConfirmModal
        isOpen={showDeleteModal}
        title="H+M Transaktion löschen"
        message="Sind Sie sicher, dass Sie diese Transaktion löschen möchten? Diese Aktion kann nicht rückgängig gemacht werden."
        confirmText="Löschen"
        cancelText="Abbrechen"
        onConfirm={confirmDeleteTransaction}
        onCancel={cancelDeleteTransaction}
        isDestructive={true}
      />

      <div className="text-center mt-6 text-slate-500 text-xs opacity-50">
        v1.1
      </div>
    </div>
  );
};