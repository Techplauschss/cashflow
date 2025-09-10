import { useState, useEffect, useMemo } from 'react';
import { HMModal } from './HMModal';
import { HMEditModal } from './HMEditModal';
import { DropdownMenu } from './DropdownMenu';
import { ConfirmModal } from './ConfirmModal';
import { addTransaction, subscribeToTransactions, updateTransaction, deleteTransaction } from '../services/transactionService';
import type { Transaction } from '../types/Transaction';

type ViewMode = 'dashboard' | 'list' | 'analytics';
type FilterPeriod = 'today' | 'week' | 'month' | 'year' | 'all';
type CategoryFilter = 'all' | 'H' | 'M';

export const HMPage = () => {
  const [showModal, setShowModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [transactionToEdit, setTransactionToEdit] = useState<Transaction | null>(null);
  const [transactionToDelete, setTransactionToDelete] = useState<string | null>(null);
  const [allHMTransactions, setAllHMTransactions] = useState<Transaction[]>([]);
  
  // New state for enhanced functionality
  const [viewMode, setViewMode] = useState<ViewMode>('dashboard');
  const [filterPeriod, setFilterPeriod] = useState<FilterPeriod>('month');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
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

    // Filter by category
    if (categoryFilter === 'H') {
      filtered = filtered.filter(t => t.description.startsWith('H+'));
    } else if (categoryFilter === 'M') {
      filtered = filtered.filter(t => t.description.startsWith('M+'));
    }

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
  }, [allHMTransactions, categoryFilter, filterPeriod, searchTerm]);

  // Statistics calculations
  const statistics = useMemo(() => {
    const hTransactions = filteredTransactions.filter(t => t.description.startsWith('H+'));
    const mTransactions = filteredTransactions.filter(t => t.description.startsWith('M+'));
    
    const hTotal = hTransactions.reduce((sum, t) => sum + t.amount, 0);
    const mTotal = mTransactions.reduce((sum, t) => sum + t.amount, 0);
    const total = hTotal + mTotal;

    return {
      h: { count: hTransactions.length, total: hTotal, transactions: hTransactions },
      m: { count: mTransactions.length, total: mTotal, transactions: mTransactions },
      total: { count: filteredTransactions.length, total }
    };
  }, [filteredTransactions]);
    description: string;
    amount: number;
    location: string;
    type: 'H' | 'M';
  }) => {
    try {
      // Füge das Präfix H+ oder M+ zur Beschreibung hinzu
      const prefixedDescription = `${data.type}+ ${data.description}`;
      
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
  }) => {
    try {
      // Füge das Präfix H+ oder M+ zur Beschreibung hinzu
      const prefixedDescription = `${updatedData.type}+ ${updatedData.description}`;
      
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

  const TransactionCard = ({ transaction, color }: { transaction: Transaction; color: 'orange' | 'red' }) => (
    <div className="group bg-slate-800/30 border border-slate-600/30 rounded-lg p-3 hover:bg-slate-800/50 transition-all">
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <h3 className="text-white font-medium text-sm break-words">
            {transaction.description.replace(/^[HM]\+ /, '')}
          </h3>
          <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
            <span>{transaction.location}</span>
            <span>•</span>
            <span>{formatDate(transaction.date)}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className={`text-${color}-400 font-semibold text-sm`}>
            -{formatAmount(transaction.amount)}
          </div>
          
          {/* Three Dots Menu */}
          <div className="opacity-0 group-hover:opacity-100 transition-all duration-200">
            <DropdownMenu
              trigger={
                <button className="p-1 rounded-md hover:bg-slate-700/50 transition-all duration-200 text-slate-400 hover:text-white">
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

  return (
    <div className="max-w-6xl mx-auto px-4 pt-4 sm:pt-8">
      {/* Header mit Button */}
      <div className="bg-white/5 backdrop-blur-lg rounded-xl sm:rounded-2xl border border-white/10 p-6 sm:p-8 shadow-2xl">
        <div className="text-center">
          <h2 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-orange-400 via-red-500 to-orange-400 bg-clip-text text-transparent mb-2 sm:mb-3">
            ⚡ H+M
          </h2>
          <div className="w-12 sm:w-16 h-0.5 bg-gradient-to-r from-orange-400 to-red-400 mx-auto mb-4 sm:mb-6 opacity-60"></div>
          
          <p className="text-slate-400 text-lg mb-8">
            Verwalten Sie Ihre H- und M-Ausgaben
          </p>
          
          {/* Add Transaction Button */}
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center justify-center px-8 py-4 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white font-semibold rounded-lg transition-all duration-200 transform hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 focus:ring-offset-slate-900"
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
                d="M12 4v16m8-8H4" 
              />
            </svg>
            H+M Ausgabe hinzufügen
          </button>
        </div>
      </div>

      {/* H und M Bereiche */}
      <div className="grid md:grid-cols-2 gap-6 mt-6">
        {/* H Bereich */}
        <div className="bg-white/5 backdrop-blur-lg rounded-xl border border-white/10 p-6 shadow-2xl relative">
          <div className="text-center mb-6">
            <h3 className="text-xl font-bold text-orange-400 mb-2">⚡ H</h3>
            <p className="text-slate-400 text-sm">Kategorie H</p>
            {hTransactions.length > 0 && (
              <p className="text-slate-500 text-xs mt-1">
                {hTransactions.length} Transaktionen • {formatAmount(hTransactions.reduce((sum, t) => sum + t.amount, 0))}
              </p>
            )}
          </div>
          
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {hTransactions.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <svg className="w-8 h-8 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-sm">Noch keine H-Transaktionen</p>
              </div>
            ) : (
              hTransactions.map(transaction => (
                <TransactionCard key={transaction.id} transaction={transaction} color="orange" />
              ))
            )}
          </div>
        </div>

        {/* M Bereich */}
        <div className="bg-white/5 backdrop-blur-lg rounded-xl border border-white/10 p-6 shadow-2xl relative">
          <div className="text-center mb-6">
            <h3 className="text-xl font-bold text-red-400 mb-2">⚡ M</h3>
            <p className="text-slate-400 text-sm">Kategorie M</p>
            {mTransactions.length > 0 && (
              <p className="text-slate-500 text-xs mt-1">
                {mTransactions.length} Transaktionen • {formatAmount(mTransactions.reduce((sum, t) => sum + t.amount, 0))}
              </p>
            )}
          </div>
          
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {mTransactions.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <svg className="w-8 h-8 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-sm">Noch keine M-Transaktionen</p>
              </div>
            ) : (
              mTransactions.map(transaction => (
                <TransactionCard key={transaction.id} transaction={transaction} color="red" />
              ))
            )}
          </div>
        </div>
      </div>

      {/* H+M Modal */}
      <HMModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSave={handleSave}
      />

      {/* H+M Edit Modal */}
      <HMEditModal
        isOpen={showEditModal}
        transaction={transactionToEdit}
        onSave={saveEditTransaction}
        onCancel={cancelEditTransaction}
      />

      {/* Delete Confirmation Modal */}
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
