import './styles.css';
import { useState, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { LazyTransactionList, type LazyTransactionListRef } from './components/LazyTransactionList';
import { InlineTransactionForm } from './components/InlineTransactionForm';
import { BilanzPage } from './components/BilanzPage';
import { PlannedExpensesPage } from './components/PlannedExpensesPage';
import { BusinessOverviewPage } from './components/BusinessOverviewPage';
import { HMPage } from './components/HMPage';
import { ConfirmModal } from './components/ConfirmModal';
import { EditTransactionModal } from './components/EditTransactionModal';
import { AddTransactionModal } from './components/AddTransactionModal';
import { addTransaction, deleteTransaction, updateTransaction } from './services/transactionService';
import type { Transaction } from './types/Transaction';



const UI_MESSAGES = {
  ADD_ERROR: 'Fehler beim Hinzufügen der Transaktion. Bitte versuchen Sie es erneut.',
  UPDATE_ERROR: 'Fehler beim Aktualisieren der Transaktion. Bitte versuchen Sie es erneut.',
  DELETE_ERROR: 'Fehler beim Löschen der Transaktion. Bitte versuchen Sie es erneut.',
  REQUIRED_FIELDS: 'Bitte füllen Sie alle Pflichtfelder aus.',
};

function HomePage({
  onDeleteTransaction,
  onEditTransaction,
}: {
  onDeleteTransaction: (transactionId: string) => void;
  onEditTransaction: (transaction: Transaction) => void;
}) {
  // Note: The input form was refactored into `InlineTransactionForm` for reuse.
  const transactionListRef = useRef<LazyTransactionListRef>(null);

  return (
    <div className="flex items-center justify-center px-3 sm:px-4 pb-4 sm:pb-8">
      <div className="w-full max-w-4xl">
        {/* Input Form - Mobile optimiert */}
          <div className="mb-6">
            <InlineTransactionForm onSaved={async () => {
              if (transactionListRef.current) await transactionListRef.current.refreshData();
            }} />
          </div>

        {/* Transaction List */}
        <LazyTransactionList 
          ref={transactionListRef} 
          onDeleteTransaction={onDeleteTransaction}
          onEditTransaction={onEditTransaction}
        />

        {/* Footer */}
        <div className="text-center mt-4 sm:mt-8">
          <p className="text-slate-500 text-xs sm:text-sm">
            © {new Date().getFullYear()} Cashflow Pro
          </p>
        </div>
      </div>
    </div>
  );
}

const AppLayout = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();
  const isHMPage = location.pathname === '/hm';

  return (
    <div className="min-h-screen bg-transparent">
      {/* Global Header mit Navigation - nur anzeigen wenn nicht auf H+M Seite */}
      {!isHMPage && (
        <div className="w-full max-w-4xl mx-auto px-3 sm:px-4 pt-4 sm:pt-8">
          <div className="text-center mb-6 sm:mb-8">
            <Link 
              to="/" 
              className="inline-block text-xl sm:text-2xl font-bold bg-gradient-to-r from-blue-400 via-purple-500 to-cyan-400 bg-clip-text text-transparent mb-2 sm:mb-3 tracking-tight hover:from-blue-300 hover:via-purple-400 hover:to-cyan-300 transition-all duration-200"
            >
              Cashflow
            </Link>
            <div className="w-12 sm:w-16 h-0.5 bg-gradient-to-r from-blue-400 to-cyan-400 mx-auto mb-4 sm:mb-6 opacity-60"></div>
          </div>
        </div>
      )}
      
      {children}
    </div>
  );
};

