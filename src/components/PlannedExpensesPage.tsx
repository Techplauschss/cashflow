import { useState, useEffect } from 'react';
import type { Transaction, TransactionFormData } from '../types/Transaction';
import { addPlannedTransaction, getPlannedTransactions, deletePlannedTransaction } from '../services/transactionService';
import { ConfirmModal } from './ConfirmModal';

export const PlannedExpensesPage = () => {
  const [plannedTransactions, setPlannedTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddingTransaction, setIsAddingTransaction] = useState(false);
  
  // Form states
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [location, setLocation] = useState('');
  const [plannedDate, setPlannedDate] = useState('');
  
  // Modal states
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [transactionToDelete, setTransactionToDelete] = useState<string | null>(null);

  useEffect(() => {
    loadPlannedTransactions();
  }, []);

  const loadPlannedTransactions = async () => {
    try {
      setIsLoading(true);
      const transactions = await getPlannedTransactions();
      // Sortiere nach geplantem Datum (älteste zuerst)
      transactions.sort((a: Transaction, b: Transaction) => new Date(a.date).getTime() - new Date(b.date).getTime());
      setPlannedTransactions(transactions);
    } catch (error) {
      console.error('Error loading planned transactions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAmountKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
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
    const cleanValue = value.replace(/\./g, '');
    const parts = cleanValue.split(',');
    const integerPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    
    if (parts.length > 1) {
      const decimalPart = parts[1].slice(0, 2);
      return `${integerPart},${decimalPart}`;
    }
    
    return integerPart;
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = formatAmount(e.target.value);
    setAmount(newValue);
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!description || !amount || !location || !plannedDate) {
      alert('Bitte füllen Sie alle Felder aus.');
      return;
    }

    // Überprüfe, ob das Datum in der Zukunft liegt
    const selectedDate = new Date(plannedDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (selectedDate <= today) {
      alert('Das geplante Datum muss in der Zukunft liegen.');
      return;
    }

    try {
      setIsAddingTransaction(true);
      
      const transactionData: TransactionFormData = {
        type: 'expense',
        amount: amount,
        description: description,
        location: location,
        date: plannedDate,
        isPlanned: true
      };

      await addPlannedTransaction(transactionData);
      
      // Reset form
      setDescription('');
      setAmount('');
      setLocation('');
      setPlannedDate('');
      
      // Reload planned transactions
      await loadPlannedTransactions();
      
    } catch (error) {
      console.error('Error adding planned transaction:', error);
      alert('Fehler beim Hinzufügen der geplanten Ausgabe.');
    } finally {
      setIsAddingTransaction(false);
    }
  };

  const handleDeleteTransaction = (transactionId: string) => {
    setTransactionToDelete(transactionId);
    setShowDeleteModal(true);
  };

  const confirmDeleteTransaction = async () => {
    if (transactionToDelete) {
      try {
        await deletePlannedTransaction(transactionToDelete);
        await loadPlannedTransactions();
      } catch (error) {
        console.error('Error deleting planned transaction:', error);
        alert('Fehler beim Löschen der geplanten Ausgabe.');
      }
    }
    setShowDeleteModal(false);
    setTransactionToDelete(null);
  };

  const cancelDeleteTransaction = () => {
    setShowDeleteModal(false);
    setTransactionToDelete(null);
  };

  // Berechne Gesamtsumme
  const totalPlanned = plannedTransactions.reduce((sum, transaction) => sum + Math.abs(transaction.amount), 0);

  // Gruppiere nach Monat
  const groupedTransactions = plannedTransactions.reduce((groups: { [key: string]: Transaction[] }, transaction) => {
    const date = new Date(transaction.date);
    const monthYear = date.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
    
    if (!groups[monthYear]) {
      groups[monthYear] = [];
    }
    groups[monthYear].push(transaction);
    return groups;
  }, {});

  if (isLoading) {
    return (
      <div className="flex items-center justify-center px-4 pb-8">
        <div className="w-full max-w-4xl">
          <div className="bg-white/5 backdrop-blur-lg rounded-2xl border border-white/10 p-8 shadow-2xl">
            <div className="text-center">
              <h2 className="text-3xl font-bold text-white mb-4">Geplante Ausgaben</h2>
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                <span className="ml-3 text-slate-400">Lade geplante Ausgaben...</span>
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
        {/* Hauptcontainer */}
        <div className="bg-white/5 backdrop-blur-lg rounded-xl sm:rounded-2xl border border-white/10 p-4 sm:p-8 shadow-2xl">
          
          {/* Header mit Statistiken */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 sm:mb-8">
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4 sm:mb-0">
              📅 Geplante Ausgaben
            </h2>
            <div className="text-center sm:text-right">
              <div className="text-xs sm:text-sm text-slate-400">Gesamtsumme geplant</div>
              <div className="text-xl sm:text-2xl font-bold text-orange-400">
                {formatCurrency(totalPlanned)}
              </div>
            </div>
          </div>

          {/* Formular für neue geplante Ausgabe */}
          <div className="bg-slate-800/30 border border-slate-600/30 rounded-lg p-4 sm:p-6 mb-6 sm:mb-8">
            <h3 className="text-lg font-semibold text-white mb-4">Neue geplante Ausgabe hinzufügen</h3>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Beschreibung
                  </label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="z.B. Miete, Versicherung, etc."
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Ort/Anbieter
                  </label>
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="z.B. Vermieter, Versicherung, etc."
                    required
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Betrag (EUR)
                  </label>
                  <input
                    type="text"
                    value={amount}
                    onChange={handleAmountChange}
                    onKeyDown={handleAmountKeyDown}
                    className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0,00"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Geplantes Datum
                  </label>
                  <input
                    type="date"
                    value={plannedDate}
                    onChange={(e) => setPlannedDate(e.target.value)}
                    min={new Date(new Date().getTime() + 24*60*60*1000).toISOString().split('T')[0]} // Morgen
                    className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>
              
              <button
                type="submit"
                disabled={isAddingTransaction}
                className="w-full bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200"
              >
                {isAddingTransaction ? 'Wird hinzugefügt...' : 'Geplante Ausgabe hinzufügen'}
              </button>
            </form>
          </div>

          {/* Liste der geplanten Ausgaben */}
          <div className="space-y-6">
            <h3 className="text-lg sm:text-xl font-semibold text-white">
              Alle geplanten Ausgaben ({plannedTransactions.length})
            </h3>
            
            {plannedTransactions.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <div className="text-6xl mb-4">📅</div>
                <p className="text-lg mb-2">Keine geplanten Ausgaben vorhanden</p>
                <p className="text-sm">Fügen Sie Ihre ersten geplanten Ausgaben hinzu!</p>
              </div>
            ) : (
              Object.entries(groupedTransactions).map(([monthYear, transactions]) => (
                <div key={monthYear} className="space-y-3">
                  <h4 className="text-lg font-medium text-white border-b border-slate-600/30 pb-2">
                    {monthYear} ({transactions.length})
                  </h4>
                  
                  {transactions.map((transaction) => (
                    <div
                      key={transaction.id}
                      className="group bg-slate-800/30 border border-slate-600/30 rounded-lg p-3 sm:p-4 hover:bg-slate-800/50 transition-all"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h5 className="text-white font-medium text-sm">
                              {transaction.description}
                            </h5>
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-orange-500/10 text-orange-400 border border-orange-500/20">
                              Geplant
                            </span>
                          </div>
                          <div className="text-xs text-slate-400">
                            {transaction.location} • {new Date(transaction.date).toLocaleDateString('de-DE')}
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <div className="text-right">
                            <div className="text-lg font-semibold text-red-400">
                              -{formatCurrency(Math.abs(transaction.amount))}
                            </div>
                          </div>
                          
                          <button
                            onClick={() => handleDeleteTransaction(transaction.id)}
                            className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 p-2 transition-all"
                            title="Löschen"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={showDeleteModal}
        title="Geplante Ausgabe löschen"
        message="Sind Sie sicher, dass Sie diese geplante Ausgabe löschen möchten?"
        confirmText="Löschen"
        cancelText="Abbrechen"
        onConfirm={confirmDeleteTransaction}
        onCancel={cancelDeleteTransaction}
        isDestructive={true}
      />
    </div>
  );
};
