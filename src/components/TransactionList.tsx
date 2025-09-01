import React from 'react';
import type { Transaction } from '../types/Transaction';
import './TransactionList.css';

interface TransactionListProps {
  transactions: Transaction[];
  onDelete: (id: string) => void;
}

const TransactionList: React.FC<TransactionListProps> = ({ transactions, onDelete }) => {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('de-DE');
  };

  const formatAmount = (amount: number, type: 'income' | 'expense') => {
    const formattedAmount = amount.toFixed(2);
    return type === 'income' 
      ? `+€${formattedAmount}` 
      : `-€${formattedAmount}`;
  };

  const getTotalBalance = () => {
    return transactions.reduce((total, transaction) => {
      return transaction.type === 'income' 
        ? total + transaction.amount 
        : total - transaction.amount;
    }, 0);
  };

  return (
    <div className="bg-white/10 rounded-2xl shadow-lg p-6 mt-8">
      <div className="mb-6 text-center">
        <h2 className="text-2xl font-bold text-white">Aktueller Saldo: <span className="text-blue-400">€{getTotalBalance().toFixed(2)}</span></h2>
      </div>
      <h3 className="text-lg text-white mb-4">Transaktionen ({transactions.length})</h3>
      {transactions.length === 0 ? (
        <p className="text-gray-300 text-center">Noch keine Transaktionen vorhanden.</p>
      ) : (
        <ul className="divide-y divide-gray-700">
          {transactions.map((transaction) => (
            <li 
              key={transaction.id} 
              className={`flex items-center justify-between py-4 px-2 ${transaction.type === 'income' ? 'bg-green-900/30' : 'bg-red-900/30'} rounded-lg transition`}
            >
              <div className="flex flex-col gap-1">
                <span className="font-medium text-white">{transaction.description}</span>
                <span className="text-xs text-gray-400">{transaction.category} • {formatDate(transaction.date)}</span>
              </div>
              <span className={`font-bold text-lg ${transaction.type === 'income' ? 'text-green-400' : 'text-red-400'}`}>{formatAmount(transaction.amount, transaction.type)}</span>
              <button 
                onClick={() => onDelete(transaction.id)}
                className="ml-4 text-gray-400 hover:text-red-500 text-xl font-bold focus:outline-none"
                aria-label="Transaktion löschen"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default TransactionList;