function App() {
  // App-level states for modals
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [transactionToDelete, setTransactionToDelete] = useState<string | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [transactionToEdit, setTransactionToEdit] = useState<Transaction | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTransactionProps, setNewTransactionProps] = useState<Partial<Transaction>>({});


  // App-level transaction handlers
  const handleDeleteTransaction = async (transactionId: string) => {
    setTransactionToDelete(transactionId);
    setShowDeleteModal(true);
  };

  const confirmDeleteTransaction = async () => {
    if (!transactionToDelete) return;

    try {
      await deleteTransaction(transactionToDelete);
      
      // Refresh transaction list if available
      window.location.reload(); // TODO: Replace with a more elegant state update
    } catch (error) {
      console.error('Error deleting transaction:', error);
      alert(UI_MESSAGES.DELETE_ERROR);
    } finally {
      setShowDeleteModal(false);
      setTransactionToDelete(null);
    }
  };

  const cancelDeleteTransaction = () => {
    setShowDeleteModal(false);
    setTransactionToDelete(null);
  };

  const handleEditTransaction = (transaction: Transaction) => {
    setTransactionToEdit({
      ...transaction,
      timestamp: transaction.timestamp || Date.now(),
    });
    setShowEditModal(true);
  };

  const saveEditTransaction = async (
    transactionId: string, 
    updatedData: {
      description: string;
      amount: number;
      location: string;
      type: 'income' | 'expense';
      date: string;
    }) => {
    try {
      await updateTransaction(transactionId, updatedData);
      
      // Refresh transaction list if available
      window.location.reload(); // TODO: Replace with a more elegant state update
    } catch (error) {
      console.error('Error updating transaction:', error);
      alert(UI_MESSAGES.UPDATE_ERROR);
    } finally {
      setShowEditModal(false);
      setTransactionToEdit(null);
    }
  };

  const cancelEditTransaction = () => {
    setShowEditModal(false);
    setTransactionToEdit(null);
  };

  const handleAddTransaction = (prefilledData: Partial<Transaction> = {}) => {
    setNewTransactionProps(prefilledData);
    setShowAddModal(true);
  };

  const saveNewTransaction = async (newTransactionData: { type: 'income' | 'expense'; amount: number; description: string; location: string; date: string; timestamp: number; isBusiness?: boolean; }) => {
    try {
      await addTransaction({
        ...newTransactionData,
        amount: newTransactionData.amount.toString(),
        isBusiness: newTransactionData.isBusiness ?? false,
      });
      window.location.reload(); // TODO: Replace with a more elegant state update
    } catch (error) {
      console.error('Error adding transaction:', error);
      alert(UI_MESSAGES.ADD_ERROR);
    } finally {
      setShowAddModal(false);
      setNewTransactionProps({});
    }
  };

  const cancelAddTransaction = () => {
    setShowAddModal(false);
    setNewTransactionProps({});
  };

  return (
    <Router>
      <AppLayout>
        <Routes>
          <Route path="/" element={
            <HomePage 
              onDeleteTransaction={handleDeleteTransaction}
              onEditTransaction={handleEditTransaction}
            />
          } />
          <Route path="/bilanzen" element={<BilanzPage />} />
          <Route path="/geplant" element={<PlannedExpensesPage />} />
          <Route path="/business" element={
            <BusinessOverviewPage 
              onDeleteTransaction={handleDeleteTransaction}
              onEditTransaction={handleEditTransaction}
              onAddTransaction={handleAddTransaction}
            />
          } />
          <Route path="/hm" element={<HMPage />} />
        </Routes>
        
        {/* Global Modals */}
        <ConfirmModal
          isOpen={showDeleteModal}
          title="Transaktion löschen"
          message="Sind Sie sicher, dass Sie diese Transaktion dauerhaft löschen möchten? Diese Aktion kann nicht rückgängig gemacht werden."
          confirmText="Löschen"
          cancelText="Abbrechen"
          onConfirm={confirmDeleteTransaction}
          onCancel={cancelDeleteTransaction}
          isDestructive={true}
        />

        <EditTransactionModal
          isOpen={showEditModal}
          transaction={transactionToEdit}
          onSave={saveEditTransaction}
          onCancel={cancelEditTransaction}
        />

        <AddTransactionModal
          isOpen={showAddModal}
          prefilledData={newTransactionProps}
          onSave={saveNewTransaction}
          onCancel={cancelAddTransaction}
        />
      </AppLayout>
    </Router>
  );
}

export default App;
