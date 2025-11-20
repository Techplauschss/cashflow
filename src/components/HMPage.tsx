import { useState, useEffect, useMemo } from 'react';
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
      const sortedTransactions = hmTransactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      
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

  // Schulden-Berechnung
  const debtCalculation = useMemo(() => {
    const sharedTransactions = filteredTransactions.filter(t => !t.description.includes('schuldet'));
    const debtTransactions = filteredTransactions.filter(t => t.description.includes('schuldet'));

    const hSharedTotal = sharedTransactions
      .filter(t => t.description.startsWith('H+'))
      .reduce((sum, t) => sum + t.amount, 0);
    
    const mSharedTotal = sharedTransactions
      .filter(t => t.description.startsWith('M+'))
      .reduce((sum, t) => sum + t.amount, 0);

    const totalSharedExpenses = hSharedTotal + mSharedTotal;
    const halfSharedTotal = totalSharedExpenses / 2;

    const martinPaidShared = hSharedTotal;
    
    // This is the debt from the 50/50 split
    let martinOwes = halfSharedTotal - martinPaidShared;

    // Now add the explicit debts
    debtTransactions.forEach(t => {
        if (t.description.includes('H schuldet M')) { // H owes M, M paid
            martinOwes += t.amount;
        } else if (t.description.includes('M schuldet H')) { // M owes H, H paid
            martinOwes -= t.amount;
        }
    });

    const netDebt = -martinOwes; // Positiv = Hanna schuldet Martin, Negativ = Martin schuldet Hanna

    const hTotal = filteredTransactions
      .filter(t => t.description.startsWith('H+'))
      .reduce((sum, t) => sum + t.amount, 0);
    
    const mTotal = filteredTransactions
      .filter(t => t.description.startsWith('M+'))
      .reduce((sum, t) => sum + t.amount, 0);

    return {
      hTotal,
      mTotal,
      totalExpenses: hTotal + mTotal,
      martinPaid: hTotal, // This is not just martinPaid anymore, it's H's total payment
      hannaPaid: mTotal, // M's total payment
      netDebt
    };
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
        amount: data.amount.toString(),
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
        date: transactionToEdit?.date || new Date().toISOString().split('T')[0]
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

  // Transaction card component - mobile optimized
  const TransactionCard = ({ transaction }: { transaction: Transaction }) => {
    const isH = transaction.description.startsWith('H+');
    const isDebt = transaction.description.includes('schuldet');
    const cleanDescription = transaction.description.replace(/^[HM]\+ /, '').replace(/\(H schuldet M\)/, '').replace(/\(M schuldet H\)/, '');

    return (
      <div className="group bg-slate-800/30 border border-slate-600/20 rounded-lg sm:rounded-xl p-3 sm:p-4 hover:bg-slate-800/50 hover:border-slate-500/30 transition-all duration-200">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0 pr-2">
            {/* Mobile: Stack layout, Desktop: Same line */}
            <div className="flex flex-col space-y-1 sm:flex-row sm:items-center sm:space-y-0 sm:space-x-2 mb-2">
              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold w-fit ${
                isH 
                  ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-200' 
                  : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200'
              }`}>
                {isH ? 'H' : 'M'}
              </span>
              <span className="text-slate-400 text-xs">{formatDate(transaction.date)}</span>
            </div>
            
            <h3 className="text-white font-medium text-sm sm:text-base mb-1 break-words leading-relaxed">
              {isDebt && <span className="text-blue-400 font-semibold">Schulden: </span>}
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

  // Schulden-Übersicht Komponente - kompakt
  const DebtOverview = () => {
    if (debtCalculation.totalExpenses === 0) return null;

    return (
      <div className="bg-slate-800/30 border border-slate-600/20 rounded-lg p-3 sm:p-4 mb-4">
        <div className="flex items-center justify-between space-x-3">
          {/* Kompakte Ausgaben-Info */}
          <div className="flex items-center space-x-2 sm:space-x-4 text-sm">
            <div className="flex items-center space-x-1">
              <span className="inline-flex items-center justify-center w-5 h-5 bg-orange-500/20 border border-orange-500/30 rounded text-orange-400 text-xs font-bold">H</span>
              <span className="text-slate-300 text-xs sm:text-sm">{formatAmount(debtCalculation.hTotal)}</span>
            </div>
            <div className="flex items-center space-x-1">
              <span className="inline-flex items-center justify-center w-5 h-5 bg-red-500/20 border border-red-500/30 rounded text-red-400 text-xs font-bold">M</span>
              <span className="text-slate-300 text-xs sm:text-sm">{formatAmount(debtCalculation.mTotal)}</span>
            </div>
          </div>

          {/* Kompakte Bilanz */}
          <div className="text-right flex-shrink-0">
            <div className={`font-semibold text-xs sm:text-base ${
              debtCalculation.netDebt > 0 
                ? 'text-red-400' 
                : debtCalculation.netDebt < 0 
                  ? 'text-emerald-400'
                  : 'text-slate-300'
            }`}>
              {debtCalculation.netDebt === 0 
                ? 'Ausgeglichen' 
                : debtCalculation.netDebt > 0 
                  ? `Martin schuldet Hanna ${formatAmount(Math.abs(debtCalculation.netDebt))}`
                  : `Hanna schuldet Martin ${formatAmount(Math.abs(debtCalculation.netDebt))}`
              }
            </div>
          </div>
        </div>
      </div>
    );
  };

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
          
          {/* Add Transaction Button */}
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
        </div>
      </div>

      {/* Filter Controls */}
      <div className="bg-slate-800/30 backdrop-blur-sm border border-slate-600/20 rounded-lg sm:rounded-xl p-3 sm:p-4 mb-4 sm:mb-6">
        <FilterControls />
      </div>

      {/* Schulden-Übersicht */}
      <DebtOverview />

      {/* Transaction List */}
      <div className="bg-slate-800/30 backdrop-blur-sm border border-slate-600/20 rounded-lg sm:rounded-xl p-3 sm:p-6 shadow-xl">
        <div className="space-y-2 sm:space-y-3">
          {filteredTransactions.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-lg font-medium mb-2">Keine Transaktionen gefunden</p>
              <p className="text-sm">Versuchen Sie, Ihre Filter anzupassen oder eine neue Ausgabe hinzuzufügen</p>
            </div>
          ) : (
            filteredTransactions.map(transaction => (
              <TransactionCard key={transaction.id} transaction={transaction} />
            ))
          )}
        </div>
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
    </div>
  );
};
